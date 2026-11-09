"""Log in, see who you are, change your password (the AUTH screens)."""
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, SQLModel, func, select

from ..config import LOCK_MINUTES, LOGIN_FAILS_PER_MINUTE, MAX_FAILED_LOGINS
from ..database import SessionDep
from ..models import User, UserPublic, now
from ..security import (LoggedInUser, create_token, hash_password, oauth2_scheme, revoke_token,
                        spend_password_check_time, verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginOut(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class PasswordChange(SQLModel):
    current_password: str
    new_password: str


class PasswordChanged(UserPublic):
    """The password change ends every older token, including the one used here, so this is the new one."""
    access_token: str
    token_type: str = "bearer"


class FailedLogins:
    """Failed logins per address in the last minute, across all accounts. Kept in memory: a restart clears it."""

    def __init__(self):
        self.times: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def wait_seconds(self, address: str) -> int:
        """0 if this address may try now, otherwise how long it must wait."""
        now_ = time.monotonic()
        with self.lock:
            times = self.times[address]
            while times and now_ - times[0] >= 60:
                times.popleft()
            if len(times) < LOGIN_FAILS_PER_MINUTE:
                if not times:
                    del self.times[address]
                return 0
            return int(60 - (now_ - times[0])) + 1

    def record(self, address: str):
        with self.lock:
            self.times[address].append(time.monotonic())


failed_logins = FailedLogins()


def find_user_to_log_in(session: Session, name: str) -> User | None:
    """A username match always wins. An email only counts if exactly one account has it."""
    user = session.exec(select(User).where(User.username == name)).first()
    if user is not None:
        return user
    matches = session.exec(select(User).where(func.lower(User.email) == name.lower())).all()
    return matches[0] if len(matches) == 1 else None


@router.post("/login", response_model=LoginOut)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep, request: Request):
    """Username OR email, plus password. Returns a token the website sends with every request."""
    address = request.client.host if request.client else "unknown"
    wait = failed_logins.wait_seconds(address)
    if wait:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Too many failed logins. Try again in {wait} seconds.",
                            headers={"Retry-After": str(wait)})
    user = find_user_to_log_in(session, form.username)
    wrong = HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password.")
    if user is None:
        spend_password_check_time(form.password)
        failed_logins.record(address)
        raise wrong
    if user.locked_until and user.locked_until > now():
        raise HTTPException(status.HTTP_423_LOCKED,
                            f"Too many wrong tries. Try again after {user.locked_until.astimezone():%I:%M %p}.")
    if not verify_password(form.password, user.hashed_password):
        failed_logins.record(address)
        if not user.is_active:     # only the right password learns that the account is deactivated
            raise wrong
        user.failed_logins += 1
        if user.failed_logins >= MAX_FAILED_LOGINS:
            user.locked_until = now() + timedelta(minutes=LOCK_MINUTES)
            user.failed_logins = 0
        session.add(user)
        session.commit()
        raise wrong
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")
    user.failed_logins, user.locked_until = 0, None
    session.add(user)
    session.commit()
    session.refresh(user)
    return LoginOut(access_token=create_token(user), user=UserPublic.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: Annotated[str, Depends(oauth2_scheme)], user: LoggedInUser, session: SessionDep):
    """Ends this login on the server, not just in the browser."""
    revoke_token(token, session)


@router.get("/me", response_model=UserPublic)
def me(user: LoggedInUser):
    return user


@router.post("/change-password", response_model=PasswordChanged)
def change_password(data: PasswordChange, user: LoggedInUser, session: SessionDep):
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is wrong.")
    if len(data.new_password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use at least 8 characters.")
    if data.new_password == data.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a different password.")
    user.hashed_password = hash_password(data.new_password)
    user.must_change_password = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return PasswordChanged.model_validate(user, update={"access_token": create_token(user)})