"""The database tables (table=True) and the shapes of data the API accepts and returns."""
import re
from datetime import datetime, timezone
from enum import Enum

from pydantic import field_validator
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def now() -> datetime:
    """The current time in UTC. The database stores every time in UTC; the website shows local time."""
    return datetime.now(timezone.utc)


def not_null(value):
    """For PATCH: leaving a field out means "keep it", but it can't be set to null if the database needs a value."""
    if value is None:
        raise ValueError("This can't be empty.")
    return value


def required_text(value):
    """Text the record can't do without: removes spaces around it and refuses blank or null."""
    not_null(value)
    if isinstance(value, str):
        value = value.strip()
        if not value:
            raise ValueError("This can't be blank.")
    return value


def clean_email(value):
    """A blank email means no email, so several people can have none."""
    if not isinstance(value, str):
        return value
    value = value.strip()
    if value and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
        raise ValueError("That doesn't look like an email address.")
    return value or None


def check_age(value):
    if isinstance(value, int) and not 0 <= value <= 130:
        raise ValueError("Age must be between 0 and 130.")
    return value


FALL_TYPES = {"FALL", "FALL FROM BED", "FALL FROM WHEELCHAIR", "LOSS OF BALANCE", "BATHROOM SLIP"}


# ---------- choices ----------
class Role(str, Enum):
    admin = "admin"
    employee = "employee"


class RiskLevel(str, Enum):
    low = "low"
    moderate = "moderate"
    high = "high"


class Place(str, Enum):
    room = "room"
    bathroom = "bathroom"


class Blur(str, Enum):
    off = "off"
    person = "person"
    whole = "whole"


class AlertStatus(str, Enum):
    new = "new"
    acknowledged = "acknowledged"
    classified = "classified"
    resolved = "resolved"


class Classification(str, Enum):
    confirmed = "confirmed"
    false_alarm = "false_alarm"


class FalseAlarmReason(str, Enum):
    sitting_down = "sitting_down"
    bending_or_kneeling = "bending_or_kneeling"
    object_or_pet = "object_or_pet"
    lighting_or_shadow = "lighting_or_shadow"
    other = "other"


# ---------- users ----------
class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    full_name: str
    email: str | None = Field(default=None, index=True)
    role: Role = Role.employee


class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str
    is_active: bool = True
    must_change_password: bool = True
    failed_logins: int = 0
    locked_until: datetime | None = None
    created_at: datetime = Field(default_factory=now)


class UserCreate(UserBase):
    _required_text = field_validator("username", "full_name", mode="before")(required_text)
    _clean_email = field_validator("email", mode="before")(clean_email)


class UserUpdate(SQLModel):
    full_name: str | None = None
    email: str | None = None
    role: Role | None = None

    _required_text = field_validator("full_name", mode="before")(required_text)
    _required = field_validator("role", mode="before")(not_null)
    _clean_email = field_validator("email", mode="before")(clean_email)


class UserPublic(UserBase):
    id: int
    is_active: bool
    must_change_password: bool
    created_at: datetime


class UserWithPassword(SQLModel):
    """Returned once, when an admin creates a user or resets a password."""
    user: UserPublic
    temporary_password: str


# ---------- rooms ----------
class RoomBase(SQLModel):
    name: str = Field(index=True)          # e.g. "Room 101"
    area: str = ""                         # e.g. "East Wing"


