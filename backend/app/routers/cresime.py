from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, extract

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/cresime", tags=["cresime"])


@router.get("/", response_model=List[schemas.CresimaResponse])
def list_cresime(
    search: Optional[str] = Query(None),
    anno: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(models.Cresima)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Cresima.nome.ilike(term),
                models.Cresima.cognome.ilike(term),
                models.Cresima.ministro.ilike(term),
                models.Cresima.luogo_cresima.ilike(term),
            )
        )
    if anno:
        q = q.filter(extract("year", models.Cresima.data_cresima) == anno)
    return q.order_by(models.Cresima.data_cresima.desc()).offset(skip).limit(limit).all()


@router.get("/{cresima_id}", response_model=schemas.CresimaResponse)
def get_cresima(cresima_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Cresima).filter(models.Cresima.id == cresima_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cresima non trovata")
    return obj


@router.post("/", response_model=schemas.CresimaResponse, status_code=201)
def create_cresima(data: schemas.CresimaCreate, db: Session = Depends(get_db)):
    obj = models.Cresima(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{cresima_id}", response_model=schemas.CresimaResponse)
def update_cresima(cresima_id: int, data: schemas.CresimaUpdate, db: Session = Depends(get_db)):
    obj = db.query(models.Cresima).filter(models.Cresima.id == cresima_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cresima non trovata")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{cresima_id}", status_code=204)
def delete_cresima(cresima_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Cresima).filter(models.Cresima.id == cresima_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cresima non trovata")
    db.delete(obj)
    db.commit()
