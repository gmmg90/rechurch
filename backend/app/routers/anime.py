"""
Vista aggregata "Anime": una persona può comparire come soggetto di battesimo,
cresima e/o come sposo/sposa di un matrimonio. Aggreghiamo i record che si
riferiscono alla stessa persona usando come chiave (nome + cognome + data_nascita).
"""
import base64
import json
import re
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/anime", tags=["anime"])


# ─── Normalizzazione e chiave ─────────────────────────────────────────────────

_WS = re.compile(r"\s+")


def _norm(value: Optional[str]) -> str:
    if not value:
        return ""
    return _WS.sub(" ", value.strip()).lower()


def _key(nome: Optional[str], cognome: Optional[str], data_nascita: Optional[date]) -> str:
    d = data_nascita.isoformat() if data_nascita else ""
    return f"{_norm(nome)}|{_norm(cognome)}|{d}"


def _encode_id(key: str) -> str:
    return base64.urlsafe_b64encode(key.encode("utf-8")).decode("ascii").rstrip("=")


def _decode_id(anima_id: str) -> str:
    padding = 4 - (len(anima_id) % 4)
    return base64.urlsafe_b64decode(anima_id + "=" * (padding % 4)).decode("utf-8")


def _title(value: Optional[str]) -> str:
    if not value:
        return ""
    # Mantiene il display originale (probabilmente già MAIUSCOLO nei dati)
    return value.strip()


# ─── Aggregazione ─────────────────────────────────────────────────────────────

def _build_anime_index(db: Session) -> Dict[str, Dict[str, Any]]:
    """
    Costruisce l'indice delle anime aggregando battesimi, cresime, matrimoni.
    """
    anime: Dict[str, Dict[str, Any]] = {}

    def get_or_create(nome: str, cognome: str, data_nascita: Optional[date],
                      luogo_nascita: Optional[str]) -> Dict[str, Any]:
        k = _key(nome, cognome, data_nascita)
        if k not in anime:
            anime[k] = {
                "key": k,
                "nome": _title(nome),
                "cognome": _title(cognome),
                "data_nascita": data_nascita,
                "luogo_nascita": _title(luogo_nascita) if luogo_nascita else None,
                "battesimi": [],
                "comunioni": [],
                "cresime": [],
                "matrimoni": [],
            }
        else:
            # Mantieni il primo luogo_nascita non nullo trovato
            if luogo_nascita and not anime[k]["luogo_nascita"]:
                anime[k]["luogo_nascita"] = _title(luogo_nascita)
        return anime[k]

    for b in db.query(models.Battesimo).all():
        a = get_or_create(b.nome, b.cognome, b.data_nascita, b.luogo_nascita)
        a["battesimi"].append(b.id)

    for co in db.query(models.Comunione).all():
        a = get_or_create(co.nome, co.cognome, co.data_nascita, co.luogo_nascita)
        a["comunioni"].append(co.id)

    for c in db.query(models.Cresima).all():
        a = get_or_create(c.nome, c.cognome, c.data_nascita, c.luogo_nascita)
        a["cresime"].append(c.id)

    for m in db.query(models.Matrimonio).all():
        a_sposo = get_or_create(m.sposo_nome, m.sposo_cognome, None, None)
        a_sposo["matrimoni"].append(m.id)
        a_sposa = get_or_create(m.sposa_nome, m.sposa_cognome, None, None)
        a_sposa["matrimoni"].append(m.id)

    # ── Merge "fuzzy" ─────────────────────────────────────────────────────────
    # Per ogni anima senza data_nascita, prova a unirla con anima(e) con stessa
    # (nome, cognome) e data_nascita valorizzata. Se ne trovo UNA sola, fondo.
    by_namecog: Dict[tuple, List[str]] = {}
    for k, a in anime.items():
        nc = (_norm(a["nome"]), _norm(a["cognome"]))
        by_namecog.setdefault(nc, []).append(k)

    to_remove = []
    for nc, keys in by_namecog.items():
        if len(keys) < 2:
            continue
        no_date = [k for k in keys if anime[k]["data_nascita"] is None]
        with_date = [k for k in keys if anime[k]["data_nascita"] is not None]
        # Fondo solo se c'è un'unica anima con data → ambiguità altrimenti
        if len(with_date) == 1 and no_date:
            target = anime[with_date[0]]
            for k in no_date:
                src = anime[k]
                # Unisci ID univoci
                target["battesimi"] = sorted(set(target["battesimi"] + src["battesimi"]))
                target["comunioni"] = sorted(set(target["comunioni"] + src["comunioni"]))
                target["cresime"] = sorted(set(target["cresime"] + src["cresime"]))
                target["matrimoni"] = sorted(set(target["matrimoni"] + src["matrimoni"]))
                if not target["luogo_nascita"] and src["luogo_nascita"]:
                    target["luogo_nascita"] = src["luogo_nascita"]
                to_remove.append(k)

    for k in to_remove:
        anime.pop(k, None)

    return anime


