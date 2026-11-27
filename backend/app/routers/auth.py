import secrets
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import (
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
    create_access_token,
    is_owner,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

PASSWORD_MIN = 8


def _valida_chiesa(db: Session, chiesa_id) -> None:
    if chiesa_id is not None and db.get(models.Chiesa, chiesa_id) is None:
        raise HTTPException(status_code=400, detail="Chiesa non trovata")


@router.post("/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.Utente).filter(models.Utente.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password non corretti",
        )
    if not user.attivo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utente disattivato. Contattare l'amministratore.",
        )

    # Update last access
    user.ultimo_accesso = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return schemas.TokenResponse(
        access_token=token,
        token_type="bearer",
        user=schemas.UtenteResponse.model_validate(user),
    )


@router.get("/me", response_model=schemas.UtenteResponse)
def get_me(current_user: models.Utente = Depends(get_current_user)):
    return current_user


@router.put("/cambia-password")
def cambia_password(
    data: schemas.CambiaPasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(get_current_user),
):
    if not verify_password(data.password_attuale, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La password attuale non e' corretta",
        )
    nuova = data.nuova_password
    if len(nuova) < PASSWORD_MIN:
        raise HTTPException(status_code=400, detail=f"La nuova password deve avere almeno {PASSWORD_MIN} caratteri")
    if nuova == data.password_attuale:
        raise HTTPException(status_code=400, detail="La nuova password deve essere diversa da quella attuale")
    current_user.password_hash = hash_password(nuova)
    current_user.deve_cambiare_password = False
    current_user.password_cambiata_il = datetime.now(timezone.utc)
    db.commit()
    # Le altre sessioni (altri dispositivi) si chiudono; questa riceve un token nuovo
    token = create_access_token(
        data={"sub": str(current_user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"ok": True, "message": "Password aggiornata con successo", "access_token": token}


def _password_temporanea() -> str:
    # 12 caratteri senza simboli ambigui (0/O, 1/l/I), in tre gruppi facili da dettare
    alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"
    s = "".join(secrets.choice(alfabeto) for _ in range(12))
    return f"{s[:4]}-{s[4:8]}-{s[8:]}"


@router.post("/utenti/{utente_id}/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password_utente(
    utente_id: int,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(require_roles("admin")),
):
    """L'amministratore reimposta la password di un altro utente: viene generata una
    password provvisoria (mostrata una sola volta) che l'utente dovra' cambiare al
    primo accesso. Le sessioni aperte dell'utente vengono chiuse."""
    if utente_id == current_user.id:
        raise HTTPException(status_code=400, detail="Per la tua password usa \"Il mio account\"")
    user = db.query(models.Utente).filter(models.Utente.id == utente_id).first()
    if not user or is_owner(user):
        raise HTTPException(status_code=404, detail="Utente non trovato")
    pw = _password_temporanea()
    user.password_hash = hash_password(pw)
    user.deve_cambiare_password = True
    user.password_cambiata_il = datetime.now(timezone.utc)
    db.commit()
    return {"password_temporanea": pw}


@router.get("/utenti", response_model=List[schemas.UtenteResponse])
def list_utenti(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    utenti = db.query(models.Utente).order_by(models.Utente.cognome, models.Utente.nome).all()
    # L'account proprietario riservato non viene mai elencato.
    return [u for u in utenti if not is_owner(u)]


@router.post("/utenti", response_model=schemas.UtenteResponse, status_code=201)
def create_utente(
    data: schemas.UtenteCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    if len(data.password) < PASSWORD_MIN:
        raise HTTPException(status_code=400, detail=f"La password deve avere almeno {PASSWORD_MIN} caratteri")
    existing = db.query(models.Utente).filter(models.Utente.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email gia' in uso",
        )
    user = models.Utente(
        nome=data.nome,
        cognome=data.cognome,
        email=data.email,
        password_hash=hash_password(data.password),
        deve_cambiare_password=True,  # la password l'ha scelta l'amministratore
        ruolo=data.ruolo,
        chiesa_id=data.chiesa_id,
        attivo=True,
    )
    _valida_chiesa(db, data.chiesa_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/utenti/{utente_id}", response_model=schemas.UtenteResponse)
def update_utente(
    utente_id: int,
    data: schemas.UtenteUpdate,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(require_roles("admin")),
):
    user = db.query(models.Utente).filter(models.Utente.id == utente_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # L'account proprietario è invisibile e intoccabile: appare come inesistente.
    if is_owner(user) and not is_owner(current_user):
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # Cannot change own role
    if utente_id == current_user.id and data.ruolo is not None and data.ruolo != current_user.ruolo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non puoi cambiare il tuo stesso ruolo",
        )

    update_data = data.model_dump(exclude_unset=True)
    if "chiesa_id" in update_data:
        _valida_chiesa(db, update_data["chiesa_id"])
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/utenti/{utente_id}", status_code=200)
def delete_utente(
    utente_id: int,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(require_roles("admin")),
):
    if utente_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non puoi disattivare il tuo stesso account",
        )
    user = db.query(models.Utente).filter(models.Utente.id == utente_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # L'account proprietario non può essere disattivato/eliminato: appare inesistente.
    if is_owner(user):
        raise HTTPException(status_code=404, detail="Utente non trovato")

    user.attivo = False
    db.commit()
    return {"ok": True, "message": f"Utente {user.email} disattivato"}
