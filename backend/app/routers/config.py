import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/config", tags=["config"])

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"
)


def _get_or_create(db: Session) -> models.ParrocchiaConfig:
    config = db.query(models.ParrocchiaConfig).first()
    if not config:
        config = models.ParrocchiaConfig(id=1, nome="Parrocchia")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/", response_model=schemas.ParrocchiaConfigResponse)
def get_config(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    return _get_or_create(db)


@router.put("/", response_model=schemas.ParrocchiaConfigResponse)
def update_config(
    data: schemas.ParrocchiaConfigUpdate,
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    config = _get_or_create(db)
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(status_code=400, detail="Solo immagini PNG o JPG")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"logo{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    config = _get_or_create(db)
    config.logo_path = filepath
    db.commit()
    return {"logo_url": f"/uploads/{filename}"}


@router.delete("/logo")
def delete_logo(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    config = _get_or_create(db)
    if config.logo_path and os.path.exists(config.logo_path):
        os.remove(config.logo_path)
    config.logo_path = None
    db.commit()
    return {"ok": True}
