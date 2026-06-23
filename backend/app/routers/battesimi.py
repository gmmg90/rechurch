from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, extract

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/battesimi", tags=["battesimi"])


@router.get("/", response_model=List[schemas.BattesimoResponse])
def list_battesimi(
    search: Optional[str] = Query(None),
    anno: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Battesimo)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Battesimo.nome.ilike(term),
                models.Battesimo.cognome.ilike(term),
                models.Battesimo.ministro.ilike(term),
                models.Battesimo.luogo_battesimo.ilike(term),
            )
        )
    if anno:
        q = q.filter(extract("year", models.Battesimo.data_battesimo) == anno)
    return q.order_by(models.Battesimo.data_battesimo.desc()).offset(skip).limit(limit).all()


@router.get("/{battesimo_id}", response_model=schemas.BattesimoResponse)
def get_battesimo(
    battesimo_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Battesimo).filter(models.Battesimo.id == battesimo_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Battesimo non trovato")
    return obj


@router.post("/", response_model=schemas.BattesimoResponse, status_code=201)
def create_battesimo(
    data: schemas.BattesimoCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = models.Battesimo(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{battesimo_id}", response_model=schemas.BattesimoResponse)
def update_battesimo(
    battesimo_id: int,
    data: schemas.BattesimoUpdate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Battesimo).filter(models.Battesimo.id == battesimo_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Battesimo non trovato")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{battesimo_id}", status_code=204)
def delete_battesimo(
    battesimo_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Battesimo).filter(models.Battesimo.id == battesimo_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Battesimo non trovato")
    db.delete(obj)
    db.commit()
