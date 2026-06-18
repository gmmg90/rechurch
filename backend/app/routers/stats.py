from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from app.database import get_db
from app import models

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    """Return flat totals (used by frontend Dashboard) plus per-year breakdown."""
    total_battesimi = db.query(models.Battesimo).count()
    total_cresime = db.query(models.Cresima).count()
    total_matrimoni = db.query(models.Matrimonio).count()

    return {
        "battesimi": total_battesimi,
        "cresime": total_cresime,
        "matrimoni": total_matrimoni,
    }
