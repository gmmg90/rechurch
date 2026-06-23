from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/")
def get_stats(
    db: Session = Depends(get_db),
    dal: Optional[date] = Query(None),
    al: Optional[date] = Query(None),
    _: models.Utente = Depends(get_current_user),
):
    def period_dict(date_col, fmt: str) -> dict[str, int]:
        q = db.query(func.strftime(fmt, date_col).label("p"), func.count().label("n"))
        if dal:
            q = q.filter(date_col >= dal)
        if al:
            q = q.filter(date_col <= al)
        return {r.p: r.n for r in q.group_by("p").all() if r.p}

    def count_total(model, date_col):
        q = db.query(model)
        if dal:
            q = q.filter(date_col >= dal)
        if al:
            q = q.filter(date_col <= al)
        return q.count()

    totals = {
        "battesimi": count_total(models.Battesimo,  models.Battesimo.data_battesimo),
        "cresime":   count_total(models.Cresima,    models.Cresima.data_cresima),
        "matrimoni": count_total(models.Matrimonio, models.Matrimonio.data_matrimonio),
    }

    b_a = period_dict(models.Battesimo.data_battesimo,   "%Y")
    c_a = period_dict(models.Cresima.data_cresima,        "%Y")
    m_a = period_dict(models.Matrimonio.data_matrimonio,  "%Y")
    anni = sorted(set(b_a) | set(c_a) | set(m_a))
    per_anno = [
        {"periodo": a, "battesimi": b_a.get(a, 0), "cresime": c_a.get(a, 0), "matrimoni": m_a.get(a, 0)}
        for a in anni
    ]

    b_m = period_dict(models.Battesimo.data_battesimo,   "%Y-%m")
    c_m = period_dict(models.Cresima.data_cresima,        "%Y-%m")
    m_m = period_dict(models.Matrimonio.data_matrimonio,  "%Y-%m")
    mesi = sorted(set(b_m) | set(c_m) | set(m_m))
    per_mese = [
        {"periodo": ms, "battesimi": b_m.get(ms, 0), "cresime": c_m.get(ms, 0), "matrimoni": m_m.get(ms, 0)}
        for ms in mesi
    ]

    decenni: dict[str, dict] = {}
    for src, key in [(b_a, "battesimi"), (c_a, "cresime"), (m_a, "matrimoni")]:
        for yr, n in src.items():
            d = f"{yr[:3]}0"
            decenni.setdefault(d, {"periodo": d, "battesimi": 0, "cresime": 0, "matrimoni": 0})
            decenni[d][key] += n
    per_decennio = sorted(decenni.values(), key=lambda x: x["periodo"])

    return {**totals, "per_anno": per_anno, "per_mese": per_mese, "per_decennio": per_decennio}


@router.get("/dashboard/")
def dashboard_summary(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    """Single endpoint returning all dashboard summary data."""
    from datetime import date
    from calendar import monthrange

    oggi = date.today()
    primo_mese = oggi.replace(day=1)
    ultimo_mese = oggi.replace(day=monthrange(oggi.year, oggi.month)[1])

    # Sacrament totals
    tot_battesimi = db.query(models.Battesimo).count()
    tot_cresime = db.query(models.Cresima).count()
    tot_matrimoni = db.query(models.Matrimonio).count()

    # Persone (rubrica)
    try:
        tot_persone = db.query(models.Persona).count()
    except Exception:
        tot_persone = 0

    # Contabilità this month
    try:
        movimenti_mese = db.query(models.MovimentoContabile).filter(
            models.MovimentoContabile.data >= primo_mese,
            models.MovimentoContabile.data <= ultimo_mese,
        ).all()
        entrate_mese = sum(float(m.importo) for m in movimenti_mese if m.tipo == 'entrata')
        uscite_mese = sum(float(m.importo) for m in movimenti_mese if m.tipo == 'uscita')
    except Exception:
        entrate_mese = 0.0
        uscite_mese = 0.0

    return {
        "sacramenti": {
            "battesimi": tot_battesimi,
            "cresime": tot_cresime,
            "matrimoni": tot_matrimoni,
        },
        "persone": tot_persone,
        "contabilita_mese": {
            "mese": oggi.strftime("%B %Y"),
            "entrate": round(entrate_mese, 2),
            "uscite": round(uscite_mese, 2),
            "saldo": round(entrate_mese - uscite_mese, 2),
        },
    }