def _serialize(a: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": _encode_id(a["key"]),
        "nome": a["nome"],
        "cognome": a["cognome"],
        "data_nascita": a["data_nascita"].isoformat() if a["data_nascita"] else None,
        "luogo_nascita": a["luogo_nascita"],
        "battesimi_count": len(a["battesimi"]),
        "comunioni_count": len(a["comunioni"]),
        "cresime_count": len(a["cresime"]),
        "matrimoni_count": len(a["matrimoni"]),
        "total_sacramenti": len(a["battesimi"]) + len(a["comunioni"]) + len(a["cresime"]) + len(a["matrimoni"]),
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
def list_anime(
    search: Optional[str] = Query(None, description="Cerca per nome o cognome"),
    has_battesimo: Optional[bool] = Query(None),
    has_comunione: Optional[bool] = Query(None),
    has_cresima: Optional[bool] = Query(None),
    has_matrimonio: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    anime = _build_anime_index(db)
    items = list(anime.values())

    # Filtri
    if search:
        s = _norm(search)
        items = [a for a in items if s in _norm(a["nome"]) or s in _norm(a["cognome"])]
    if has_battesimo is not None:
        items = [a for a in items if bool(a["battesimi"]) == has_battesimo]
    if has_cresima is not None:
        items = [a for a in items if bool(a["cresime"]) == has_cresima]
    if has_matrimonio is not None:
        items = [a for a in items if bool(a["matrimoni"]) == has_matrimonio]
    if has_comunione is not None:
        items = [a for a in items if bool(a["comunioni"]) == has_comunione]

    # Ordina per cognome, nome
    items.sort(key=lambda a: (_norm(a["cognome"]), _norm(a["nome"])))

    total = len(items)
    paged = items[skip: skip + limit]
    return {
        "total": total,
        "items": [_serialize(a) for a in paged],
    }


@router.get("/{anima_id}")
def get_anima(anima_id: str, db: Session = Depends(get_db)):
    try:
        key = _decode_id(anima_id)
    except Exception:
        raise HTTPException(400, "ID anima non valido")

    anime = _build_anime_index(db)
    if key not in anime:
        raise HTTPException(404, "Anima non trovata")

    a = anime[key]

    battesimi = db.query(models.Battesimo).filter(models.Battesimo.id.in_(a["battesimi"])).all() if a["battesimi"] else []
    comunioni = db.query(models.Comunione).filter(models.Comunione.id.in_(a["comunioni"])).all() if a["comunioni"] else []
    cresime = db.query(models.Cresima).filter(models.Cresima.id.in_(a["cresime"])).all() if a["cresime"] else []
    matrimoni = db.query(models.Matrimonio).filter(models.Matrimonio.id.in_(a["matrimoni"])).all() if a["matrimoni"] else []

    return {
        "id": anima_id,
        "nome": a["nome"],
        "cognome": a["cognome"],
        "data_nascita": a["data_nascita"].isoformat() if a["data_nascita"] else None,
        "luogo_nascita": a["luogo_nascita"],
        "battesimi": [schemas.BattesimoResponse.model_validate(b).model_dump(mode="json") for b in battesimi],
        "comunioni": [schemas.ComunioneResponse.model_validate(co).model_dump(mode="json") for co in comunioni],
        "cresime": [schemas.CresimaResponse.model_validate(c).model_dump(mode="json") for c in cresime],
        "matrimoni": [schemas.MatrimonioResponse.model_validate(m).model_dump(mode="json") for m in matrimoni],
    }
