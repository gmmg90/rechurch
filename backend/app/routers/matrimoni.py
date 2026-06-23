from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, extract

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/matrimoni", tags=["matrimoni"])


@router.get("/", response_model=List[schemas.MatrimonioResponse])
def list_matrimoni(
    search: Optional[str] = Query(None),
    anno: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Matrimonio)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Matrimonio.sposo_nome.ilike(term),
                models.Matrimonio.sposo_cognome.ilike(term),
                models.Matrimonio.sposa_nome.ilike(term),
                models.Matrimonio.sposa_cognome.ilike(term),
                models.Matrimonio.ministro.ilike(term),
                models.Matrimonio.luogo_matrimonio.ilike(term),
            )
        )
    if anno:
        q = q.filter(extract("year", models.Matrimonio.data_matrimonio) == anno)
    return q.order_by(models.Matrimonio.data_matrimonio.desc()).offset(skip).limit(limit).all()


@router.get("/{matrimonio_id}", response_model=schemas.MatrimonioResponse)
def get_matrimonio(
    matrimonio_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Matrimonio).filter(models.Matrimonio.id == matrimonio_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato")
    return obj


@router.post("/", response_model=schemas.MatrimonioResponse, status_code=201)
def create_matrimonio(
    data: schemas.MatrimonioCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = models.Matrimonio(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{matrimonio_id}", response_model=schemas.MatrimonioResponse)
def update_matrimonio(
    matrimonio_id: int,
    data: schemas.MatrimonioUpdate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Matrimonio).filter(models.Matrimonio.id == matrimonio_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{matrimonio_id}", status_code=204)
def delete_matrimonio(
    matrimonio_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Matrimonio).filter(models.Matrimonio.id == matrimonio_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato")
    db.delete(obj)
    db.commit()
