from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

SECRET_KEY = os.getenv("SECRET_KEY", "changeme-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False so a missing token doesn't hard-fail: in desktop mode we
# transparently fall back to a local admin user instead of demanding a login.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def auth_disabled() -> bool:
    """True when running as a local desktop app with login turned off.

    Enabled by the launcher (RECHURCH_DESKTOP=1) or explicitly via AUTH_DISABLED=1.
    In this mode every protected endpoint acts as a local admin — no token needed.
    When the same backend is exposed remotely, leave these unset so auth is enforced.
    """
    return (
        os.getenv("AUTH_DISABLED", "").lower() in ("1", "true", "yes")
        or os.getenv("RECHURCH_DESKTOP", "").lower() in ("1", "true", "yes")
    )


def _local_admin(db: Session) -> models.Utente:
    """Return (creating if needed) the implicit local admin used in desktop mode."""
    user = (
        db.query(models.Utente)
        .filter(models.Utente.ruolo == "admin")
        .order_by(models.Utente.id)
        .first()
    )
    if user is not None:
        return user
    user = models.Utente(
        nome="Amministratore",
        cognome="Locale",
        email="admin@locale",
        password_hash=hash_password("admin"),
        ruolo="admin",
        attivo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.Utente:
    # Desktop mode: no login required, act as the local admin.
    if auth_disabled():
        return _local_admin(db)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token non valido o scaduto",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[int] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.Utente).filter(models.Utente.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    if not user.attivo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utente disattivato",
        )
    return user


def require_roles(*roles: str) -> Callable:
    """Returns a FastAPI dependency that checks the current user has one of the given roles."""
    def dependency(current_user: models.Utente = Depends(get_current_user)) -> models.Utente:
        if current_user.ruolo not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accesso negato. Ruolo richiesto: {', '.join(roles)}",
            )
        return current_user
    return dependency
