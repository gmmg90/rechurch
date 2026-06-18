from sqlalchemy.orm import Session
from sqlalchemy import func

from fastapi import APIRouter, Depends

from app.database import get_db
from app import models

router = APIRouter(prefix="/stats", tags=["stats"])


def _by_period(db: Session, date_col, fmt: str) -> dict[str, int]:
    rows = (
        db.query(func.strftime(fmt, date_col).label("p"), func.count().label("n"))
        .group_by("p")
        .all()
    )
    return {r.p: r.n for r in rows if r.p}


@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    totals = {
        "battesimi": db.query(models.Battesimo).count(),
        "cresime":   db.query(models.Cresima).count(),
        "matrimoni": db.query(models.Matrimonio).count(),
    }

    # ── per anno ──────────────────────────────────────────────────────────────
    b_a = _by_period(db, models.Battesimo.data_battesimo, "%Y")
    c_a = _by_period(db, models.Cresima.data_cresima,     "%Y")
    m_a = _by_period(db, models.Matrimonio.data_matrimonio, "%Y")
    anni = sorted(set(b_a) | set(c_a) | set(m_a))
    per_anno = [
        {"periodo": a, "battesimi": b_a.get(a, 0), "cresime": c_a.get(a, 0), "matrimoni": m_a.get(a, 0)}
        for a in anni
    ]

    # ── per mese ──────────────────────────────────────────────────────────────
    b_m = _by_period(db, models.Battesimo.data_battesimo,  "%Y-%m")
    c_m = _by_period(db, models.Cresima.data_cresima,      "%Y-%m")
    m_m = _by_period(db, models.Matrimonio.data_matrimonio, "%Y-%m")
    mesi = sorted(set(b_m) | set(c_m) | set(m_m))
    per_mese = [
        {"periodo": ms, "battesimi": b_m.get(ms, 0), "cresime": c_m.get(ms, 0), "matrimoni": m_m.get(ms, 0)}
        for ms in mesi
    ]

    # ── per decennio ──────────────────────────────────────────────────────────
    b_d = _by_period(db, models.Battesimo.data_battesimo,  "%Y")
    c_d = _by_period(db, models.Cresima.data_cresima,      "%Y")
    m_d = _by_period(db, models.Matrimonio.data_matrimonio, "%Y")

    decenni: dict[str, dict] = {}
    for yr, n in b_d.items():
        d = f"{yr[:3]}0"
        decenni.setdefault(d, {"periodo": d, "battesimi": 0, "cresime": 0, "matrimoni": 0})
        decenni[d]["battesimi"] += n
    for yr, n in c_d.items():
        d = f"{yr[:3]}0"
        decenni.setdefault(d, {"periodo": d, "battesimi": 0, "cresime": 0, "matrimoni": 0})
        decenni[d]["cresime"] += n
    for yr, n in m_d.items():
        d = f"{yr[:3]}0"
        decenni.setdefault(d, {"periodo": d, "battesimi": 0, "cresime": 0, "matrimoni": 0})
        decenni[d]["matrimoni"] += n
    per_decennio = sorted(decenni.values(), key=lambda x: x["periodo"])

    return {
        **totals,
        "per_anno":     per_anno,
        "per_mese":     per_mese,
        "per_decennio": per_decennio,
    }
