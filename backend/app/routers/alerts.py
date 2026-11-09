"""Fall alerts and incident history (the ALT and INC screens).

An alert moves  new -> acknowledged -> classified -> resolved.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, SQLModel, col, func, select

from ..config import SNAPSHOT_DIR
from ..database import SessionDep
from ..models import (FALL_TYPES, Alert, AlertBase, AlertNote, AlertStatus, Camera, Classification, ClassifyIn,
                      FalseAlarmReason, NoteIn, Resident, Room, User, now)
from ..realtime import hub
from ..security import AdminUser, CurrentUser

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class NoteOut(SQLModel):
    id: int
    text: str
    author: str
    created_at: datetime


class AlertOut(AlertBase):
    """An alert plus the names the screens show next to it."""
    id: int
    camera_name: str = ""
    room_name: str = ""
    area: str = ""
    residents: list[str] = []
    snapshot_url: str | None = None
    notes: list[NoteOut] = []


def residents_in_room(session: Session, room_id: int | None) -> list[str]:
    if room_id is None:
        return []
    return list(session.exec(select(Resident.full_name).where(
        Resident.room_id == room_id, Resident.is_archived == False)  # noqa: E712
        .order_by(Resident.full_name)).all())


def alert_out(session: Session, alert: Alert) -> AlertOut:
    camera = session.get(Camera, alert.camera_id) if alert.camera_id else None
    room = session.get(Room, alert.room_id) if alert.room_id else None
    # Alerts older than residents_at_alert have no record, so the best available is who is in the room now.
    residents = alert.residents_at_alert if alert.residents_at_alert is not None \
        else residents_in_room(session, alert.room_id)
    notes = []
    for note, author in session.exec(select(AlertNote, User.full_name).join(User)
                                     .where(AlertNote.alert_id == alert.id).order_by(AlertNote.created_at)):
        notes.append(NoteOut(id=note.id, text=note.text, author=author, created_at=note.created_at))
    return AlertOut.model_validate(alert, update={
        "camera_name": camera.name if camera else "",
        "room_name": room.name if room else "",
        "area": room.area if room else "",
        "residents": list(residents),
        "snapshot_url": f"/api/alerts/{alert.id}/snapshot" if alert.snapshot else None,
        "notes": notes,
    })


def announce(kind: str, session: Session, alert: Alert):
    """Tells every open dashboard about the alert, through the hub from step 5."""
    hub.publish({"type": kind, "alert": alert_out(session, alert).model_dump(mode="json")})


def create_alert(session: Session, camera: Camera, fall_type: str, confidence: float,
                 jpeg: bytes | None, detected_at: datetime | None = None, is_test: bool = False) -> Alert:
    """Called by the camera worker (step 7) when the model confirms a fall."""
    alert = Alert(camera_id=camera.id, room_id=camera.room_id, fall_type=fall_type, confidence=confidence,
                  detected_at=detected_at or now(), is_test=is_test,
                  residents_at_alert=residents_in_room(session, camera.room_id))
    session.add(alert)
    session.commit()
    session.refresh(alert)
    if jpeg:
        try:
            SNAPSHOT_DIR.mkdir(exist_ok=True)
            name = f"alert_{alert.id}_{alert.detected_at:%Y%m%d_%H%M%S}.jpg"
            (SNAPSHOT_DIR / name).write_bytes(jpeg)
            alert.snapshot = name
            session.add(alert)
            session.commit()
            session.refresh(alert)
        except Exception as e:      # a missing picture must never stop staff from being told about a fall
            session.rollback()
            print(f"Alert {alert.id}: could not save the snapshot: {e}")
    announce("alert_new", session, alert)
    return alert


def get_alert_or_404(session, alert_id: int, lock: bool = False) -> Alert:
    """lock=True holds the row until commit: if two staff press the same button, the second waits and then sees
    the new status, so only one of them succeeds and the record of who responded stays right."""
    alert = session.get(Alert, alert_id, with_for_update=True if lock else None)
    if alert is None:
        raise HTTPException(404, "Alert not found.")
    return alert


def save(session, alert: Alert) -> AlertOut:
    session.add(alert)
    session.commit()
    session.refresh(alert)
    announce("alert_updated", session, alert)
    return alert_out(session, alert)


@router.get("", response_model=list[AlertOut])
def list_alerts(session: SessionDep, user: CurrentUser, status: AlertStatus | None = None,
                active: bool = False, camera_id: int | None = None, room_id: int | None = None,
                classification: Classification | None = None, date_from: datetime | None = None,
                date_to: datetime | None = None, limit: int = 100, offset: int = 0):
    """active=true gives the alert queue (everything not resolved). Without it: the incident history."""
    query = select(Alert).order_by(Alert.detected_at.desc())
    if active:
        query = query.where(Alert.status != AlertStatus.resolved)
    if status:
        query = query.where(Alert.status == status)
    if camera_id is not None:
        query = query.where(Alert.camera_id == camera_id)
    if room_id is not None:
        query = query.where(Alert.room_id == room_id)
    if classification:
        query = query.where(Alert.classification == classification)
    if date_from:
        query = query.where(Alert.detected_at >= date_from)
    if date_to:
        query = query.where(Alert.detected_at <= date_to)
    alerts = session.exec(query.offset(offset).limit(min(limit, 500))).all()
    return [alert_out(session, a) for a in alerts]


@router.get("/summary")
def summary(session: SessionDep, user: CurrentUser):
    """Numbers for the dashboard cards."""
    today = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0)  # local midnight
    today = today.astimezone(timezone.utc)
    count = lambda q: session.exec(select(func.count()).select_from(Alert).where(q)).one()  # noqa: E731
    real_today = (Alert.detected_at >= today) & col(Alert.is_test).is_(False)   # test alerts only count in the queue
    return {
        "active_alerts": count(Alert.status != AlertStatus.resolved),
        "new_alerts": count(Alert.status == AlertStatus.new),
        "falls_today": count(real_today         # a false alarm isn't a fall; not yet classified still counts
                             & col(Alert.classification).is_distinct_from(Classification.false_alarm)),
        "false_alarms_today": count(real_today & (Alert.classification == Classification.false_alarm)),
    }


@router.post("/test", response_model=AlertOut, status_code=201)
def test_alert(camera_id: int, session: SessionDep, admin: AdminUser, fall_type: str = "FALL FROM BED"):
    """Makes a pretend alert so you can test the screens without falling down (Toast: TestAlarm)."""
    camera = session.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(404, "Camera not found.")
    if fall_type not in FALL_TYPES:
        raise HTTPException(422, f"Pick one of: {', '.join(sorted(FALL_TYPES))}.")
    return alert_out(session, create_alert(session, camera, fall_type, 0.99, None, is_test=True))


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, session: SessionDep, user: CurrentUser):
    return alert_out(session, get_alert_or_404(session, alert_id))


@router.get("/{alert_id}/snapshot")
def get_snapshot(alert_id: int, session: SessionDep, user: CurrentUser):
    alert = get_alert_or_404(session, alert_id)
    if not alert.snapshot or not (SNAPSHOT_DIR / alert.snapshot).exists():
        raise HTTPException(404, "This alert has no snapshot.")
    return FileResponse(SNAPSHOT_DIR / alert.snapshot, media_type="image/jpeg")


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge(alert_id: int, session: SessionDep, user: CurrentUser):
    """Means "I'm on my way". Stops the alarm sound on every screen."""
    alert = get_alert_or_404(session, alert_id, lock=True)
    if alert.status != AlertStatus.new:
        raise HTTPException(409, f"This alert is already {alert.status.value}.")
    alert.status, alert.acknowledged_at, alert.acknowledged_by = AlertStatus.acknowledged, now(), user.id
    return save(session, alert)


@router.post("/{alert_id}/classify", response_model=AlertOut)
def classify(alert_id: int, data: ClassifyIn, session: SessionDep, user: CurrentUser):
    """Confirmed fall, or false alarm with a reason (ALT-03)."""
    alert = get_alert_or_404(session, alert_id, lock=True)
    if alert.status != AlertStatus.acknowledged:
        raise HTTPException(409, "Acknowledge the alert first." if alert.status == AlertStatus.new
                            else f"This alert is already {alert.status.value}.")
    if data.classification == Classification.false_alarm and data.false_alarm_reason is None:
        raise HTTPException(422, "Pick a reason for the false alarm.")
    if data.false_alarm_reason == FalseAlarmReason.other and not data.note.strip():
        raise HTTPException(422, "A note is required when the reason is Other.")
    alert.status, alert.classified_at, alert.classified_by = AlertStatus.classified, now(), user.id
    alert.classification = data.classification
    alert.false_alarm_reason = data.false_alarm_reason if data.classification == Classification.false_alarm else None
    if data.note.strip():
        session.add(AlertNote(alert_id=alert.id, user_id=user.id, text=data.note.strip()))
    return save(session, alert)


@router.post("/{alert_id}/resolve", response_model=AlertOut)
def resolve(alert_id: int, session: SessionDep, user: CurrentUser, data: NoteIn | None = None):
    """Closes the incident (ALT-04). An optional note says what was done."""
    alert = get_alert_or_404(session, alert_id, lock=True)
    if alert.status != AlertStatus.classified:
        raise HTTPException(409, "Classify the alert first." if alert.status != AlertStatus.resolved
                            else "This alert is already resolved.")
    alert.status, alert.resolved_at, alert.resolved_by = AlertStatus.resolved, now(), user.id
    if data and data.text.strip():
        session.add(AlertNote(alert_id=alert.id, user_id=user.id, text=data.text.strip()))
    return save(session, alert)


@router.post("/{alert_id}/notes", response_model=AlertOut)
def add_note(alert_id: int, data: NoteIn, session: SessionDep, user: CurrentUser):
    """Response notes (INC-05)."""
    alert = get_alert_or_404(session, alert_id)
    if not data.text.strip():
        raise HTTPException(422, "The note is empty.")
    session.add(AlertNote(alert_id=alert.id, user_id=user.id, text=data.text.strip()))
    return save(session, alert)