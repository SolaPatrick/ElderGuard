r"""Step 11: run fall_detect.py on several test videos in one go and print a summary.

Put the test videos in the videos folder (next to for_training), list them below, then run:
    python run_tests.py
Each result video is saved next to its test video as <name>_result.mp4.
"""
from pathlib import Path
import fall_detect

VIDEOS = Path(r"C:\Elderguard\elderguard\videos")
SHOW = False   # True to watch each video while it runs (slower; press q to skip to the next one)

# video file, camera place, privacy blur, the fall type you expect
TESTS = [
    ("bedtest.mp4",   "room",     "off",   "FALL FROM BED"),
    ("wheeltest.mp4", "room",     "off",   "FALL FROM WHEELCHAIR"),
    ("sliptest.mp4",  "bathroom", "whole", "BATHROOM SLIP"),
    ("b7.mp4",  "room",   "off", "FALL FROM BED"),
    ("w7.mp4",  "room",   "off", "FALL FROM WHEELCHAIR"),
    ("b17.mp4",  "room", "off", "FALL FROM BED"),
]

if __name__ == "__main__":
    results = []
    for name, place, blur, expected in TESTS:
        print(f"\n=== {name} ===")
        fall_detect.SOURCE = str(VIDEOS / name)
        fall_detect.OUTPUT = str(VIDEOS / (Path(name).stem + "_result.mp4"))
        fall_detect.CAMERA_PLACE = place
        fall_detect.PRIVACY_BLUR = blur
        fall_detect.SHOW = SHOW
        try:
            falls = fall_detect.main()
        except SystemExit as e:   # video missing or unreadable
            print(e)
            falls = None
        results.append((name, expected, falls))

    print("\n=== Summary ===")
    for name, expected, falls in results:
        if falls is None:
            verdict, got = "ERROR", "could not open video"
        else:
            got = ", ".join(falls) or "no fall"
            verdict = "PASS" if falls == [expected] else "CHECK"
        print(f"{verdict:6} {name:16} expected {expected:22} got {got}")
