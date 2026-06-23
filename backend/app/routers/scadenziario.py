from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/scadenziario", tags=["scadenziario"])


def _hydrate(ev: models.Evento, db: Session, occ_start: datetime = None, occ_end: datetime = None) -> schemas.EventoResponse:
    r = schemas.EventoResponse.model_validate(ev)
    if ev.categoria_id:
        cat = db.query(models.CategoriaEvento).filter(models.CategoriaEvento.id == ev.categoria_id).first()
        if cat:
            r.categoria_nome = cat.nome
            r.categoria_colore = cat.colore
    if occ_start:
        r.occurrence_start = occ_start
        r.occurrence_end = occ_end
    return r


def _expand_recurring(ev: models.Evento, dal: date, al: date) -> list[tuple[datetime, Optional[datetime]]]:
    """Return list of (start, end) datetimes for recurring event occurrences within [dal, al]."""
    occurrences = []
    ev_start = ev.data_inizio
    ev_end = ev.data_fine
    duration = (ev_end - ev_start) if ev_end else None

    recur_end = ev.ricorrenza_fine or al

    current = ev_start
    max_iter = 1000
    i = 0
    while current.date() <= min(recur_end, al) and i < max_iter:
        i += 1
        if current.date() >= dal:
            end = (current + duration) if duration else None
            occurrences.append((current, end))
        if ev.ricorrenza == 'giornaliera':
            current += timedelta(days=1)
        elif ev.ricorrenza == 'settimanale':
            current += timedelta(weeks=1)
        elif ev.ricorrenza == 'mensile':
            # Same day next month
            month = current.month + 1
            year = current.year
            if month > 12:
                month = 1
                year += 1
            try:
                current = current.replace(year=year, month=month)
            except ValueError:
                # Handle month-end edge case (e.g. Jan 31 -> Feb 28)
                import calendar
                last_day = calendar.monthrange(year, month)[1]
                current = current.replace(year=year, month=month, day=last_day)
        elif ev.ricorrenza == 'annuale':
            try:
                current = current.replace(year=current.year + 1)
            except ValueError:
                current = current.replace(year=current.year + 1, day=28)
        else:
            break
    return occurrences


# ─── Categorie ───────────────────────────────────────────────────────────────

@router.get("/categorie/", response_model=List[schemas.CategoriaEventoResponse])
def list_categorie(db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    return db.query(models.CategoriaEvento).order_by(models.CategoriaEvento.nome).all()

@router.post("/categorie/", response_model=schemas.CategoriaEventoResponse, status_code=201)
def create_categoria(data: schemas.CategoriaEventoCreate, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    obj = models.CategoriaEvento(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@router.put("/categorie/{id}", response_model=schemas.CategoriaEventoResponse)
def update_categoria(id: int, data: schemas.CategoriaEventoUpdate, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    obj = db.query(models.CategoriaEvento).filter(models.CategoriaEvento.id == id).first()
    if not obj: raise HTTPException(404, "Categoria non trovata")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

@router.delete("/categorie/{id}", status_code=204)
def delete_categoria(id: int, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    obj = db.query(models.CategoriaEvento).filter(models.CategoriaEvento.id == id).first()
    if not obj: raise HTTPException(404, "Categoria non trovata")
    db.delete(obj); db.commit()


# ─── Eventi ───────────────────────────────────────────────────────────────────

@router.get("/eventi/", response_model=List[schemas.EventoResponse])
def list_eventi(
    dal: Optional[date] = None,
    al: Optional[date] = None,
    categoria_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Evento)
    if categoria_id:
        q = q.filter(models.Evento.categoria_id == categoria_id)
    eventi = q.all()

    _dal = dal or date.today().replace(day=1)
    _al = al or (_dal.replace(month=_dal.month % 12 + 1, day=1) - timedelta(days=1))

    result = []
    for ev in eventi:
        if ev.ricorrenza:
            for occ_start, occ_end in _expand_recurring(ev, _dal, _al):
                result.append(_hydrate(ev, db, occ_start, occ_end))
        else:
            ev_date = ev.data_inizio.date()
            ev_end_date = ev.data_fine.date() if ev.data_fine else ev_date
            if ev_date <= _al and ev_end_date >= _dal:
                result.append(_hydrate(ev, db))

    result.sort(key=lambda e: e.occurrence_start or e.data_inizio)
    return result


@router.post("/eventi/", response_model=schemas.EventoResponse, status_code=201)
def create_evento(data: schemas.EventoCreate, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    obj = models.Evento(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return _hydrate(obj, db)


@router.get("/eventi/{id}", response_model=schemas.EventoResponse)
def get_evento(id: int, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    ev = db.query(models.Evento).filter(models.Evento.id == id).first()
    if not ev: raise HTTPException(404, "Evento non trovato")
    return _hydrate(ev, db)


@router.put("/eventi/{id}", response_model=schemas.EventoResponse)
def update_evento(id: int, data: schemas.EventoUpdate, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    ev = db.query(models.Evento).filter(models.Evento.id == id).first()
    if not ev: raise HTTPException(404, "Evento non trovato")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(ev, k, v)
    db.commit(); db.refresh(ev)
    return _hydrate(ev, db)


@router.delete("/eventi/{id}", status_code=204)
def delete_evento(id: int, db: Session = Depends(get_db), _: models.Utente = Depends(get_current_user)):
    ev = db.query(models.Evento).filter(models.Evento.id == id).first()
    if not ev: raise HTTPException(404, "Evento non trovato")
    db.delete(ev); db.commit()


@router.get("/prossimi/", response_model=List[schemas.EventoResponse])
def prossimi_eventi(
    giorni: int = 30,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    """Return upcoming events for the next N days — used by dashboard."""
    oggi = date.today()
    fine = oggi + timedelta(days=giorni)
    q = db.query(models.Evento)
    eventi = q.all()
    result = []
    for ev in eventi:
        if ev.ricorrenza:
            for occ_start, occ_end in _expand_recurring(ev, oggi, fine):
                result.append(_hydrate(ev, db, occ_start, occ_end))
        else:
            ev_date = ev.data_inizio.date()
            if oggi <= ev_date <= fine:
                result.append(_hydrate(ev, db))
    result.sort(key=lambda e: e.occurrence_start or e.data_inizio)
    return result[:20]
