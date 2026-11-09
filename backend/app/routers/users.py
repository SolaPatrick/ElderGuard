"""Admins manage staff accounts (the USR screens)."""
from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from ..database import SessionDep
from ..models import Role, User, UserCreate, UserPublic, UserUpdate, UserWithPassword
from ..security import AdminUser, hash_password, make_temporary_password

router = APIRouter(prefix="/api/users", tags=["users"])


def get_user_or_404(session, user_id: int) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")
    return user


def check_email_free(session, email: str | None, user_id: int | None = None):
    """Emails can be used to log in, so two accounts can't share one (upper or lower case)."""
    if email is None:
        return
    query = select(User).where(func.lower(User.email) == email.lower())
    if user_id is not None:
        query = query.where(User.id != user_id)
    if session.exec(query).first():
        raise HTTPException(409, "That email is already used by another account.")


@router.get("", response_model=list[UserPublic])
def list_users(session: SessionDep, admin: AdminUser, include_inactive: bool = True):
    query = select(User).order_by(User.full_name)
    if not include_inactive:
        query = query.where(User.is_active)
    return session.exec(query).all()


@router.post("", response_model=UserWithPassword, status_code=201)
def create_user(data: UserCreate, session: SessionDep, admin: AdminUser):
    """Creates the account with a temporary password. Show it to the admin once (USR-03)."""
    if session.exec(select(User).where(func.lower(User.username) == data.username.lower())).first():
        raise HTTPException(409, "That username is already taken.")
    check_email_free(session, data.email)
    temp = make_temporary_password()
    user = User.model_validate(data, update={"hashed_password": hash_password(temp)})
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserWithPassword(user=UserPublic.model_validate(user), temporary_password=temp)


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, session: SessionDep, admin: AdminUser):
    return get_user_or_404(session, user_id)


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(user_id: int, data: UserUpdate, session: SessionDep, admin: AdminUser):
    user = get_user_or_404(session, user_id)
    changes = data.model_dump(exclude_unset=True)
    check_email_free(session, changes.get("email"), user.id)
    if user.role == Role.admin and user.is_active and changes.get("role", Role.admin) != Role.admin:
        other_admins = session.exec(select(func.count()).select_from(User).where(
            User.role == Role.admin, User.is_active, User.id != user.id)).one()
        if not other_admins:
            raise HTTPException(409, "This is the only active admin. Make someone else an admin first.")
    user.sqlmodel_update(changes)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/{user_id}/deactivate", response_model=UserPublic)
def deactivate_user(user_id: int, session: SessionDep, admin: AdminUser):
    user = get_user_or_404(session, user_id)
    if user.id == admin.id:
        raise HTTPException(400, "You can't deactivate your own account.")
    user.is_active = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/{user_id}/reactivate", response_model=UserPublic)
def reactivate_user(user_id: int, session: SessionDep, admin: AdminUser):
    user = get_user_or_404(session, user_id)
    user.is_active = True
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=UserWithPassword)
def reset_password(user_id: int, session: SessionDep, admin: AdminUser):
    user = get_user_or_404(session, user_id)
    temp = make_temporary_password()
    user.hashed_password = hash_password(temp)
    user.must_change_password = True
    user.failed_logins, user.locked_until = 0, None
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserWithPassword(user=UserPublic.model_validate(user), temporary_password=temp)