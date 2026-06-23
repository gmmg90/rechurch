from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/rubrica", tags=["rubrica"])


# ─── Helper ───────────────────────────────────────────────────────────────────

def _persona_to_response(p: models.Persona, db: Session) -> schemas.PersonaResponse:
    famiglia_cognome = None
    if p.famiglia_id:
        fam = db.query(models.Famiglia).filter(models.Famiglia.id == p.famiglia_id).first()
        if fam:
            famiglia_cognome = fam.cognome
    data = schemas.PersonaResponse.model_validate(p)
    data.famiglia_cognome = famiglia_cognome
    return data


# ─── Persone ──────────────────────────────────────────────────────────────────

@router.get("/persone/", response_model=List[schemas.PersonaResponse])
def list_persone(
    search: Optional[str] = Query(None),
    famiglia_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Persona)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Persona.nome.ilike(term),
                models.Persona.cognome.ilike(term),
                models.Persona.citta.ilike(term),
                models.Persona.telefono.ilike(term),
                models.Persona.email.ilike(term),
            )
        )
    if famiglia_id is not None:
        q = q.filter(models.Persona.famiglia_id == famiglia_id)
    persone = q.order_by(models.Persona.cognome, models.Persona.nome).offset(skip).limit(limit).all()
    return [_persona_to_response(p, db) for p in persone]


@router.post("/persone/", response_model=schemas.PersonaResponse, status_code=201)
def create_persona(
    data: schemas.PersonaCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = models.Persona(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _persona_to_response(obj, db)


@router.get("/persone/{persona_id}", response_model=schemas.PersonaDetail)
def get_persona(
    persona_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    p = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Persona non trovata")

    base = _persona_to_response(p, db)
    detail = schemas.PersonaDetail(**base.model_dump())

    # Load sacrament links
    links = db.query(models.PersonaSacramento).filter(
        models.PersonaSacramento.persona_id == persona_id
    ).all()

    for link in links:
        if link.tipo == "battesimo":
            batt = db.query(models.Battesimo).filter(models.Battesimo.id == link.sacramento_id).first()
            if batt:
                detail.battesimo = schemas.BattesimoResponse.model_validate(batt)
        elif link.tipo == "cresima":
            cres = db.query(models.Cresima).filter(models.Cresima.id == link.sacramento_id).first()
            if cres:
                detail.cresima = schemas.CresimaResponse.model_validate(cres)
        elif link.tipo == "matrimonio":
            mat = db.query(models.Matrimonio).filter(models.Matrimonio.id == link.sacramento_id).first()
            if mat:
                detail.matrimonio = schemas.MatrimonioResponse.model_validate(mat)
                detail.ruolo_matrimonio = link.ruolo

    return detail


@router.put("/persone/{persona_id}", response_model=schemas.PersonaResponse)
def update_persona(
    persona_id: int,
    data: schemas.PersonaUpdate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Persona non trovata")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _persona_to_response(obj, db)


@router.delete("/persone/{persona_id}", status_code=204)
def delete_persona(
    persona_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Persona non trovata")
    # Cascade links are handled by DB FK constraint (ondelete=CASCADE)
    db.delete(obj)
    db.commit()


# ─── Sacramento links ─────────────────────────────────────────────────────────

@router.post("/persone/{persona_id}/sacramento", status_code=201)
def link_sacramento(
    persona_id: int,
    data: schemas.PersonaSacramentoLink,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    p = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Persona non trovata")

    # Remove existing link of same tipo
    existing = db.query(models.PersonaSacramento).filter(
        models.PersonaSacramento.persona_id == persona_id,
        models.PersonaSacramento.tipo == data.tipo,
    ).first()
    if existing:
        db.delete(existing)

    link = models.PersonaSacramento(
        persona_id=persona_id,
        tipo=data.tipo,
        sacramento_id=data.sacramento_id,
        ruolo=data.ruolo,
    )
    db.add(link)
    db.commit()
    return {"ok": True}


@router.delete("/persone/{persona_id}/sacramento/{tipo}", status_code=204)
def unlink_sacramento(
    persona_id: int,
    tipo: str,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    link = db.query(models.PersonaSacramento).filter(
        models.PersonaSacramento.persona_id == persona_id,
        models.PersonaSacramento.tipo == tipo,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Collegamento non trovato")
    db.delete(link)
    db.commit()


# ─── Famiglie ─────────────────────────────────────────────────────────────────

@router.get("/famiglie/", response_model=List[schemas.FamigliaResponse])
def list_famiglie(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Famiglia)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Famiglia.cognome.ilike(term),
                models.Famiglia.citta.ilike(term),
            )
        )
    famiglie = q.order_by(models.Famiglia.cognome).offset(skip).limit(limit).all()

    result = []
    for fam in famiglie:
        count = db.query(func.count(models.Persona.id)).filter(
            models.Persona.famiglia_id == fam.id
        ).scalar() or 0
        fam_resp = schemas.FamigliaResponse.model_validate(fam)
        fam_resp.num_persone = count
        result.append(fam_resp)
    return result


@router.post("/famiglie/", response_model=schemas.FamigliaResponse, status_code=201)
def create_famiglia(
    data: schemas.FamigliaCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    obj = models.Famiglia(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    fam_resp = schemas.FamigliaResponse.model_validate(obj)
    fam_resp.num_persone = 0
    return fam_resp


@router.get("/famiglie/{famiglia_id}")
def get_famiglia(
    famiglia_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    fam = db.query(models.Famiglia).filter(models.Famiglia.id == famiglia_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Famiglia non trovata")

    persone = db.query(models.Persona).filter(
        models.Persona.famiglia_id == famiglia_id
    ).order_by(models.Persona.cognome, models.Persona.nome).all()

    fam_resp = schemas.FamigliaResponse.model_validate(fam)
    fam_resp.num_persone = len(persone)

    persone_list = [_persona_to_response(p, db) for p in persone]

    return {
        **fam_resp.model_dump(),
        "persone": [p.model_dump() for p in persone_list],
    }


@router.put("/famiglie/{famiglia_id}", response_model=schemas.FamigliaResponse)
def update_famiglia(
    famiglia_id: int,
    data: schemas.FamigliaUpdate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    fam = db.query(models.Famiglia).filter(models.Famiglia.id == famiglia_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Famiglia non trovata")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(fam, field, value)
    db.commit()
    db.refresh(fam)
    count = db.query(func.count(models.Persona.id)).filter(
        models.Persona.famiglia_id == famiglia_id
    ).scalar() or 0
    fam_resp = schemas.FamigliaResponse.model_validate(fam)
    fam_resp.num_persone = count
    return fam_resp


@router.delete("/famiglie/{famiglia_id}", status_code=204)
def delete_famiglia(
    famiglia_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    fam = db.query(models.Famiglia).filter(models.Famiglia.id == famiglia_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Famiglia non trovata")
    # Set persona.famiglia_id = NULL for members (DB handles SET NULL via FK)
    db.query(models.Persona).filter(models.Persona.famiglia_id == famiglia_id).update(
        {"famiglia_id": None}
    )
    db.delete(fam)
    db.commit()
