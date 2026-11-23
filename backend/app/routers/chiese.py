"""Chiese della parrocchia.

Una parrocchia può avere più chiese (parrocchiale, sussidiarie, rettorie,
cappelle). Ogni sacramento può essere collegato alla chiesa in cui è stato
celebrato tramite ``chiesa_id``; il campo testuale ``luogo_*`` resta quello
stampato sui certificati e, se vuoto, viene compilato col nome della chiesa.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_roles
from app.permessi import chiesa_utente
from app.registri import REGISTRI, prossimo_numero

router = APIRouter(prefix="/chiese", tags=["chiese"])

# (chiave, modello, attributo luogo) per i sacramenti collegabili a una chiesa
SACRAMENTI = (
    ("battesimi", models.Battesimo, "luogo_battesimo"),
    ("comunioni", models.Comunione, "luogo_comunione"),
    ("cresime", models.Cresima, "luogo_cresima"),
    ("matrimoni", models.Matrimonio, "luogo_matrimonio"),
)


def applica_chiesa(db: Session, obj, luogo_attr: Optional[str] = None) -> None:
    """Valida ``obj.chiesa_id`` e, se il luogo testuale è vuoto, lo compila col
    nome della chiesa. Da chiamare prima del commit in create/update."""
    chiesa_id = getattr(obj, "chiesa_id", None)
    if not chiesa_id:
        return
    chiesa = db.get(models.Chiesa, chiesa_id)
    if chiesa is None:
        raise HTTPException(status_code=400, detail="Chiesa non trovata")
    if luogo_attr and not (getattr(obj, luogo_attr, None) or "").strip():
        setattr(obj, luogo_attr, chiesa.nome)


def _get(db: Session, chiesa_id: int) -> models.Chiesa:
    obj = db.get(models.Chiesa, chiesa_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Chiesa non trovata")
    return obj


def _unica_principale(db: Session, obj: models.Chiesa) -> None:
    """Una sola chiesa può essere la parrocchiale."""
    if obj.principale:
        db.query(models.Chiesa).filter(models.Chiesa.id != obj.id).update(
            {models.Chiesa.principale: False}, synchronize_session=False
        )


@router.get("/prossimo-numero")
def get_prossimo_numero(
    tipo: str,
    anno: int,
    chiesa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    """Numero che verrà assegnato al prossimo sacramento nel registro
    (tipo, chiesa, anno). Serve al modulo per mostrarlo in anteprima."""
    if tipo not in REGISTRI:
        raise HTTPException(status_code=400, detail="Tipo non valido")
    cid = chiesa_utente(utente)
    if cid is not None:
        chiesa_id = cid
    Model, _data = REGISTRI[tipo]
    return {"tipo": tipo, "anno": anno, "chiesa_id": chiesa_id,
            "numero": prossimo_numero(db, Model, chiesa_id, anno)}


@router.get("/", response_model=List[schemas.ChiesaConUtilizzo])
def list_chiese(
    solo_attive: bool = False,
    db: Session = Depends(get_db),
    utente: models.Utente = Depends(get_current_user),
):
    q = db.query(models.Chiesa)
    # Un utente limitato vede solo la propria chiesa
    cid = chiesa_utente(utente)
    if cid is not None:
        q = q.filter(models.Chiesa.id == cid)
    if solo_attive:
        q = q.filter(models.Chiesa.attiva == True)  # noqa: E712
    chiese = q.order_by(
        models.Chiesa.principale.desc(), models.Chiesa.ordine, models.Chiesa.nome
    ).all()

    risultato = []
    for c in chiese:
        r = schemas.ChiesaConUtilizzo.model_validate(c)
        for chiave, Model, _luogo in SACRAMENTI:
            setattr(r, chiave, db.query(Model).filter(Model.chiesa_id == c.id).count())
        risultato.append(r)
    return risultato


@router.post("/", response_model=schemas.ChiesaResponse, status_code=201)
def create_chiesa(
    data: schemas.ChiesaCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    if not data.nome.strip():
        raise HTTPException(status_code=400, detail="Il nome è obbligatorio")
    obj = models.Chiesa(**data.model_dump())
    obj.nome = obj.nome.strip()
    # La prima chiesa inserita diventa automaticamente la parrocchiale
    if db.query(models.Chiesa).count() == 0:
        obj.principale = True
    db.add(obj)
    db.flush()
    _unica_principale(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{chiesa_id}", response_model=schemas.ChiesaResponse)
def update_chiesa(
    chiesa_id: int,
    data: schemas.ChiesaUpdate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    obj = _get(db, chiesa_id)
    valori = data.model_dump(exclude_unset=True)
    if "nome" in valori:
        valori["nome"] = (valori["nome"] or "").strip()
        if not valori["nome"]:
            raise HTTPException(status_code=400, detail="Il nome è obbligatorio")
    for field, value in valori.items():
        setattr(obj, field, value)
    _unica_principale(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{chiesa_id}", status_code=204)
def delete_chiesa(
    chiesa_id: int,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    obj = _get(db, chiesa_id)
    in_uso = sum(
        db.query(Model).filter(Model.chiesa_id == chiesa_id).count()
        for _k, Model, _l in SACRAMENTI
    )
    if in_uso:
        raise HTTPException(
            status_code=409,
            detail=f"La chiesa è collegata a {in_uso} sacramenti: disattivala invece di eliminarla",
        )
    # Eventi e movimenti restano, semplicemente senza chiesa
    for Model in (models.Evento, models.MovimentoContabile):
        db.query(Model).filter(Model.chiesa_id == chiesa_id).update(
            {Model.chiesa_id: None}, synchronize_session=False
        )
    db.delete(obj)
    db.commit()


@router.post("/{chiesa_id}/assegna-sacramenti")
def assegna_sacramenti(
    chiesa_id: int,
    data: schemas.AssegnaChiesaRequest,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    """Collega a questa chiesa i sacramenti senza chiesa (o tutti, con
    ``sovrascrivi``). Utile dopo l'import dall'archivio Access."""
    chiesa = _get(db, chiesa_id)
    risultato = {"chiesa": chiesa.nome}
    for chiave, Model, luogo_attr in SACRAMENTI:
        q = db.query(Model)
        if not data.sovrascrivi:
            q = q.filter(Model.chiesa_id.is_(None))
        valori = {Model.chiesa_id: chiesa.id}
        if data.aggiorna_luogo:
            valori[getattr(Model, luogo_attr)] = chiesa.nome
        risultato[chiave] = q.update(valori, synchronize_session=False)
    db.commit()
    return risultato
