"""Live video for the monitoring screens (MON). The browser shows it with a plain image tag."""
import asyncio
import time

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from ..config import LIVE_CHECK_SECONDS, STREAM_FPS
from ..database import SessionDep, engine
from ..models import Camera
from ..security import CurrentUser, live_view_allowed, viewer_from_token
from ..vision import manager, placeholder

router = APIRouter(prefix="/api/cameras", tags=["live video"])


@router.get("/status")
def camera_status(session: SessionDep, user: CurrentUser):
    """Online or offline and the real frames per second of every camera (CAM-06, DASH cards)."""
    return [{"name": c.name, **manager.status(c.id)} for c in session.exec(select(Camera)).all()]


@router.get("/{camera_id}/stream")
async def stream(camera_id: int, token: str, request: Request):
    """MJPEG stream. An <img> tag can't send a login header, so the token comes in the link: ?token=..."""
    # A short database session just for the checks. A stream stays open for hours, so it must not
    # keep a database connection the whole time, or a few open dashboards would use them all up.
    with Session(engine) as session:
        if viewer_from_token(token, session) is None:
            raise HTTPException(401, "Session expired. Please log in again.")
        if session.get(Camera, camera_id) is None:
            raise HTTPException(404, "Camera not found.")

    async def frames():
        off = placeholder("Detection is off for this camera")
        next_check = time.monotonic() + LIVE_CHECK_SECONDS
        while not await request.is_disconnected():
            if time.monotonic() >= next_check:   # a stream stays open for hours: the login may have ended
                next_check = time.monotonic() + LIVE_CHECK_SECONDS
                if not await asyncio.to_thread(live_view_allowed, token):
                    return
            jpeg = manager.latest_jpeg(camera_id) or off
            yield b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpeg)).encode() \
                + b"\r\n\r\n" + jpeg + b"\r\n"
            await asyncio.sleep(1 / STREAM_FPS)

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/{camera_id}/snapshot")
def snapshot(camera_id: int, user: CurrentUser):
    """The newest picture as one JPEG (the Snapshot button on MON-02)."""
    jpeg = manager.latest_jpeg(camera_id)
    if jpeg is None:
        raise HTTPException(404, "This camera is not running.")
    return Response(jpeg, media_type="image/jpeg",
                    headers={"Content-Disposition": f'attachment; filename="camera_{camera_id}.jpg"'})