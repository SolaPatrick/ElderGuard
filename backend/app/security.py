"""Password hashing, login tokens (JWT) and "who is calling?" checks."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from sqlalchemy import delete
from sqlalchemy.exc import DataError
from sqlmodel import Session, select

from .config import ALGORITHM, FIRST_ADMIN_USERNAME, SECRET_KEY, TOKEN_MINUTES
from .database import SessionDep, engine
from .models import RevokedToken, Role, User, now

password_hash = PasswordHash.recommended()       # Argon2, the algorithm the FastAPI docs recommend
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


NO_SUCH_USER_HASH = hash_password(secrets.token_hex(16))


def spend_password_check_time(password: str):
    """Called when a username doesn't exist, so that login takes as long as it does for a real account."""
    verify_password(password, NO_SUCH_USER_HASH)


def make_temporary_password() -> str:
    return secrets.token_urlsafe(9)               # 12 random characters


def password_stamp(user: User) -> str:
    """Goes inside each token. When the password changes this changes too, so older tokens stop working."""
    return hmac.new(SECRET_KEY.encode(), user.hashed_password.encode(), hashlib.sha256).hexdigest()[:32]


def create_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)
    return jwt.encode({"sub": str(user.id), "role": user.role.value, "pwd": password_stamp(user),
                       "jti": secrets.token_hex(16), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def revoke_token(token: str, session: Session):
    """Logging out: this one token stops working. Other devices stay logged in."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    session.exec(delete(RevokedToken).where(RevokedToken.expires_at < now()))   # no longer needed once expired
    session.add(RevokedToken(jti=payload["jti"], expires_at=datetime.fromtimestamp(payload["exp"], timezone.utc)))
    session.commit()


def user_from_token(token: str, session: Session) -> User | None:
    """Returns the active user a token belongs to, or None if the token is bad or expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = session.get(User, int(payload["sub"]))
        if session.get(RevokedToken, payload["jti"]) is not None:
            return None
    except (InvalidTokenError, KeyError, ValueError, DataError):
        return None
    if user is None or not user.is_active or not hmac.compare_digest(str(payload.get("pwd")), password_stamp(user)):
        return None
    return user


def viewer_from_token(token: str, session: Session) -> User | None:
    """For live video and alerts, where the token comes in the link: also blocks a temporary password."""
    user = user_from_token(token, session)
    return None if user is None or user.must_change_password else user


def live_view_allowed(token: str) -> bool:
    """Re-checks an open video stream or alert socket: expired, deactivated or reset logins are cut off.
    If the database can't answer, the connection stays: staff must not lose alerts during an outage."""
    try:
        with Session(engine) as session:
            return viewer_from_token(token, session) is not None
    except Exception as e:
        print(f"Could not re-check a live connection: {e}")
        return True


def get_logged_in_user(token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep) -> User:
    """Anyone with a valid token, even with a temporary password. Only for /me and change-password."""
    user = user_from_token(token, session)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Please log in again.",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


def get_current_user(user: Annotated[User, Depends(get_logged_in_user)]) -> User:
    if user.must_change_password:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Change your temporary password first.")
    return user


def get_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an admin can do this.")
    return user


LoggedInUser = Annotated[User, Depends(get_logged_in_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_admin)]


def create_first_admin(session: Session):
    """Creates the first admin account when the database has no users yet."""
    if session.exec(select(User)).first() is None:
        temporary = make_temporary_password()
        session.add(User(username=FIRST_ADMIN_USERNAME, full_name="Administrator", role=Role.admin,
                         hashed_password=hash_password(temporary), must_change_password=True))
        session.commit()
        print(f"Created the first admin account: {FIRST_ADMIN_USERNAME} / {temporary}  (shown only now, change it at first login)")