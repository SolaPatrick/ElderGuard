"""Second opinion on a possible fall, from body keypoints (YOLOv8n-pose).

It can only BLOCK an alarm when it is sure the person is upright (sitting, standing, bending).
When it is unsure, it says "unclear" and the alarm goes ahead: missing a fall is worse than a false alarm."""
import math

POINT_CONF = 0.5          # a keypoint counts only if the model is at least this sure of it
UPRIGHT_MAX_DEG = 40      # torso within 40 degrees of vertical = upright
LYING_MIN_DEG = 60        # torso more than 60 degrees from vertical = lying
MIN_TORSO_SHARE = 0.25    # shoulder-to-hip length must be at least this share of the person's box height:
                          # someone lying head- or feet-first toward the camera looks "upright" but squashed
SHOULDER, HIP, KNEE, ANKLE = (5, 6), (11, 12), (13, 14), (15, 16)


class PoseChecker:
    def __init__(self, weights="yolov8n-pose.pt", device="0"):
        from ultralytics import YOLO   # imported here, like the fall model, so the API starts without ultralytics
        self.model = YOLO(weights)
        self.device = device

    def check(self, frame, box) -> str:
        """Returns "upright", "lying" or "unclear" for the person inside box (x1, y1, x2, y2)."""
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = box
        px, py = 0.15 * (x2 - x1), 0.15 * (y2 - y1)          # a little margin around the person
        x1, y1 = max(0, int(x1 - px)), max(0, int(y1 - py))
        x2, y2 = min(w, int(x2 + px)), min(h, int(y2 + py))
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return "unclear"
        r = self.model(crop, device=self.device, verbose=False)[0]
        if r.keypoints is None or len(r.keypoints.xy) == 0 or r.keypoints.conf is None:
            return "unclear"
        pts, conf = r.keypoints.xy[0].tolist(), r.keypoints.conf[0].tolist()   # the most confident person
        return judge(pts, conf, box[3] - box[1])


def _mid(pts, conf, pair):
    seen = [pts[i] for i in pair if conf[i] >= POINT_CONF]
    if not seen:
        return None
    return (sum(p[0] for p in seen) / len(seen), sum(p[1] for p in seen) / len(seen))


def judge(pts, conf, box_height: float) -> str:
    shoulders, hips = _mid(pts, conf, SHOULDER), _mid(pts, conf, HIP)
    if shoulders is None or hips is None:
        return "unclear"                                    # e.g. under a blanket, half out of view
    dx, dy = hips[0] - shoulders[0], hips[1] - shoulders[1]
    angle = math.degrees(math.atan2(abs(dx), abs(dy) + 1e-6))
    if angle >= LYING_MIN_DEG:
        return "lying"
    if angle > UPRIGHT_MAX_DEG or hips[1] <= shoulders[1]:
        return "unclear"                                    # leaning, or hips not below the shoulders
    if math.hypot(dx, dy) < MIN_TORSO_SHARE * box_height:
        return "unclear"                                    # squashed torso: maybe lying toward the camera
    knees = _mid(pts, conf, KNEE)
    if knees is None or knees[1] <= hips[1]:
        return "unclear"                                    # knees not seen below the hips
    return "upright"
