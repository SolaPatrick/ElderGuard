"""Runs your fall model on every camera, in the background, and keeps the newest picture for the stream.

One CameraWorker thread per camera:
    read frame -> model.track (on the ORIGINAL picture) -> FallMonitor -> privacy blur -> draw -> JPEG
When FallMonitor confirms a fall, the worker saves an alert (with the blurred snapshot) and the
alert hub pushes it to every dashboard.

CameraManager checks the cameras table every few seconds, so cameras you add, edit or delete
through the API start, restart or stop by themselves.
"""
import threading
import time
import traceback
from pathlib import Path

import cv2
import numpy as np
from sqlmodel import Session, select

from . import config
from .database import engine
from .fall_logic import BLUR_CONF, COLORS, CONF, FallMonitor, blur_people, iou, pixelate
from .models import Blur, Camera, required_blur
from .models import now as now_utc
from .routers.alerts import create_alert

FONT = cv2.FONT_HERSHEY_SIMPLEX
SAME_SPOT_IOU = 0.3   # boxes overlapping this much count as the same person lying in the same spot


def placeholder(text: str) -> bytes:
    """A grey picture with a message, shown while a camera is starting or offline."""
    img = np.full((360, 640, 3), 40, np.uint8)
    cv2.putText(img, text, (30, 190), FONT, 0.9, (220, 220, 220), 2, cv2.LINE_AA)
    return cv2.imencode(".jpg", img)[1].tobytes()


class CameraWorker(threading.Thread):
    def __init__(self, camera: Camera):
        super().__init__(daemon=True, name=f"camera-{camera.id}")
        self.camera_id = camera.id
        self.name_ = camera.name
        self.source = camera.source
        self.place = camera.place.value
        self.blur = required_blur(camera.place, camera.privacy_blur).value   # also covers older database rows
        self.settings = settings_of(camera)
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.jpeg = placeholder(f"{camera.name}: starting...")
        self.online = False
        self.fps = 0.0
        self.error = ""
        self.recent_falls = []    # (time, box) of falls already raised, to spot duplicates
        self.pending_alerts = []  # confirmed falls not saved yet; they stay here until the database accepts them
        self.retry_at = 0.0

    # ---- what the API reads ----
    def latest_jpeg(self) -> bytes:
        with self.lock:
            return self.jpeg

    def status(self) -> dict:
        return {"camera_id": self.camera_id, "online": self.online, "fps": round(self.fps, 1),
                "error": self.error}

    def stop(self):
        self.stop_event.set()

    # ---- the background loop ----
    def run(self):
        model = None
        while not self.stop_event.is_set():
            self._save_pending_alerts()       # also while the camera is offline
            try:
                if model is None:
                    from ultralytics import YOLO  # imported here so the API still starts if ultralytics is missing
                    try:
                        model = YOLO(config.MODEL_PATH)  # each camera gets its own model: tracking memory is per camera
                    except Exception as e:
                        raise RuntimeError(f"Can't load the model: {e}") from e
                self._open_and_watch(model)
            except Exception as e:            # whatever goes wrong, this thread must keep monitoring
                traceback.print_exc()
                print(f"[{self.name_}] monitoring stopped, restarting: {e}")
                model = None                  # start clean, in case the model itself is what broke
                self.online, self.error = False, f"Monitoring stopped: {e}"
                self._set_jpeg(placeholder(f"{self.name_}: error, restarting..."))
                self.stop_event.wait(config.WORKER_RESTART_SECONDS)
        self.retry_at = 0.0
        self._save_pending_alerts()           # last try before this worker goes away

    def _open_and_watch(self, model):
        cap = cv2.VideoCapture(int(self.source) if self.source.isdecimal() else self.source)
        try:
            if not cap.isOpened():
                self.online, self.error = False, "Can't open the camera"
                self._set_jpeg(placeholder(f"{self.name_}: offline, retrying..."))
                self.stop_event.wait(5)
                return
            self._watch(cap, model)
        finally:
            cap.release()
        self.online = False
        if not self.stop_event.is_set():
            self._set_jpeg(placeholder(f"{self.name_}: reconnecting..."))
            self.stop_event.wait(2)

    def _watch(self, cap, model):
        is_file = Path(self.source).is_file()
        file_fps = cap.get(cv2.CAP_PROP_FPS) or 30
        monitor = FallMonitor(config.PROCESS_FPS, self.place)
        model.predictor = None                 # forget the tracker of any earlier run
        every = 1.0 / config.PROCESS_FPS
        started = time.monotonic()
        next_time, frames, fps_start = 0.0, 0, time.monotonic()
        file_frame = 0
        while not self.stop_event.is_set():
            ok, frame = cap.read()
            if not ok:
                if is_file:                    # a video file: play it again from the start (handy for demos)
                    return
                self.error = "The camera stopped sending pictures"
                return
            if is_file:                        # play a file at its real speed
                file_frame += 1
                wait = started + file_frame / file_fps - time.monotonic()
                if wait > 0:
                    time.sleep(wait)
            now = time.monotonic()
            if now < next_time:
                continue                       # skip frames so the model checks PROCESS_FPS per second
            next_time = now + every
            jpeg = self._process(frame, model, monitor)
            self._set_jpeg(jpeg)
            self.online, self.error = True, ""   # only after a frame really went through the model
            frames += 1
            if now - fps_start >= 2:
                self.fps, frames, fps_start = frames / (now - fps_start), 0, now

    def _process(self, frame, model, monitor) -> bytes:
        monitor.next_frame()
        # 1. detect and track on the ORIGINAL picture
        r = model.track(frame, persist=True, tracker="bytetrack.yaml", conf=min(CONF, BLUR_CONF),
                        device=config.DEVICE, verbose=False)[0]
        people, falls = [], []
        all_boxes = r.boxes.xyxy.tolist() if r.boxes is not None else []
        if r.boxes is not None and r.boxes.id is not None:
            for tid, box, cls, c in zip(r.boxes.id.int().tolist(), all_boxes,
                                        r.boxes.cls.int().tolist(), r.boxes.conf.tolist()):
                if c < CONF:
                    monitor.touch(tid, box)
                    continue
                state = r.names[cls]
                fall = monitor.update(tid, state, box)
                if fall:
                    falls.append((fall, c, box))
                if monitor.alarm(tid):
                    people.append((box, f"{monitor.alarm(tid)}!", (0, 0, 255)))
                else:
                    people.append((box, f"{state} {c:.2f}", COLORS.get(state, (200, 200, 200))))
        monitor.forget()

        # 2. privacy blur, only after the model has decided
        if self.blur == Blur.whole.value:
            frame = cv2.GaussianBlur(pixelate(frame, 24), (51, 51), 0)
        elif self.blur == Blur.person.value:
            blur_people(frame, all_boxes)

        # 3. boxes, labels and the time on top
        for (x1, y1, x2, y2), label, color in people:
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 3)
            cv2.putText(frame, label, (int(x1), max(20, int(y1) - 10)), FONT, 0.7, color, 2, cv2.LINE_AA)
        cv2.putText(frame, f"{self.name_}  {time.strftime('%I:%M:%S %p')}", (10, 30), FONT, 0.8,
                    (255, 255, 255), 2, cv2.LINE_AA)
        jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, config.JPEG_QUALITY])[1].tobytes()

        # 4. a confirmed fall becomes an alert (the snapshot is the blurred picture)
        for fall_type, conf, box in falls:
            if self._is_duplicate(fall_type, box):
                print(f"[{self.name_}] same person found again at the same spot, no second alert")
                continue
            self.recent_falls.append((time.monotonic(), box))
            print(f"[{self.name_}] {fall_type} ({conf:.2f})")
            self.pending_alerts.append((fall_type, conf, jpeg, now_utc()))
        self._save_pending_alerts()
        return jpeg

    def _is_duplicate(self, fall_type: str, box) -> bool:
        """True only if the tracker lost a person who is already down and found them again as someone new:
        no earlier state is known ("FALL"), at the same spot as a fall raised moments ago.
        A fall seen happening, from a known state, is never a duplicate, however recent the last alert."""
        oldest = time.monotonic() - config.DUPLICATE_COOLDOWN_SECONDS
        self.recent_falls = [(t, b) for t, b in self.recent_falls if t >= oldest]
        return fall_type == "FALL" and any(iou(box, b) > SAME_SPOT_IOU for _, b in self.recent_falls)

    def _save_pending_alerts(self):
        """Saves confirmed falls. If the database is down they are kept and tried again until it is back."""
        if not self.pending_alerts or time.monotonic() < self.retry_at:
            return
        while self.pending_alerts:
            fall_type, conf, jpeg, detected_at = self.pending_alerts[0]
            try:
                with Session(engine) as session:
                    camera = session.get(Camera, self.camera_id)
                    if camera:
                        create_alert(session, camera, fall_type, conf, jpeg, detected_at)
                    else:
                        print(f"[{self.name_}] camera was deleted, dropping alert: {fall_type}")
            except Exception as e:
                self.retry_at = time.monotonic() + config.ALERT_RETRY_SECONDS
                print(f"[{self.name_}] could not save {len(self.pending_alerts)} alert(s), "
                      f"retrying in {config.ALERT_RETRY_SECONDS} s: {e}")
                return
            self.pending_alerts.pop(0)

    def _set_jpeg(self, jpeg: bytes):
        with self.lock:
            self.jpeg = jpeg


