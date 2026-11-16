"""Permanently deletes cameras together with their alerts and alert notes.

The web app refuses to remove a camera that has alerts, so the incident history stays complete.
Use this only for cameras whose alerts you don't need, such as looping test videos.

    1. Stop the backend first (Ctrl+C in its window). A running camera would keep adding alerts.
    2. From the backend folder:   ..\\.venv\\Scripts\\python.exe delete_cameras.py 1 2
       (the numbers are camera ids; run it with no numbers to list the cameras)
    3. Check what it will delete, then type DELETE to go ahead.

Before deleting, it saves everything it removes in backups\\deleted_cameras_<time>\\:
deleted.json (the rows) and the alert snapshot pictures, which are moved there, not erased.
"""
import argparse
import json
import shutil
import socket
import sys
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, col, func, select

from app.config import BASE_DIR, SNAPSHOT_DIR
from app.database import engine
from app.models import Alert, AlertNote, Camera, RestZone


def backend_running(port: int = 8000) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def rows(objs) -> list[dict]:
    return [o.model_dump(mode="json") for o in objs]


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Delete cameras with their alerts and notes (backed up first).")
    p.add_argument("camera_ids", nargs="*", type=int)
    p.add_argument("--snapshots", type=Path, default=SNAPSHOT_DIR, help=argparse.SUPPRESS)
    p.add_argument("--backups", type=Path, default=BASE_DIR / "backups", help=argparse.SUPPRESS)
    p.add_argument("--skip-backend-check", action="store_true", help=argparse.SUPPRESS)
    args = p.parse_args(argv)

    with Session(engine) as session:
        if not args.camera_ids:
            print("Cameras (id, name, source kind, alerts):")
            for cam in session.exec(select(Camera).order_by(Camera.id)):
                n = session.exec(select(func.count()).select_from(Alert).where(Alert.camera_id == cam.id)).one()
                kind = "webcam" if cam.source.strip().isdecimal() else "video file" \
                    if cam.source.lower().endswith((".mp4", ".avi", ".mov", ".mkv")) else "stream"
                print(f"  {cam.id}: {cam.name} ({kind}), {n} alerts")
            print("\nRun again with the ids to delete, e.g.  delete_cameras.py 1 2")
            return 0

        if not args.skip_backend_check and backend_running():
            print("The backend is still running on port 8000. Stop it first (Ctrl+C in its window), then run this again.")
            return 1

        cameras = [session.get(Camera, i) for i in args.camera_ids]
        missing = [i for i, c in zip(args.camera_ids, cameras) if c is None]
        if missing:
            print(f"No camera with id {', '.join(map(str, missing))}. Run without ids to see the list.")
            return 1

        ids = [c.id for c in cameras]
        alerts = list(session.exec(select(Alert).where(col(Alert.camera_id).in_(ids)).order_by(Alert.id)))
        alert_ids = [a.id for a in alerts]
        notes = list(session.exec(select(AlertNote).where(col(AlertNote.alert_id).in_(alert_ids)))) if alert_ids else []
        pictures = [args.snapshots / a.snapshot for a in alerts if a.snapshot and (args.snapshots / a.snapshot).exists()]
        zones = list(session.exec(select(RestZone).where(col(RestZone.camera_id).in_(ids))))

        print("This will PERMANENTLY delete from the database:")
        for cam in cameras:
            mine = [a for a in alerts if a.camera_id == cam.id]
            confirmed = sum(a.classification is not None and a.classification.value == "confirmed" for a in mine)
            print(f"  camera {cam.id} '{cam.name}': {len(mine)} alerts ({confirmed} confirmed falls)")
        print(f"  {len(notes)} alert notes, {len(zones)} rest zones")
        print(f"and move {len(pictures)} snapshot pictures into the backup folder.")
        if input("\nType DELETE to go ahead, anything else to cancel: ").strip() != "DELETE":
            print("Cancelled. Nothing was changed.")
            return 1

        backup = args.backups / f"deleted_cameras_{datetime.now():%Y%m%d_%H%M%S}"
        (backup / "snapshots").mkdir(parents=True)
        (backup / "deleted.json").write_text(json.dumps(
            {"cameras": rows(cameras), "alerts": rows(alerts), "alert_notes": rows(notes), "rest_zones": rows(zones)},
            indent=1), encoding="utf-8")

        for row in [*notes, *zones]:
            session.delete(row)
        session.flush()
        for alert in alerts:
            session.delete(alert)
        session.flush()               # notes, zones and alerts first: the database refuses a camera that still has them
        for cam in cameras:
            session.delete(cam)
        session.commit()      # all or nothing: if anything above failed, the database is unchanged

        for pic in pictures:
            shutil.move(str(pic), backup / "snapshots" / pic.name)
        print(f"Deleted {len(cameras)} camera(s), {len(alerts)} alerts and {len(notes)} notes.")
        print(f"Backup: {backup}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
