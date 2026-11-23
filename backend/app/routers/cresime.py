from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, extract

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.routers.chiese import applica_chiesa
from app.permessi import filtra_query, forza_chiesa, verifica_record
from app.registri import assegna_numero, chiave_registro

router = APIRouter(prefix="/cresime", tags=["cresime"])


@router.get("/", response_model=List[schemas.CresimaResponse])
def list_cresime(
    search: Optional[str] = Query(None),
    anno: Optional[int] = Query(None),
    chiesa_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    response: Response = None,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Cresima)
    q = filtra_query(q, models.Cresima, utente)
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
    if chiesa_id:
        q = q.filter(models.Cresima.chiesa_id == chiesa_id)
    if anno:
        q = q.filter(extract("year", models.Cresima.data_cresima) == anno)

    total = q.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    return q.order_by(models.Cresima.data_cresima.desc()).offset(skip).limit(limit).all()


@router.get("/{cresima_id}", response_model=schemas.CresimaResponse)
def get_cresima(
    cresima_id: int,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Cresima).filter(models.Cresima.id == cresima_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cresima non trovata")
    verifica_record(obj, utente, "Cresima non trovata")
    return obj


@router.post("/", response_model=schemas.CresimaResponse, status_code=201)
def create_cresima(
    data: schemas.CresimaCreate,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = models.Cresima(**data.model_dump())
    forza_chiesa(obj, utente)
    applica_chiesa(db, obj, "luogo_cresima")
    assegna_numero(db, obj)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{cresima_id}", response_model=schemas.CresimaResponse)
def update_cresima(
    cresima_id: int,
    data: schemas.CresimaUpdate,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Cresima).filter(models.Cresima.id == cresima_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cresima non trovata")
    verifica_record(obj, utente, "Cresima non trovata")
    prima = chiave_registro(obj)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    forza_chiesa(obj, utente)
    applica_chiesa(db, obj, "luogo_cresima")
    # Numero di registro: si (ri)assegna/controlla solo se è cambiato qualcosa
    # del registro, così i dati storici importati restano come sono.
    if chiave_registro(obj) != prima:
        assegna_numero(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{cresima_id}", status_code=204)
def delete_cresima(
    cresima_id: int,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Cresima).filter(models.Cresima.id == cresima_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cresima non trovata")
    verifica_record(obj, utente, "Cresima non trovata")
    db.delete(obj)
    db.commit()