def settings_of(camera: Camera) -> tuple:
    return (camera.source, camera.place, camera.privacy_blur, camera.detection_enabled)


class CameraManager:
    def __init__(self):
        self.workers: dict[int, CameraWorker] = {}
        self.stop_event = threading.Event()
        self.thread: threading.Thread | None = None

    def start(self):
        self.thread = threading.Thread(target=self._loop, daemon=True, name="camera-manager")
        self.thread.start()

    def _loop(self):
        while not self.stop_event.is_set():
            try:
                self.sync()
            except Exception as e:
                print("Camera manager:", e)
            self.stop_event.wait(5)

    def sync(self):
        """Start, restart or stop workers so they match the cameras table."""
        with Session(engine) as session:
            cameras = {c.id: c for c in session.exec(select(Camera).where(Camera.detection_enabled)).all()}
        for cid in list(self.workers):
            if cid not in cameras or self.workers[cid].settings != settings_of(cameras[cid]):
                self.workers.pop(cid).stop()
        for cid, camera in cameras.items():
            if cid not in self.workers:
                worker = CameraWorker(camera)
                self.workers[cid] = worker
                worker.start()
                print(f"Started {camera.name}")   # not the source: rtsp:// links can hold a password

    def stop_all(self):
        self.stop_event.set()
        for worker in self.workers.values():
            worker.stop()
        for worker in self.workers.values():
            worker.join(timeout=5)

    def latest_jpeg(self, camera_id: int) -> bytes | None:
        worker = self.workers.get(camera_id)
        return worker.latest_jpeg() if worker else None

    def status(self, camera_id: int) -> dict:
        worker = self.workers.get(camera_id)
        if worker is None:
            return {"camera_id": camera_id, "online": False, "fps": 0, "error": "Detection is off"}
        return worker.status()


manager = CameraManager()