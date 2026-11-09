r"""Step 7: turn your CVAT "YOLO 1.1" export into the folder YOLOv8 trains on.

Unzip each CVAT export into its own folder inside C:\elderguard\cvat_export
(for example cvat_export\old_photos and cvat_export\videos_1), then run:
    python prepare_fall_data.py
It creates C:\elderguard\fall_data with images/, labels/ and data.yaml.

Two things it does for you:
- It puts the classes in the fixed order fallen, in_bed, in_wheelchair, upright,
  even if you created the labels in CVAT in a different order.
- It keeps all photos from one video together in train or in val. Photos half a second
  apart look almost the same, so mixing them would make the val score look better than it is.
"""
import random
import shutil
from collections import defaultdict
from pathlib import Path

# ---- settings you can change ----
CVAT_EXPORT = Path(r"C:\Elderguard\elderguard\cvat_export")  # one folder per export, each with obj.names and obj_train_data\
IMAGES = Path(r"C:\Elderguard\elderguard\frames")            # the photos you uploaded to CVAT
OUT = Path(r"C:\Elderguard\elderguard\fall_data")
VAL_SHARE = 0.2      # about 20% of the photos go to validation
SEED = 0
# ---------------------------------

CLASSES = ["fallen", "in_bed", "in_wheelchair", "upright"]
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp"}


def boxes_in(label_file, c, remap):
    """Number of boxes of our class c in one CVAT label file."""
    return sum(1 for row in label_file.read_text().split("\n")
               if len(row.split()) == 5 and remap[label_file][int(row.split()[0])] == c)


def video_of(stem):
    """room1_000150 -> room1 (photos from extract_frames.py). Other names count as their own video."""
    head, _, tail = stem.rpartition("_")
    return head if head and tail.isdigit() else stem


def main():
    exports = sorted(p.parent for p in CVAT_EXPORT.rglob("obj.names"))
    if not exports:
        raise SystemExit(f"No obj.names found inside {CVAT_EXPORT}. Unzip the CVAT export there.")
    remap, labels = {}, []   # label file -> {CVAT class id: our class id}
    for exp in exports:
        names = [n.strip() for n in (exp / "obj.names").read_text().splitlines() if n.strip()]
        unknown = [n for n in names if n not in CLASSES]
        if unknown:
            raise SystemExit(f"{exp.name}: CVAT has labels {unknown} that are not in {CLASSES}. Rename or delete "
                             f"them in CVAT (spelling and lowercase must match exactly) and export again.")
        ids = {i: CLASSES.index(n) for i, n in enumerate(names)}
        for l in sorted((exp / "obj_train_data").glob("*.txt")):
            remap[l] = ids
            labels.append(l)
        print(f"{exp.name}: {len(names)} labels, {sum(1 for l in labels if remap[l] is ids)} label files")

    images = {p.stem: p for folder in (IMAGES, CVAT_EXPORT) if folder.exists()
              for p in folder.rglob("*") if p.suffix.lower() in IMG_EXT}
    missing = [l.name for l in labels if l.stem not in images]
    if missing:
        print(f"WARNING: {len(missing)} labels have no matching photo and were skipped, e.g. {missing[:3]}")
    labels = [l for l in labels if l.stem in images]
    if not labels:
        raise SystemExit(f"No photo/label pairs found. Check IMAGES = {IMAGES}")

    # Group photos by video. Whole videos go to val (photos 0.5 s apart look almost the same, so
    # splitting a video would make the val score look too good), but never the only video of a label.
    groups = defaultdict(list)
    for l in labels:
        groups[video_of(l.stem)].append(l)
    boxes = {}   # video -> boxes per class
    for v, ls in groups.items():
        boxes[v] = [0] * len(CLASSES)
        for l in ls:
            for row in l.read_text().split("\n"):
                parts = row.split()
                if len(parts) == 5:
                    boxes[v][remap[l][int(parts[0])]] += 1
    total = [sum(b[c] for b in boxes.values()) for c in range(len(CLASSES))]
    vids = sorted(groups)
    random.Random(SEED).shuffle(vids)
    val, in_val, n_val = set(), [0] * len(CLASSES), 0
    for v in vids:
        if n_val >= VAL_SHARE * len(labels):
            break
        if any(boxes[v][c] and total[c] - in_val[c] - boxes[v][c] == 0 for c in range(len(CLASSES))):
            continue   # this video holds the last train examples of a label: keep it in train
        val.add(v)
        n_val += len(groups[v])
        in_val = [in_val[c] + boxes[v][c] for c in range(len(CLASSES))]
    split_of = {l: "val" if video_of(l.stem) in val else "train" for l in labels}

    # A label with no val boxes yet: move the last few of its photos in its biggest video to val.
    for c in range(len(CLASSES)):
        if total[c] == 0 or in_val[c] > 0:
            continue
        v = max((v for v in groups if v not in val and boxes[v][c]), key=lambda v: len(groups[v]))
        ls = [l for l in sorted(groups[v]) if boxes_in(l, c, remap)]   # its photos with this label
        if len(ls) < 3:
            continue
        moved = ls[-max(1, round(VAL_SHARE * len(ls))):]
        for l in moved:
            split_of[l] = "val"
        print(f"NOTE: '{CLASSES[c]}' had no val photos, so the last {len(moved)} '{CLASSES[c]}' photos of {v} went to val.")
        in_val = [sum(boxes_in(l, cc, remap) for l in labels if split_of[l] == "val")
                  for cc in range(len(CLASSES))]

    if OUT.exists():
        shutil.rmtree(OUT)
    counts = {s: [0] * len(CLASSES) for s in ("train", "val")}
    photos = {"train": 0, "val": 0}
    for l, split in split_of.items():
        img = images[l.stem]
        (OUT / "images" / split).mkdir(parents=True, exist_ok=True)
        (OUT / "labels" / split).mkdir(parents=True, exist_ok=True)
        shutil.copy2(img, OUT / "images" / split / img.name)
        lines = []
        for row in l.read_text().split("\n"):
            parts = row.split()
            if len(parts) == 5:
                c = remap[l][int(parts[0])]
                counts[split][c] += 1
                lines.append(" ".join([str(c)] + parts[1:]))
        (OUT / "labels" / split / (img.stem + ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""))
        photos[split] += 1

    yaml = [f"path: {OUT.as_posix()}", "train: images/train", "val: images/val", "", "names:"]
    yaml += [f"  {i}: {n}" for i, n in enumerate(CLASSES)]
    (OUT / "data.yaml").write_text("\n".join(yaml) + "\n")

    print(f"\n{'':15}{'train':>7}{'val':>7}")
    print(f"{'photos':15}{photos['train']:>7}{photos['val']:>7}")
    for i, n in enumerate(CLASSES):
        print(f"{n:15}{counts['train'][i]:>7}{counts['val'][i]:>7}")
        if counts["val"][i] == 0:
            print(f"   WARNING: no '{n}' boxes in val, so its score can't be measured")
    print(f"\nWrote {OUT / 'data.yaml'}")


if __name__ == "__main__":
    main()
