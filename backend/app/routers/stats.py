from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app import models

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/")
def get_stats(
    db: Session = Depends(get_db),
    dal: Optional[date] = Query(None),
    al: Optional[date] = Query(None),
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
