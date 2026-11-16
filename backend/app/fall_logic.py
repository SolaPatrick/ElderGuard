"""Fall logic, the same as in fall_detect.py (step 10 of the training tutorial).

FallMonitor keeps a short history of states for each tracked person and decides when a fall
happened and what type it was. The backend runs one FallMonitor per camera.
"""
from collections import deque
import cv2

# ---- same settings as fall_detect.py ----
CONF = 0.4                # minimum confidence for a state to count
FALLEN_CONF = 0.55        # stricter for "fallen": unsure guesses (often someone sitting) don't count toward a fall
BLUR_CONF = 0.15          # lower, so even weak detections still get blurred
FALL_SECONDS = 1.5        # how long "fallen" must last before FALL is raised
FALL_SHARE = 0.7          # share of frames in that time that must be "fallen" (tolerates flicker)
ORIGIN_SECONDS = 10       # how far back to look for what the person was doing before the fall
STABLE_SECONDS = 0.5      # a state must last this long to count as "what they were doing"
LOST_SECONDS = 3          # keep a person's history this long after the tracker loses them
RECOVER_SECONDS = 2.0     # a fallen person must be up this long before a new fall can be raised
HOLD_RECHECK_SECONDS = 1.5   # a fall the pose check held back is checked again this often
HOLD_MAX_SECONDS = 15        # still "fallen" this long after being held back: alarm anyway (e.g. slumped
                             # sitting on the floor after a fall looks upright to the pose check)
DROP_SECONDS = 1.5      # a fall happens within this time
DROP_SHARE = 0.35       # the top of the box drops by at least 35% of the person's earlier height
# -----------------------------------------

COLORS = {"fallen": (0, 165, 255), "in_bed": (255, 128, 0), "in_wheelchair": (255, 0, 255),
          "upright": (0, 255, 0)}


def min_conf(state: str) -> float:
    """Confidence a detection needs before its state counts. Checked on 33 fall videos: with FALLEN_CONF 0.55 and
    FALL_SECONDS 1.5 every video gives exactly one alarm at the real fall (the old 0.4 / 1.0 gave 3 extra alarms).
    Above 0.6, real falls start to be missed."""
    return FALLEN_CONF if state == "fallen" else CONF


class FallMonitor:
    """Keeps a short history of states for each tracked person and decides when a fall happened."""

    def __init__(self, fps, place="room"):
        self.window = max(1, round(FALL_SECONDS * fps))
        self.stable = max(1, round(STABLE_SECONDS * fps))
        self.origin = round(ORIGIN_SECONDS * fps)
        self.place = place
        self.lost = round(LOST_SECONDS * fps)
        self.recover = max(1, round(RECOVER_SECONDS * fps))
        self.recheck = max(1, round(HOLD_RECHECK_SECONDS * fps))
        self.hold_max = round(HOLD_MAX_SECONDS * fps)
        self.history = {}   # track id -> recent states
        self.alarms = {}    # track id -> fall type, while that person is still down
        self.held = {}      # track id -> [fall type, frame it was first held, frame to check again]
        self.resting = {}   # track id -> frame to check again, while lying in a rest zone (bed, floor mat)
        self.last_box = {}  # track id -> last box seen
        self.last_frame = {}  # track id -> last frame it was seen
        self.frame = 0
        self.fps = fps
        self.boxes = {}     # track id -> deque of (frame, box), the last ORIGIN_SECONDS, for dropped_fast

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
        if box is not None:
            self.boxes.setdefault(tid, deque(maxlen=self.origin)).append((self.frame, box))
        recent = list(h)[-self.window:]
        down = len(recent) == self.window and recent.count("fallen") >= FALL_SHARE * self.window
        if not down:
            last = list(h)[-self.recover:]
            if len(last) == self.recover and last.count("fallen") <= (1 - FALL_SHARE) * self.recover:
                self.alarms.pop(tid, None)   # really up again for RECOVER_SECONDS: ready for the next fall
                self.held.pop(tid, None)
                self.resting.pop(tid, None)
            return None
        if tid in self.alarms:
            return None
        if tid in self.resting:              # lying in a rest zone: look again later (they may have rolled out)
            if self.frame < self.resting[tid]:
                return None
            del self.resting[tid]
        if tid in self.held:                 # held back by the pose check: same fall, asked about again later
            fall, since, check_at = self.held[tid]
            if self.frame < check_at and self.frame - since < self.hold_max:
                return None
            self.alarms[tid] = fall
            return fall
        self.alarms[tid] = self.fall_type(list(h)[:-self.window])
        return self.alarms[tid]

    def dropped_fast(self, tid) -> bool:
        """True if the top of this person's box fell a long way within DROP_SECONDS (a fall, not lying down slowly).
        Not used yet: it is for rest zones, where only a sudden drop should still raise an alarm."""
        hist = list(self.boxes.get(tid, []))
        if not hist:
            return False
        # Measured against the person's tallest box in the last few seconds, not the current one: while someone
        # lies down slowly their box keeps getting shorter, which would make a slow, small drop look big.
        tallest = max(b[3] - b[1] for _, b in hist)
        span = round(DROP_SECONDS * self.fps)
        for i, (f0, b0) in enumerate(hist):
            for f1, b1 in hist[i + 1:]:
                if f1 - f0 > span:
                    break
                if b1[1] - b0[1] >= DROP_SHARE * tallest:
                    return True
        return False

    def may_hold(self, tid) -> bool:
        """False once a fall has been held back for HOLD_MAX_SECONDS: then it must alarm, whatever the pose says."""
        held = self.held.get(tid)
        return held is None or self.frame - held[1] < self.hold_max

    def hold(self, tid):
        """The pose check says this person is upright after all: no alarm now, but keep the fall (and its type)
        and ask again in HOLD_RECHECK_SECONDS while the model still says 'fallen'."""
        fall = self.alarms.pop(tid, None)
        if fall is None:
            return
        if tid in self.held:
            self.held[tid][2] = self.frame + self.recheck
        else:
            self.held[tid] = [fall, self.frame, self.frame + self.recheck]

    def rest(self, tid):
        """This person is lying in a rest zone (bed, floor mat) and did not drop suddenly: no alarm. Unlike hold(),
        there is no time limit, so someone sleeping never alarms; they are looked at again every
        HOLD_RECHECK_SECONDS, so rolling out of the zone or a sudden collapse is still caught."""
        self.alarms.pop(tid, None)
        self.held.pop(tid, None)
        self.resting[tid] = self.frame + self.recheck

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
            if best in self.held:
                self.held[tid] = self.held.pop(best)
            if best in self.boxes:
                self.boxes[tid] = self.boxes.pop(best)
            if best in self.resting:
                self.resting[tid] = self.resting.pop(best)
            self.drop(best)

    def drop(self, tid):
        for d in (self.history, self.alarms, self.held, self.resting, self.boxes, self.last_box, self.last_frame):
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
