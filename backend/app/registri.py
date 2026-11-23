"""Numerazione dei registri dei sacramenti.

Ogni chiesa ha il proprio registro per ciascun sacramento, numerato da 1 ogni
anno (es. "San Rocco – Battesimi 2026 n. 12"). I sacramenti senza chiesa
formano il registro della parrocchia. Il numero viene assegnato in automatico
quando la segreteria lo lascia vuoto; se è scritto a mano, si controlla che non
sia già usato nello stesso registro.

L'anno del registro è ``anno_registro``; per i record importati che non lo
hanno si usa l'anno della data del sacramento.
"""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import and_, extract, or_
from sqlalchemy.orm import Session

from app import models

# tipo → (modello, colonna data del sacramento)
REGISTRI = {
    "battesimi": (models.Battesimo, "data_battesimo"),
    "comunioni": (models.Comunione, "data_comunione"),
    "cresime": (models.Cresima, "data_cresima"),
    "matrimoni": (models.Matrimonio, "data_matrimonio"),
}
_DATA_DI = {Model: data for Model, data in REGISTRI.values()}


def _stesso_registro(q, Model, chiesa_id: Optional[int], anno: int):
    data_col = getattr(Model, _DATA_DI[Model])
    q = q.filter(Model.chiesa_id == chiesa_id) if chiesa_id else q.filter(Model.chiesa_id.is_(None))
    return q.filter(or_(
        Model.anno_registro == anno,
        and_(Model.anno_registro.is_(None), extract("year", data_col) == anno),
    ))


def _come_intero(valore) -> Optional[int]:
    s = str(valore or "").strip()
    return int(s) if s.isdigit() else None


def prossimo_numero(db: Session, Model, chiesa_id: Optional[int], anno: int) -> int:
    numeri = _stesso_registro(db.query(Model.numero_registro), Model, chiesa_id, anno).all()
    massimo = max((n for (v,) in numeri if (n := _come_intero(v)) is not None), default=0)
    return massimo + 1


def anno_di(obj) -> Optional[int]:
    if obj.anno_registro:
        return int(obj.anno_registro)
    data = getattr(obj, _DATA_DI[type(obj)], None)
    return data.year if data else None


def assegna_numero(db: Session, obj, controlla_duplicati: bool = True) -> None:
    """Completa anno e numero di registro del record (prima del commit)."""
    anno = anno_di(obj)
    if anno is None:
        return
    obj.anno_registro = anno
    if not str(obj.numero_registro or "").strip():
        obj.numero_registro = str(prossimo_numero(db, type(obj), obj.chiesa_id, anno))
        return
    obj.numero_registro = str(obj.numero_registro).strip()
    if controlla_duplicati:
        _verifica_duplicato(db, obj, anno)


def _verifica_duplicato(db: Session, obj, anno: int) -> None:
    Model = type(obj)
    q = _stesso_registro(db.query(Model.id), Model, obj.chiesa_id, anno).filter(
        Model.numero_registro == obj.numero_registro
    )
    if obj.id is not None:
        q = q.filter(Model.id != obj.id)
    if q.first() is not None:
        libero = prossimo_numero(db, Model, obj.chiesa_id, anno)
        raise HTTPException(
            status_code=409,
            detail=(
                f"Il numero {obj.numero_registro} è già usato nel registro {anno} di questa chiesa. "
                f"Il prossimo numero libero è {libero} (lascia il campo vuoto per assegnarlo in automatico)."
            ),
        )


def chiave_registro(obj) -> tuple:
    """(numero, anno, chiesa) normalizzati: vuoto e None si equivalgono."""
    return (str(obj.numero_registro or "").strip(), obj.anno_registro or None, obj.chiesa_id or None)
