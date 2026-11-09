"""Pushes new and changed alerts to every open dashboard instantly (the SH-05 popup)."""
import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlmodel import Session

from .database import engine
from .security import live_view_allowed, viewer_from_token


class AlertHub:
    def __init__(self):
        self.clients: dict[WebSocket, str] = {}     # open socket -> its login token
        self.loop: asyncio.AbstractEventLoop | None = None   # set when the app starts (main.py)

    async def broadcast(self, message: dict):
        for ws, token in list(self.clients.items()):
            try:
                if not await asyncio.to_thread(live_view_allowed, token):
                    self.clients.pop(ws, None)      # deactivated, reset or expired: no more resident alerts
                    await ws.close(code=status.WS_1008_POLICY_VIOLATION)
                    continue
                await ws.send_json(message)
            except Exception:
                self.clients.pop(ws, None)          # that browser tab was closed

    def publish(self, message: dict):
        """Safe to call from anywhere: an API route or a camera thread."""
        if self.loop is not None:
            asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)


hub = AlertHub()
router = APIRouter(tags=["live"])


@router.websocket("/ws/alerts")
async def alerts_socket(websocket: WebSocket, token: str):
    """The website connects to ws://127.0.0.1:8000/ws/alerts?token=<login token>."""
    with Session(engine) as session:
        user = viewer_from_token(token, session)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    hub.clients[websocket] = token
    await websocket.send_json({"type": "hello", "user": user.full_name})
    try:
        while True:
            await websocket.receive_text()          # we don't expect messages; this waits for a disconnect
    except WebSocketDisconnect:
        pass
    finally:
        hub.clients.pop(websocket, None)