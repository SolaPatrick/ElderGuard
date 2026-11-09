r"""Step 10: Elderguard fall detection for a home for the aged.

The YOLOv8 model (trained in step 8) sees 4 states: fallen, in_bed, in_wheelchair, upright.
A FALL is raised when a person stays "fallen" for about FALL_SECONDS. The fall type comes from
what that person was doing just before:
    in_wheelchair -> fallen   FALL FROM WHEELCHAIR
    in_bed        -> fallen   FALL FROM BED
    upright       -> fallen   LOSS OF BALANCE   (or BATHROOM SLIP on a bathroom camera)

Bathroom privacy: the model looks at the original frame first; only after that is every person
(or the whole picture) blurred, and only the blurred picture is shown or saved.

Run:  python fall_detect.py      (press q to stop)
"""
from collections import deque
import cv2
from ultralytics import YOLO

# ---- settings you can change ----
MODEL = r"C:\Elderguard\elderguard\runs\fall\weights\best.pt"   # created by train_fall.py
SOURCE = r"C:\Elderguard\elderguard\videos\test.mp4"            # a video file, or 0 / 1 for a camera
OUTPUT = r"C:\Elderguard\elderguard\videos\test_result.mp4"     # None to not save
SHOW = True
CAMERA_PLACE = "room"     # "room" or "bathroom"
PRIVACY_BLUR = "off"      # "off", "person" (blur each person) or "whole" (blur the whole picture)
CONF = 0.4                # minimum confidence for a state to count
BLUR_CONF = 0.15          # lower, so even weak detections still get blurred
FALL_SECONDS = 1.0        # how long "fallen" must last before FALL is raised
FALL_SHARE = 0.7          # share of frames in that time that must be "fallen" (tolerates flicker)
ORIGIN_SECONDS = 10       # how far back to look for what the person was doing before the fall
STABLE_SECONDS = 0.5      # a state must last this long to count as "what they were doing"
LOST_SECONDS = 3          # keep a person's history this long after the tracker loses them
RECOVER_SECONDS = 2.0     # a fallen person must be up this long before a new fall can be raised
# ---------------------------------

COLORS = {"fallen": (0, 165, 255), "in_bed": (255, 128, 0), "in_wheelchair": (255, 0, 255),
          "upright": (0, 255, 0)}


class FallMonitor:
    """Keeps a short history of states for each tracked person and decides when a fall happened."""

    def __init__(self, fps, place="room"):
        self.window = max(1, round(FALL_SECONDS * fps))
        self.stable = max(1, round(STABLE_SECONDS * fps))
        self.origin = round(ORIGIN_SECONDS * fps)
        self.place = place
        self.lost = round(LOST_SECONDS * fps)
        self.recover = max(1, round(RECOVER_SECONDS * fps))
        self.history = {}   # track id -> recent states
        self.alarms = {}    # track id -> fall type, while that person is still down
        self.last_box = {}  # track id -> last box seen
        self.last_frame = {}  # track id -> last frame it was seen
        self.frame = 0

    def next_frame(self):
        self.frame += 1

    def update(self, tid, state, box=None):
        """Add one frame for this person. Returns the fall type the moment a fall is confirmed, else None."""
        if tid not in self.history and box is not None:
            self.take_over(tid, box)
        if box is not None:
            self.last_box[tid] = box
        self.last_frame[tid] = self.frame
        h = self.history.setdefault(tid, deque(maxlen=self.origin + self.window))
        h.append(state)
        recent = list(h)[-self.window:]
        down = len(recent) == self.window and recent.count("fallen") >= FALL_SHARE * self.window
        if not down:
            last = list(h)[-self.recover:]
            if len(last) == self.recover and last.count("fallen") <= (1 - FALL_SHARE) * self.recover:
                self.alarms.pop(tid, None)   # really up again for RECOVER_SECONDS: ready for the next fall
            return None
        if tid in self.alarms:
            return None
        self.alarms[tid] = self.fall_type(list(h)[:-self.window])
        return self.alarms[tid]

    def fall_type(self, before):
        """Most recent state, before the fall, that lasted at least STABLE_SECONDS."""
        last_seen, found, run_state, run = None, None, None, 0
        for s in reversed(before):
            if s == "fallen":
                run_state, run = None, 0
                continue
            last_seen = last_seen or s
            run = run + 1 if s == run_state else 1
            run_state = s
            if run >= self.stable:
                found = s
                break
        run_state = found or last_seen   # no long enough state: use the last one seen
        if run_state == "in_wheelchair":
            return "FALL FROM WHEELCHAIR"
        if run_state == "in_bed":
            return "FALL FROM BED"
        if run_state == "upright":
            return "BATHROOM SLIP" if self.place == "bathroom" else "LOSS OF BALANCE"
        return "FALL"

    def alarm(self, tid):
        return self.alarms.get(tid)

    def touch(self, tid, box):
        """Seen this frame, but too unsure to judge the state: just keep the person alive."""
        if tid not in self.history:
            self.take_over(tid, box)
        if tid in self.history:
            self.last_box[tid], self.last_frame[tid] = box, self.frame

    def take_over(self, tid, box):
        """The tracker sometimes gives a person a new id (often while they fall or lie still).
        If a person was lost recently at the same spot, the new id takes over their history and alarm."""
        best, best_iou = None, 0.3
        for old, old_box in self.last_box.items():
            if old in self.history and self.last_frame[old] < self.frame and iou(box, old_box) > best_iou:
                best, best_iou = old, iou(box, old_box)
        if best is not None:
            self.history[tid] = self.history.pop(best)
            if best in self.alarms:
                self.alarms[tid] = self.alarms.pop(best)
            self.drop(best)

    def drop(self, tid):
        for d in (self.history, self.alarms, self.last_box, self.last_frame):
            d.pop(tid, None)

    def forget(self):
        """Forget people the tracker has not seen for LOST_SECONDS."""
        for tid in list(self.last_frame):
            if self.frame - self.last_frame[tid] > self.lost:
                self.drop(tid)


