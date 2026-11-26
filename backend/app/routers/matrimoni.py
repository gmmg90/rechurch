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

router = APIRouter(prefix="/matrimoni", tags=["matrimoni"])


@router.get("/", response_model=List[schemas.MatrimonioResponse])
def list_matrimoni(
    search: Optional[str] = Query(None),
    anno: Optional[int] = Query(None),
    chiesa_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    response: Response = None,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Matrimonio)
    q = filtra_query(q, models.Matrimonio, utente)
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
    if chiesa_id:
        q = q.filter(models.Matrimonio.chiesa_id == chiesa_id)
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
    utente: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Matrimonio).filter(models.Matrimonio.id == matrimonio_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato")
    verifica_record(obj, utente, "Matrimonio non trovato")
    return obj


@router.post("/", response_model=schemas.MatrimonioResponse, status_code=201)
def create_matrimonio(
    data: schemas.MatrimonioCreate,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = models.Matrimonio(**data.model_dump())
    forza_chiesa(obj, utente)
    applica_chiesa(db, obj, "luogo_matrimonio")
    assegna_numero(db, obj)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{matrimonio_id}", response_model=schemas.MatrimonioResponse)
def update_matrimonio(
    matrimonio_id: int,
    data: schemas.MatrimonioUpdate,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Matrimonio).filter(models.Matrimonio.id == matrimonio_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato")
    verifica_record(obj, utente, "Matrimonio non trovato")
    prima = chiave_registro(obj)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    forza_chiesa(obj, utente)
    applica_chiesa(db, obj, "luogo_matrimonio")
    # Numero di registro: si (ri)assegna/controlla solo se è cambiato qualcosa
    # del registro, così i dati storici importati restano come sono.
    if chiave_registro(obj) != prima:
        assegna_numero(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{matrimonio_id}", status_code=204)
def delete_matrimonio(
    matrimonio_id: int,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Matrimonio).filter(models.Matrimonio.id == matrimonio_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Matrimonio non trovato")
    verifica_record(obj, utente, "Matrimonio non trovato")
    db.delete(obj)
    db.commit()


# ─── Anniversari prossimi ─────────────────────────────────────────────────────

@router.get("/anniversari-prossimi/")
def anniversari_prossimi(
    giorni: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
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
        prossimo = None
        for anno in (today.year, today.year + 1):
            try:
                cand = dm.replace(year=anno)
            except ValueError:  # 29 febbraio in anno non bisestile -> 28 febbraio
                cand = dm.replace(year=anno, day=28)
            if cand >= today:
                prossimo = cand
                break
        if prossimo is None:
            continue

        days_until = (prossimo - today).days
        anni = prossimo.year - dm.year
        if 0 <= days_until <= giorni and anni > 0:
            risultati.append({
                "id": m.id,
                "sposo": f"{m.sposo_nome} {m.sposo_cognome}",
                "sposa": f"{m.sposa_nome} {m.sposa_cognome}",
                "data_matrimonio": dm.isoformat(),
                "giorni_mancanti": days_until,
                "anni": anni,
                "data_anniversario": prossimo.isoformat(),
            })

    risultati.sort(key=lambda x: x["giorni_mancanti"])
    return risultati
