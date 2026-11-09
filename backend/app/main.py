"""ElderGuard backend. Start it with:  fastapi dev app/main.py"""
import asyncio
import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, IntegrityError
from sqlmodel import Session

from . import config
from .database import create_tables, engine
from .realtime import hub
from .realtime import router as live_router
from .routers import alerts, auth, cameras, residents, rooms, stream, users
from .security import create_first_admin
from .vision import manager

SECRET_IN_LINK = re.compile(r"\b(token|source)=[^&\s\"']+")


class HideSecretsInLinks(logging.Filter):
    """Live video and alerts carry the login token in the link, and /api/cameras/test carries the
    camera link, so the server's request log would otherwise record them."""

    def filter(self, record: logging.LogRecord) -> bool:
        hide = lambda v: SECRET_IN_LINK.sub(r"\1=***", v) if isinstance(v, str) else v  # noqa: E731
        record.msg = hide(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(hide(a) for a in record.args)
        return True


for logger_name in ("uvicorn.access", "uvicorn.error"):
    logging.getLogger(logger_name).addFilter(HideSecretsInLinks())


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    with Session(engine) as session:
        create_first_admin(session)
    hub.loop = asyncio.get_running_loop()   # lets camera threads push alerts
    if config.START_CAMERAS:
        manager.start()                     # starts the fall model on every camera
    yield
    manager.stop_all()                      # runs once when the server stops


docs = {} if config.DOCS_ENABLED else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="ElderGuard API", lifespan=lifespan, **docs)


@app.exception_handler(DataError)
async def value_not_storable(request: Request, exc: DataError):
    """The database refused a value: a number too big or negative where it can't be, or a NUL character."""
    return JSONResponse({"detail": "A value is out of range or has characters that can't be stored."}, status_code=422)


@app.exception_handler(IntegrityError)
async def conflicts_with_existing(request: Request, exc: IntegrityError):
    """The database's own rules said no, for example two people creating the same username at the same moment."""
    return JSONResponse({"detail": "This conflicts with an existing record. Refresh and try again."}, status_code=409)


app.add_middleware(CORSMiddleware, allow_origins=config.FRONTEND_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(rooms.router)
app.include_router(residents.router)
app.include_router(stream.router)       # before cameras.router, so /api/cameras/status is not read as a camera id
app.include_router(cameras.router)
app.include_router(alerts.router)
app.include_router(live_router)


@app.get("/")
def home():
    return {"message": "ElderGuard API is running."}