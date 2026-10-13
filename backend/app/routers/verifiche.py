"""Controllo qualità dei registri: record da verificare/correggere.

La lista è calcolata dal vivo sui dati, quindi un record corretto sparisce da
solo. Si aggiungono le segnalazioni salvate (es. note dell'import dall'archivio)
e si escludono i controlli confermati come corretti dall'utente.
"""
from collections import defaultdict
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_roles
from app.database import get_db

router = APIRouter(prefix="/verifiche", tags=["verifiche"])

ETA_MIN_CRESIMA = 6
ETA_COMUNIONE = (5, 25)
ETA_MIN_MATRIMONIO = 16


def _eta(nascita: date, evento: date) -> float:
    return (evento - nascita).days / 365.25


def _fmt(d: Optional[date]) -> str:
    return d.strftime("%d/%m/%Y") if d else "—"


def _persona(r) -> str:
    return f"{r.cognome} {r.nome}"


def _coppia(m) -> str:
    return f"{m.sposo_cognome} {m.sposo_nome} e {m.sposa_cognome} {m.sposa_nome}"


def calcola_problemi(db: Session) -> list[dict]:
    oggi = date.today()
    ignorate = {v.chiave for v in db.query(models.VerificaIgnorata).all()}
    problemi: list[dict] = []

    def add(tipo, rec_id, persona, categoria, messaggio, check):
        chiave = f"{tipo}:{rec_id}:{check}"
        if chiave not in ignorate:
            problemi.append({
                "chiave": chiave, "tipo": tipo, "record_id": rec_id, "persona": persona,
                "categoria": categoria, "messaggio": messaggio, "origine": "controllo",
            })

    sacramenti = [
        ("battesimi", models.Battesimo, "data_battesimo", "Battesimo"),
        ("comunioni", models.Comunione, "data_comunione", "Comunione"),
        ("cresime", models.Cresima, "data_cresima", "Cresima"),
    ]
    rows = {tipo: db.query(Model).all() for tipo, Model, _, _ in sacramenti}

    battesimo_di = {}
    for b in rows["battesimi"]:
        if b.data_nascita:
            battesimo_di[(b.cognome.upper(), b.nome.upper(), b.data_nascita)] = b.data_battesimo

    for tipo, _, campo, nome in sacramenti:
        gruppi = defaultdict(list)
        for r in rows[tipo]:
            d, n = getattr(r, campo), r.data_nascita
            if d and d > oggi:
                add(tipo, r.id, _persona(r), "Data nel futuro", f"{nome} con data futura: {_fmt(d)}", "futuro")
            if d and n and d < n:
                add(tipo, r.id, _persona(r), "Date incoerenti",
                    f"{nome} ({_fmt(d)}) precedente alla nascita ({_fmt(n)})", "prima_nascita")
            elif d and n:
                eta = _eta(n, d)
                if tipo == "cresime" and eta < ETA_MIN_CRESIMA:
                    add(tipo, r.id, _persona(r), "Età insolita", f"Età alla cresima: {eta:.1f} anni", "eta")
                if tipo == "comunioni" and not ETA_COMUNIONE[0] <= eta <= ETA_COMUNIONE[1]:
                    add(tipo, r.id, _persona(r), "Età insolita", f"Età alla comunione: {eta:.1f} anni", "eta")
            if tipo == "cresime" and n:
                db_ = battesimo_di.get((r.cognome.upper(), r.nome.upper(), n))
                if db_ and d and d < db_:
                    add(tipo, r.id, _persona(r), "Date incoerenti",
                        f"Cresima ({_fmt(d)}) precedente al battesimo ({_fmt(db_)})", "prima_battesimo")
            if n:
                gruppi[(r.cognome.upper(), r.nome.upper(), n)].append(r)
        for g in gruppi.values():
            if len(g) > 1:
                for r in g:
                    add(tipo, r.id, _persona(r), "Possibile duplicato",
                        f"{len(g)} {nome.lower()} con stesso nome e data di nascita", "duplicato")

    coppie = defaultdict(list)
    for m in db.query(models.Matrimonio).all():
        dm = m.data_matrimonio
        if dm and dm > oggi:
            add("matrimoni", m.id, _coppia(m), "Data nel futuro", f"Matrimonio con data futura: {_fmt(dm)}", "futuro")
        for chi, n in (("sposo", m.sposo_data_nascita), ("sposa", m.sposa_data_nascita)):
            if n and dm and _eta(n, dm) < ETA_MIN_MATRIMONIO:
                add("matrimoni", m.id, _coppia(m), "Date incoerenti",
                    f"Data di nascita {chi} ({_fmt(n)}) non plausibile per un matrimonio del {_fmt(dm)}",
                    f"nascita_{chi}")
        coppie[(m.sposo_cognome.upper(), m.sposo_nome.upper(), m.sposa_cognome.upper(),
                m.sposa_nome.upper(), dm)].append(m)
    for g in coppie.values():
        if len(g) > 1:
            for m in g:
                add("matrimoni", m.id, _coppia(m), "Possibile duplicato",
                    f"{len(g)} matrimoni della stessa coppia nella stessa data", "duplicato")

    for s in db.query(models.Segnalazione).filter(models.Segnalazione.risolta.is_(False)).all():
        problemi.append({
            "chiave": f"seg:{s.id}", "tipo": s.tipo, "record_id": s.record_id, "persona": s.persona or "—",
            "categoria": s.categoria, "messaggio": s.messaggio, "origine": s.origine,
        })

    # righe non importate (tipo "archivio") in fondo
    problemi.sort(key=lambda p: (p["tipo"] == "archivio", p["tipo"], p["persona"], p["categoria"]))
    return problemi


@router.get("/")
def lista_verifiche(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    problemi = calcola_problemi(db)
    return {"totale": len(problemi), "problemi": problemi}


@router.get("/conteggio")
def conteggio_verifiche(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    return {"totale": len(calcola_problemi(db))}


class IgnoraRequest(BaseModel):
    chiave: str


@router.post("/ignora")
def ignora(
    data: IgnoraRequest,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin", "segreteria")),
):
    """Segna un controllo come 'corretto così' o una segnalazione come risolta."""
    if data.chiave.startswith("seg:"):
        s = db.query(models.Segnalazione).filter(models.Segnalazione.id == int(data.chiave[4:])).first()
        if not s:
            raise HTTPException(404, "Segnalazione non trovata")
        s.risolta = True
    elif not db.query(models.VerificaIgnorata).filter_by(chiave=data.chiave).first():
        db.add(models.VerificaIgnorata(chiave=data.chiave))
    db.commit()
    return {"ok": True}


class SegnalazioneCreate(BaseModel):
    tipo: str
    record_id: Optional[int] = None
    persona: Optional[str] = None
    categoria: str
    messaggio: str
    origine: str = "manuale"


@router.post("/segnalazioni", status_code=201)
def crea_segnalazione(
    data: SegnalazioneCreate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin", "segreteria")),
):
    s = models.Segnalazione(**data.model_dump())
    db.add(s)
    db.commit()
    return {"id": s.id}