class Room(RoomBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class RoomCreate(RoomBase):
    _required_text = field_validator("name", mode="before")(required_text)


class RoomUpdate(SQLModel):
    name: str | None = None
    area: str | None = None

    _required_text = field_validator("name", mode="before")(required_text)
    _required = field_validator("area", mode="before")(not_null)


# ---------- residents ----------
class ResidentBase(SQLModel):
    full_name: str = Field(index=True)
    age: int | None = None
    risk_level: RiskLevel = RiskLevel.moderate
    room_id: int | None = Field(default=None, foreign_key="room.id")
    emergency_contact: str = ""
    notes: str = ""


class Resident(ResidentBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    is_archived: bool = False
    created_at: datetime = Field(default_factory=now)


class ResidentCreate(ResidentBase):
    _required_text = field_validator("full_name", mode="before")(required_text)
    _check_age = field_validator("age", mode="before")(check_age)


class ResidentUpdate(SQLModel):
    full_name: str | None = None
    age: int | None = None
    risk_level: RiskLevel | None = None
    room_id: int | None = None
    emergency_contact: str | None = None
    notes: str | None = None

    _required_text = field_validator("full_name", mode="before")(required_text)
    _required = field_validator("risk_level", "emergency_contact", "notes", mode="before")(not_null)
    _check_age = field_validator("age", mode="before")(check_age)


# ---------- cameras ----------
class CameraBase(SQLModel):
    name: str                              # e.g. "CAM-01"
    source: str                            # "0" = laptop webcam, an rtsp:// link, or a video file path
    room_id: int | None = Field(default=None, foreign_key="room.id")
    place: Place = Place.room              # "bathroom" turns a slip into BATHROOM SLIP
    privacy_blur: Blur = Blur.off          # bathrooms are always "whole", see required_blur
    detection_enabled: bool = True


class Camera(CameraBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=now)


class CameraOut(CameraBase):
    """What the API returns. The source is blank for non-admins: rtsp:// links often hold a password."""
    id: int
    created_at: datetime


class CameraCreate(CameraBase):
    _required_text = field_validator("name", "source", mode="before")(required_text)


def required_blur(place: Place, blur: Blur) -> Blur:
    """A bathroom camera always blurs the whole picture. "person" blur would show anyone the model misses."""
    return Blur.whole if place == Place.bathroom else blur


class CameraUpdate(SQLModel):
    name: str | None = None
    source: str | None = None
    room_id: int | None = None
    place: Place | None = None
    privacy_blur: Blur | None = None
    detection_enabled: bool | None = None

    _required_text = field_validator("name", "source", mode="before")(required_text)
    _required = field_validator("place", "privacy_blur", "detection_enabled", mode="before")(not_null)


# ---------- alerts ----------
class AlertBase(SQLModel):
    camera_id: int | None = Field(default=None, foreign_key="camera.id", index=True)
    room_id: int | None = Field(default=None, foreign_key="room.id")
    fall_type: str                         # FALL FROM BED, FALL FROM WHEELCHAIR, LOSS OF BALANCE, BATHROOM SLIP
    confidence: float = 0.0
    is_test: bool = False                  # made with the TestAlarm button: goes through the queue, not a real fall
    snapshot: str | None = None            # file name inside SNAPSHOT_DIR
    status: AlertStatus = Field(default=AlertStatus.new, index=True)
    detected_at: datetime = Field(default_factory=now, index=True)
    acknowledged_at: datetime | None = None
    acknowledged_by: int | None = Field(default=None, foreign_key="user.id")
    classification: Classification | None = None
    false_alarm_reason: FalseAlarmReason | None = None
    classified_at: datetime | None = None
    classified_by: int | None = Field(default=None, foreign_key="user.id")
    resolved_at: datetime | None = None
    resolved_by: int | None = Field(default=None, foreign_key="user.id")


class Alert(AlertBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Who was assigned to the room when the fall happened. NULL only on alerts older than this column.
    residents_at_alert: list[str] | None = Field(default=None, sa_column=Column(JSON(none_as_null=True)))


class AlertNote(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    alert_id: int = Field(foreign_key="alert.id", index=True)
    user_id: int = Field(foreign_key="user.id")
    text: str
    created_at: datetime = Field(default_factory=now)


class RevokedToken(SQLModel, table=True):
    """Tokens ended by logging out, kept until they would have expired anyway."""
    jti: str = Field(primary_key=True)
    expires_at: datetime = Field(index=True)


class ClassifyIn(SQLModel):
    classification: Classification
    false_alarm_reason: FalseAlarmReason | None = None
    note: str = ""


class NoteIn(SQLModel):
    text: str