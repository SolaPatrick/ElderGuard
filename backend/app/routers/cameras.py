"""Cameras (the CAM screens). The live video and fall model come in step 7 (vision.py)."""
import cv2
from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from ..database import SessionDep
from ..models import Alert, Camera, CameraCreate, CameraOut, CameraUpdate, Role, Room, User, required_blur
from ..security import AdminUser, CurrentUser

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


def get_camera_or_404(session, camera_id: int) -> Camera:
    camera = session.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(404, "Camera not found.")
    return camera


def check_room(session, room_id: int | None):
    if room_id is not None and session.get(Room, room_id) is None:
        raise HTTPException(400, f"There is no room with id {room_id}.")


def open_source(source: str) -> cv2.VideoCapture:
    """Source "0", "1" ... = a camera plugged into this laptop. Anything else = an rtsp:// link or a video file."""
    return cv2.VideoCapture(int(source) if source.isdecimal() else source)


def camera_out(camera: Camera, user: User) -> CameraOut:
    update = {} if user.role == Role.admin else {"source": ""}
    return CameraOut.model_validate(camera, update=update)


@router.get("", response_model=list[CameraOut])
def list_cameras(session: SessionDep, user: CurrentUser, room_id: int | None = None):
    query = select(Camera).order_by(Camera.name)
    if room_id is not None:
        query = query.where(Camera.room_id == room_id)
    return [camera_out(c, user) for c in session.exec(query).all()]


@router.post("", response_model=Camera, status_code=201)
def create_camera(data: CameraCreate, session: SessionDep, admin: AdminUser):
    check_room(session, data.room_id)
    camera = Camera.model_validate(data)
    camera.privacy_blur = required_blur(camera.place, camera.privacy_blur)
    session.add(camera)
    session.commit()
    session.refresh(camera)
    return camera


@router.post("/test")
def test_source(source: str, admin: AdminUser):
    """Tries to read one picture from a camera before you register it (CAM-02 Testing)."""
    try:
        cap = open_source(source)
        ok, frame = cap.read()
        cap.release()
    except Exception:                  # OpenCV refuses some values outright, such as a huge camera number
        ok = False
    if not ok:
        raise HTTPException(400, "Can't read from this camera. Check the link, cable or file path. "
                                 "A camera that is already streaming may be busy.")
    h, w = frame.shape[:2]
    return {"ok": True, "width": w, "height": h}


@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, session: SessionDep, user: CurrentUser):
    return camera_out(get_camera_or_404(session, camera_id), user)


@router.patch("/{camera_id}", response_model=Camera)
def update_camera(camera_id: int, data: CameraUpdate, session: SessionDep, admin: AdminUser):
    camera = get_camera_or_404(session, camera_id)
    changes = data.model_dump(exclude_unset=True)
    check_room(session, changes.get("room_id"))
    camera.sqlmodel_update(changes)
    camera.privacy_blur = required_blur(camera.place, camera.privacy_blur)
    session.add(camera)
    session.commit()
    session.refresh(camera)
    return camera


@router.delete("/{camera_id}", status_code=204)
def delete_camera(camera_id: int, session: SessionDep, admin: AdminUser):
    """Blocked once the camera has alerts, so the incident history stays complete."""
    camera = get_camera_or_404(session, camera_id)
    alerts = session.exec(select(func.count()).select_from(Alert).where(Alert.camera_id == camera_id)).one()
    if alerts:
        raise HTTPException(409, f"This camera has {alerts} alert(s) in the incident history. "
                                 "Turn its detection off instead of deleting it.")
    session.delete(camera)
    session.commit()