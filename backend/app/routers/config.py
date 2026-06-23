import os
import shutil
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_roles

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


# ─── Moduli ───────────────────────────────────────────────────────────────────

@router.get("/moduli/", response_model=List[schemas.ModuloConfigResponse])
def list_moduli(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    return db.query(models.ModuloConfig).order_by(models.ModuloConfig.ordine).all()


@router.put("/moduli/{codice}", response_model=schemas.ModuloConfigResponse)
def update_modulo(
    codice: str,
    data: schemas.ModuloConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(require_roles("admin")),
):
    obj = db.query(models.ModuloConfig).filter(models.ModuloConfig.codice == codice).first()
    if not obj:
        raise HTTPException(404, "Modulo non trovato")
    obj.attivo = data.attivo
    db.commit()
    db.refresh(obj)
    return obj


# ─── Info sistema ─────────────────────────────────────────────────────────────

@router.get("/sistema/", response_model=schemas.SistemaStats)
def sistema_stats(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(require_roles("admin")),
):
    backend_dir = Path(__file__).resolve().parent.parent.parent
    db_path = backend_dir / "rechurch.db"
    db_size_mb = round(db_path.stat().st_size / 1024 / 1024, 2) if db_path.exists() else 0.0

    backup_dir = backend_dir / "backups"
    ultimo_backup = None
    if backup_dir.exists():
        backups = sorted(backup_dir.glob("rechurch_*.db"), reverse=True)
        if backups:
            from datetime import datetime
            mtime = backups[0].stat().st_mtime
            ultimo_backup = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M")

    return schemas.SistemaStats(
        versione="2.0.0",
        db_size_mb=db_size_mb,
        totale_utenti=db.query(models.Utente).filter(models.Utente.attivo == True).count(),
        totale_battesimi=db.query(models.Battesimo).count(),
        totale_cresime=db.query(models.Cresima).count(),
        totale_matrimoni=db.query(models.Matrimonio).count(),
        totale_persone=db.query(models.Persona).count(),
        totale_movimenti=db.query(models.MovimentoContabile).count(),
        ultimo_backup=ultimo_backup,
    )
