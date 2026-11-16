"""Cameras (the CAM screens). The live video and fall model come in step 7 (vision.py)."""
import cv2
from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from ..database import SessionDep
from ..models import (Alert, Camera, CameraCreate, CameraOut, CameraUpdate, Place, RestZone, RestZoneIn, Role,
                      Room, User, required_blur)
from ..security import AdminUser, CurrentUser

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

# Rest zones, the same rules as the web app (frontend/docs/api-contract.md, CAM-08)
MAX_REST_ZONES = 10
MAX_ZONE_NAME = 40
MIN_ZONE_SIZE = 0.02      # narrower or shorter than this share of the picture = a slip of the mouse
EPS = 1e-6                # rounding room for fractions sent by the browser


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
    for zone in session.exec(select(RestZone).where(RestZone.camera_id == camera_id)):
        session.delete(zone)          # a camera's rest zones go with it
    session.flush()                   # zones first: the database refuses to delete a camera that still has zones
    session.delete(camera)
    session.commit()


@router.get("/{camera_id}/zones", response_model=list[RestZone])
def list_zones(camera_id: int, session: SessionDep, user: CurrentUser):
    """The rest zones of one camera: places where lying down is normal (bed, floor mat, sofa)."""
    get_camera_or_404(session, camera_id)
    return session.exec(select(RestZone).where(RestZone.camera_id == camera_id)).all()


@router.put("/{camera_id}/zones", response_model=list[RestZone])
def replace_zones(camera_id: int, zones: list[RestZoneIn], session: SessionDep, admin: AdminUser):
    """Saves the camera's whole list of zones at once (what the drawing screen sends)."""
    camera = get_camera_or_404(session, camera_id)
    if camera.place == Place.bathroom and zones:
        raise HTTPException(409, "Bathroom cameras can't have rest zones: lying down there is always checked.")
    if len(zones) > MAX_REST_ZONES:
        raise HTTPException(400, f"A camera can have at most {MAX_REST_ZONES} rest zones.")
    for z in zones:
        z.name = z.name.strip()
        if not 1 <= len(z.name) <= MAX_ZONE_NAME:
            raise HTTPException(400, f"Each zone needs a name of 1 to {MAX_ZONE_NAME} characters.")
        if not (0 <= z.x1 and 0 <= z.y1 and z.x2 <= 1 + EPS and z.y2 <= 1 + EPS
                and z.x2 - z.x1 >= MIN_ZONE_SIZE - EPS and z.y2 - z.y1 >= MIN_ZONE_SIZE - EPS):
            raise HTTPException(400, f"Zone '{z.name}' must lie inside the picture and be at least "
                                     f"{MIN_ZONE_SIZE:.0%} of it wide and high.")
    for old in session.exec(select(RestZone).where(RestZone.camera_id == camera_id)):
        session.delete(old)
    session.flush()
    new = [RestZone(camera_id=camera_id, created_by=admin.id, **z.model_dump()) for z in zones]
    session.add_all(new)
    session.commit()
    for z in new:
        session.refresh(z)
    return new