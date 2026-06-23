import os
import re
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app import models
from app.auth import require_roles

router = APIRouter(prefix="/backup", tags=["backup"])

# Resolve the project root (two levels above this file: routers -> app -> backend)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
BACKUP_DIR = _BACKEND_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _get_db_path() -> Path:
    """Return the SQLite DB file path from DATABASE_URL env var or default."""
    db_url = os.getenv("DATABASE_URL", "sqlite:///./rechurch.db")
    if db_url.startswith("sqlite:///"):
        raw = db_url[len("sqlite:///"):]
        # Absolute path already
        if os.path.isabs(raw):
            return Path(raw)
        # Relative path — resolve relative to backend dir
        return (_BACKEND_DIR / raw).resolve()
    # Non-SQLite: nothing to backup
    raise HTTPException(status_code=400, detail="Backup supportato solo per database SQLite")


@router.post("/esegui")
def esegui_backup(
    _: models.Utente = Depends(require_roles("admin")),
):
    db_path = _get_db_path()
    if not db_path.exists():
        raise HTTPException(status_code=404, detail=f"Database non trovato: {db_path}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"rechurch_{timestamp}.db"
    dest = BACKUP_DIR / filename
    shutil.copy2(str(db_path), str(dest))
    return {"filename": filename, "size_kb": round(dest.stat().st_size / 1024, 2)}


@router.get("/lista")
def lista_backup(
    _: models.Utente = Depends(require_roles("admin")),
):
    backups = []
    for f in sorted(BACKUP_DIR.iterdir(), reverse=True):
        if f.is_file() and f.suffix == ".db":
            stat = f.stat()
            backups.append({
                "filename": f.name,
                "size_kb": round(stat.st_size / 1024, 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return backups


@router.get("/{filename}")
def download_backup(
    filename: str,
    _: models.Utente = Depends(require_roles("admin")),
):
    # Validate filename — only allow safe names (no path traversal)
    if not re.match(r'^rechurch_\d{8}_\d{6}\.db$', filename):
        raise HTTPException(status_code=400, detail="Nome file non valido")

    file_path = BACKUP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File di backup non trovato")

    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename=filename,
    )
