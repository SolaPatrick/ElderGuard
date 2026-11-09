"""Residents (the RES screens). Everyone can view, only admins can change."""
from fastapi import APIRouter, HTTPException
from sqlmodel import col, select

from ..database import SessionDep
from ..models import Resident, ResidentCreate, ResidentUpdate, Room
from ..security import AdminUser, CurrentUser

router = APIRouter(prefix="/api/residents", tags=["residents"])


def get_resident_or_404(session, resident_id: int) -> Resident:
    resident = session.get(Resident, resident_id)
    if resident is None:
        raise HTTPException(404, "Resident not found.")
    return resident


def check_room(session, room_id: int | None):
    if room_id is not None and session.get(Room, room_id) is None:
        raise HTTPException(400, f"There is no room with id {room_id}.")


@router.get("", response_model=list[Resident])
def list_residents(session: SessionDep, user: CurrentUser, search: str | None = None,
                   room_id: int | None = None, archived: bool = False):
    query = select(Resident).where(Resident.is_archived == archived).order_by(Resident.full_name)
    if search:
        query = query.where(col(Resident.full_name).icontains(search, autoescape=True))  # any case, % is plain text
    if room_id is not None:
        query = query.where(Resident.room_id == room_id)
    return session.exec(query).all()


@router.post("", response_model=Resident, status_code=201)
def create_resident(data: ResidentCreate, session: SessionDep, admin: AdminUser):
    check_room(session, data.room_id)
    resident = Resident.model_validate(data)
    session.add(resident)
    session.commit()
    session.refresh(resident)
    return resident


@router.get("/{resident_id}", response_model=Resident)
def get_resident(resident_id: int, session: SessionDep, user: CurrentUser):
    return get_resident_or_404(session, resident_id)


@router.patch("/{resident_id}", response_model=Resident)
def update_resident(resident_id: int, data: ResidentUpdate, session: SessionDep, admin: AdminUser):
    resident = get_resident_or_404(session, resident_id)
    changes = data.model_dump(exclude_unset=True)
    check_room(session, changes.get("room_id"))
    resident.sqlmodel_update(changes)
    session.add(resident)
    session.commit()
    session.refresh(resident)
    return resident


@router.post("/{resident_id}/archive", response_model=Resident)
def archive_resident(resident_id: int, session: SessionDep, admin: AdminUser):
    resident = get_resident_or_404(session, resident_id)
    resident.is_archived = True
    session.add(resident)
    session.commit()
    session.refresh(resident)
    return resident


@router.post("/{resident_id}/restore", response_model=Resident)
def restore_resident(resident_id: int, session: SessionDep, admin: AdminUser):
    resident = get_resident_or_404(session, resident_id)
    resident.is_archived = False
    session.add(resident)
    session.commit()
    session.refresh(resident)
    return resident