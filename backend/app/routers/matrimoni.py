from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
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
    response: Response = None,
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

    total = q.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)

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


# ─── Anniversari prossimi ─────────────────────────────────────────────────────

@router.get("/anniversari-prossimi/")
def anniversari_prossimi(
    giorni: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    from datetime import date, timedelta
    today = date.today()

    matrimoni = (
        db.query(models.Matrimonio)
        .filter(models.Matrimonio.data_matrimonio.isnot(None))
        .all()
    )

    risultati = []
    for m in matrimoni:
        dm = m.data_matrimonio
        try:
            this_year = dm.replace(year=today.year)
        except (ValueError, AttributeError):
            continue

        prossimo = this_year if this_year >= today else (
            dm.replace(year=today.year + 1) if True else None
        )
        try:
            if this_year < today:
                prossimo = dm.replace(year=today.year + 1)
            else:
                prossimo = this_year
        except ValueError:
            continue

        days_until = (prossimo - today).days
        if 0 <= days_until <= giorni:
            anni = today.year - dm.year + (1 if prossimo.year > today.year else 0)
            risultati.append({
                "id": m.id,
                "sposo": f"{m.nome_sposo} {m.cognome_sposo}",
                "sposa": f"{m.nome_sposa} {m.cognome_sposa}",
                "data_matrimonio": dm.isoformat(),
                "giorni_mancanti": days_until,
                "anni": anni,
                "data_anniversario": prossimo.isoformat(),
            })

    risultati.sort(key=lambda x: x["giorni_mancanti"])
    return risultati
