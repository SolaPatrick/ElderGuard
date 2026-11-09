r"""Step 5: turn your recorded videos into photos for labeling in CVAT.

Put your videos in C:\elderguard\videos\for_training, then run:
    python extract_frames.py
Each photo is named after its video, for example room1_000150.jpg, so
prepare_fall_data.py can keep all photos from one video in the same split.
"""
from pathlib import Path
import cv2

# ---- settings you can change ----
VIDEOS = Path(r"C:\Elderguard\elderguard\videos\for_training")
OUT = Path(r"C:\Elderguard\elderguard\frames")
EVERY_SECONDS = 0.5   # save one photo every half second (falls are short, so don't go much higher)
# ---------------------------------

VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    videos = sorted(p for p in VIDEOS.iterdir() if p.suffix.lower() in VIDEO_EXT)
    if not videos:
        raise SystemExit(f"No videos found in {VIDEOS}")
    total = 0
    for video in videos:
        cap = cv2.VideoCapture(str(video))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        step = max(1, round(EVERY_SECONDS * fps))
        frame_no, saved = 0, 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_no % step == 0:
                cv2.imwrite(str(OUT / f"{video.stem}_{frame_no:06d}.jpg"), frame)
                saved += 1
            frame_no += 1
        cap.release()
        print(f"{video.name}: {saved} photos")
        total += saved
    print(f"Done: {total} photos in {OUT}")


if __name__ == "__main__":
    main()
