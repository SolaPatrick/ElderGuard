"""Rooms and monitoring areas (the ROOM screens)."""
from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from ..database import SessionDep
from ..models import Alert, Camera, Resident, Room, RoomCreate, RoomUpdate
from ..security import AdminUser, CurrentUser

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def get_room_or_404(session, room_id: int) -> Room:
    room = session.get(Room, room_id)
    if room is None:
        raise HTTPException(404, "Room not found.")
    return room


def check_name_free(session, name: str, area: str, room_id: int | None = None):
    """Two wings can each have a Room 101, but one area can't have it twice (upper or lower case)."""
    query = select(Room).where(func.lower(Room.name) == name.lower(), func.lower(Room.area) == area.lower())
    if room_id is not None:
        query = query.where(Room.id != room_id)
    if session.exec(query).first():
        raise HTTPException(409, f"This area already has a room called {name}.")


@router.get("", response_model=list[Room])
def list_rooms(session: SessionDep, user: CurrentUser, area: str | None = None):
    query = select(Room).order_by(Room.name)
    if area:
        query = query.where(Room.area == area)
    return session.exec(query).all()


@router.post("", response_model=Room, status_code=201)
def create_room(data: RoomCreate, session: SessionDep, admin: AdminUser):
    check_name_free(session, data.name, data.area)
    room = Room.model_validate(data)
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


@router.get("/{room_id}", response_model=Room)
def get_room(room_id: int, session: SessionDep, user: CurrentUser):
    return get_room_or_404(session, room_id)


@router.patch("/{room_id}", response_model=Room)
def update_room(room_id: int, data: RoomUpdate, session: SessionDep, admin: AdminUser):
    room = get_room_or_404(session, room_id)
    changes = data.model_dump(exclude_unset=True)
    check_name_free(session, changes.get("name", room.name), changes.get("area", room.area), room.id)
    room.sqlmodel_update(changes)
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, session: SessionDep, admin: AdminUser):
    """Blocked while residents or cameras are still assigned to the room (ROOM-04 Blocked),
    and once the room has alerts, so the incident history stays complete."""
    room = get_room_or_404(session, room_id)
    count = lambda model: session.exec(  # noqa: E731
        select(func.count()).select_from(model).where(model.room_id == room_id)).one()
    residents, cameras, alerts = count(Resident), count(Camera), count(Alert)
    if residents or cameras:
        raise HTTPException(409, f"Move {residents} resident(s) and {cameras} camera(s) "
                                 "out of this room first. Archived residents count too.")
    if alerts:
        raise HTTPException(409, f"This room has {alerts} alert(s) in the incident history, "
                                 "so it can't be deleted. Rename it instead.")
    session.delete(room)
    session.commit()