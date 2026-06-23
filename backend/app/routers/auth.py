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
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])


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
    current_user.password_hash = hash_password(data.nuova_password)
    db.commit()
    return {"ok": True, "message": "Password aggiornata con successo"}


@router.get("/utenti", response_model=List[schemas.UtenteResponse])
def list_utenti(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    return db.query(models.Utente).order_by(models.Utente.cognome, models.Utente.nome).all()


@router.post("/utenti", response_model=schemas.UtenteResponse, status_code=201)
def create_utente(
    data: schemas.UtenteCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
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
        ruolo=data.ruolo,
        attivo=True,
    )
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

    # Cannot change own role
    if utente_id == current_user.id and data.ruolo is not None and data.ruolo != current_user.ruolo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non puoi cambiare il tuo stesso ruolo",
        )

    update_data = data.model_dump(exclude_unset=True)
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

    user.attivo = False
    db.commit()
    return {"ok": True, "message": f"Utente {user.email} disattivato"}
