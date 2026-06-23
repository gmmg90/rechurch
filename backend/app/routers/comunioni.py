from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, extract

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/comunioni", tags=["comunioni"])


@router.get("/", response_model=List[schemas.ComunioneResponse])
def list_comunioni(
    search: Optional[str] = Query(None),
    anno: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(models.Comunione)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Comunione.nome.ilike(term),
                models.Comunione.cognome.ilike(term),
                models.Comunione.ministro.ilike(term),
                models.Comunione.luogo_comunione.ilike(term),
            )
        )
    if anno:
        q = q.filter(extract("year", models.Comunione.data_comunione) == anno)
    return q.order_by(models.Comunione.data_comunione.desc()).offset(skip).limit(limit).all()


@router.get("/{comunione_id}", response_model=schemas.ComunioneResponse)
def get_comunione(comunione_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Comunione).filter(models.Comunione.id == comunione_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Comunione non trovata")
    return obj


@router.post("/", response_model=schemas.ComunioneResponse, status_code=201)
def create_comunione(data: schemas.ComunioneCreate, db: Session = Depends(get_db)):
    obj = models.Comunione(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{comunione_id}", response_model=schemas.ComunioneResponse)
def update_comunione(comunione_id: int, data: schemas.ComunioneUpdate, db: Session = Depends(get_db)):
    obj = db.query(models.Comunione).filter(models.Comunione.id == comunione_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Comunione non trovata")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{comunione_id}", status_code=204)
def delete_comunione(comunione_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Comunione).filter(models.Comunione.id == comunione_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Comunione non trovata")
    db.delete(obj)
    db.commit()
