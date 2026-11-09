"""All the settings of the ElderGuard backend in one place. Change them here."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent      # the backend folder
load_dotenv(BASE_DIR / ".env")                         # secrets live in backend/.env, never in this file


def required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Copy backend/.env.example to backend/.env and fill it in.")
    return value


# Database:
DATABASE_URL = required("ELDERGUARD_DB")

# Where fall snapshots are saved
SNAPSHOT_DIR = BASE_DIR / "snapshots"

# Your trained fall model from the training tutorial (step 8)
MODEL_PATH = os.getenv("ELDERGUARD_MODEL", r"C:\Elderguard\elderguard\runs\fall\weights\best.pt")

# Login tokens. Changing this key logs everyone out.
SECRET_KEY = required("ELDERGUARD_SECRET")
ALGORITHM = "HS256"
TOKEN_MINUTES = 8 * 60            # a login lasts one 8-hour shift
MAX_FAILED_LOGINS = 5             # wrong passwords in a row before the account is locked
LOCK_MINUTES = 15
LOGIN_FAILS_PER_MINUTE = 30       # failed logins from one address, across all accounts, before it must wait

# The /docs pages describe every route, so they are off unless ELDERGUARD_DOCS=1 is set in backend/.env
DOCS_ENABLED = os.getenv("ELDERGUARD_DOCS", "0") == "1"

# The first admin account, created only when the database has no users yet.
# It gets a random temporary password, printed once on the console.
FIRST_ADMIN_USERNAME = "admin"

# The website that is allowed to call this API (the frontend dev server)
FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

# Live monitoring
START_CAMERAS = os.getenv("ELDERGUARD_START_CAMERAS", "1") == "1"   # run the fall model on start-up
PROCESS_FPS = 10                  # frames per second the model checks on each camera
STREAM_FPS = 10                   # frames per second sent to the browser
LIVE_CHECK_SECONDS = 2            # how often an open video stream re-checks that its login is still allowed
JPEG_QUALITY = 70                 # 0-100, lower = smaller and faster stream
DUPLICATE_COOLDOWN_SECONDS = 60   # a person re-found at the same spot within this time is not a new fall
ALERT_RETRY_SECONDS = 5           # how often to retry saving an alert while the database is down
WORKER_RESTART_SECONDS = 5        # wait this long before restarting a camera's monitoring after an error
DEVICE = os.getenv("ELDERGUARD_DEVICE", "0")   # "0" = your RTX 3050, "cpu" = no GPU