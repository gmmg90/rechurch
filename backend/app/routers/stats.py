from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, or_, and_
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
        "comunioni": count_total(models.Comunione,  models.Comunione.data_comunione),
        "cresime":   count_total(models.Cresima,    models.Cresima.data_cresima),
        "matrimoni": count_total(models.Matrimonio, models.Matrimonio.data_matrimonio),
    }

    b_a = period_dict(models.Battesimo.data_battesimo,   "%Y")
    co_a = period_dict(models.Comunione.data_comunione,  "%Y")
    c_a = period_dict(models.Cresima.data_cresima,        "%Y")
    m_a = period_dict(models.Matrimonio.data_matrimonio,  "%Y")
    anni = sorted(set(b_a) | set(co_a) | set(c_a) | set(m_a))
    per_anno = [
        {"periodo": a, "battesimi": b_a.get(a, 0), "comunioni": co_a.get(a, 0),
         "cresime": c_a.get(a, 0), "matrimoni": m_a.get(a, 0)}
        for a in anni
    ]

    b_m = period_dict(models.Battesimo.data_battesimo,   "%Y-%m")
    co_m = period_dict(models.Comunione.data_comunione,  "%Y-%m")
    c_m = period_dict(models.Cresima.data_cresima,        "%Y-%m")
    m_m = period_dict(models.Matrimonio.data_matrimonio,  "%Y-%m")
    mesi = sorted(set(b_m) | set(co_m) | set(c_m) | set(m_m))
    per_mese = [
        {"periodo": ms, "battesimi": b_m.get(ms, 0), "comunioni": co_m.get(ms, 0),
         "cresime": c_m.get(ms, 0), "matrimoni": m_m.get(ms, 0)}
        for ms in mesi
    ]

    decenni: dict[str, dict] = {}
    for src, key in [(b_a, "battesimi"), (co_a, "comunioni"), (c_a, "cresime"), (m_a, "matrimoni")]:
        for yr, n in src.items():
            d = f"{yr[:3]}0"
            decenni.setdefault(d, {"periodo": d, "battesimi": 0, "comunioni": 0, "cresime": 0, "matrimoni": 0})
            decenni[d][key] += n
    per_decennio = sorted(decenni.values(), key=lambda x: x["periodo"])

    return {**totals, "per_anno": per_anno, "per_mese": per_mese, "per_decennio": per_decennio}


# ─── Anniversari matrimoni ────────────────────────────────────────────────────

@router.get("/anniversari/matrimoni")
def anniversari_matrimoni(
    db: Session = Depends(get_db),
    periodo: str = Query("mese", description="oggi | settimana | mese"),
    riferimento: Optional[date] = Query(None, description="Data di riferimento (default: oggi)"),
):
    """
    Ritorna i matrimoni celebrati in anni precedenti la cui data ricorre nel
    periodo selezionato (oggi/settimana/mese) rispetto alla data di riferimento.
    """
    ref = riferimento or date.today()

    # Calcola l'insieme di (mese, giorno) da matchare
    if periodo == "oggi":
        target_days = [ref]
    elif periodo == "settimana":
        # 3 giorni prima + oggi + 3 giorni dopo
        target_days = [ref + timedelta(days=d) for d in range(-3, 4)]
    else:  # mese
        # Tutto il mese di ref: query diretta su extract(month)
        results = (
            db.query(models.Matrimonio)
            .filter(extract("month", models.Matrimonio.data_matrimonio) == ref.month)
            .filter(models.Matrimonio.data_matrimonio < date(ref.year, ref.month, 1))
            .order_by(models.Matrimonio.data_matrimonio.asc())
            .all()
        )
        return _serialize_anniversari(results, ref)

    # Per oggi/settimana: OR di (month=X AND day=Y) per ogni giorno target
    conditions = [
        and_(
            extract("month", models.Matrimonio.data_matrimonio) == d.month,
            extract("day", models.Matrimonio.data_matrimonio) == d.day,
        )
        for d in target_days
    ]
    # Esclude i matrimoni di quest'anno (sono "lo stesso evento", non un anniversario)
    results = (
        db.query(models.Matrimonio)
        .filter(or_(*conditions))
        .filter(extract("year", models.Matrimonio.data_matrimonio) < ref.year)
        .order_by(
            extract("month", models.Matrimonio.data_matrimonio).asc(),
            extract("day", models.Matrimonio.data_matrimonio).asc(),
            models.Matrimonio.data_matrimonio.asc(),
        )
        .all()
    )
    return _serialize_anniversari(results, ref)


def _serialize_anniversari(matrimoni, ref: date):
    items = []
    for m in matrimoni:
        d = m.data_matrimonio
        anni = ref.year - d.year
        items.append({
            "id": m.id,
            "sposo_nome": m.sposo_nome,
            "sposo_cognome": m.sposo_cognome,
            "sposa_nome": m.sposa_nome,
            "sposa_cognome": m.sposa_cognome,
            "data_matrimonio": d.isoformat(),
            "luogo_matrimonio": m.luogo_matrimonio,
            "anniversario_anni": anni,
            "mese_giorno": f"{d.month:02d}-{d.day:02d}",
        })
    return {
        "riferimento": ref.isoformat(),
        "totale": len(items),
        "items": items,
    }