def iou(a, b):
    """Overlap of two boxes (x1, y1, x2, y2): 0 = none, 1 = identical."""
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return 0.0
    inter = w * h
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)


def pixelate(img, blocks):
    """Strong blur: shrink to a few blocks across, then blow back up."""
    h, w = img.shape[:2]
    if h < 2 or w < 2:
        return img
    small = cv2.resize(img, (blocks, max(1, round(blocks * h / w))), interpolation=cv2.INTER_AREA)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)


def blur_people(frame, boxes):
    h, w = frame.shape[:2]
    for x1, y1, x2, y2 in boxes:
        px, py = 0.1 * (x2 - x1), 0.1 * (y2 - y1)   # a bit of margin around the person
        x1, y1 = max(0, int(x1 - px)), max(0, int(y1 - py))
        x2, y2 = min(w, int(x2 + px)), min(h, int(y2 + py))
        frame[y1:y2, x1:x2] = pixelate(frame[y1:y2, x1:x2], 6)   # about 6 blocks across a person


def main():
    model = YOLO(MODEL)
    cap = cv2.VideoCapture(SOURCE)
    if not cap.isOpened():
        raise SystemExit(f"Can't open {SOURCE}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    monitor = FallMonitor(fps, CAMERA_PLACE)
    out, frame_no, falls = None, 0, []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_no += 1
        monitor.next_frame()

        # 1. detect and track on the ORIGINAL picture
        r = model.track(frame, persist=True, tracker="bytetrack.yaml",
                        conf=min(CONF, BLUR_CONF), verbose=False)[0]
        people = []   # (box, label, color) to draw after the blur
        all_boxes = r.boxes.xyxy.tolist() if r.boxes is not None else []
        if r.boxes is not None and r.boxes.id is not None:
            for tid, box, cls, c in zip(r.boxes.id.int().tolist(), all_boxes,
                                        r.boxes.cls.int().tolist(), r.boxes.conf.tolist()):
                if c < CONF:
                    monitor.touch(tid, box)   # too unsure to judge the state, but it is still blurred below
                    continue
                state = r.names[cls]
                fall = monitor.update(tid, state, box)
                if fall:
                    print(f"[frame {frame_no}, {frame_no / fps:.1f} s] {fall} - person {tid}")
                    falls.append(fall)
                if monitor.alarm(tid):
                    people.append((box, f"{monitor.alarm(tid)}! id {tid}", (0, 0, 255)))
                else:
                    people.append((box, f"{state} {c:.2f} id {tid}", COLORS.get(state, (200, 200, 200))))
        monitor.forget()

        # 2. privacy blur, only after the model has decided
        if PRIVACY_BLUR == "whole":
            frame = cv2.GaussianBlur(pixelate(frame, 24), (51, 51), 0)
        elif PRIVACY_BLUR == "person":
            blur_people(frame, all_boxes)

        # 3. draw boxes and labels on top
        for (x1, y1, x2, y2), label, color in people:
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 3)
            cv2.putText(frame, label, (int(x1), max(20, int(y1) - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)
        cv2.putText(frame, f"camera: {CAMERA_PLACE}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

        if OUTPUT and out is None:
            h, w = frame.shape[:2]
            out = cv2.VideoWriter(OUTPUT, cv2.VideoWriter_fourcc(*"mp4v"), int(fps), (w, h))
        if out is not None:
            out.write(frame)
        if SHOW:
            cv2.imshow("Elderguard fall detection", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    if out is not None:
        out.release()
        print("Saved:", OUTPUT)
    cv2.destroyAllWindows()
    return falls


if __name__ == "__main__":
    main()
