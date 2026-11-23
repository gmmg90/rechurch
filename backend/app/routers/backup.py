import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app import models
from app.auth import require_roles
from app.backup_utils import BackupNonSupportato, esegui_backup_completo, get_backup_dir

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_DIR = get_backup_dir()


@router.post("/esegui")
def esegui_backup(
    _: models.Utente = Depends(require_roles("admin")),
):
    try:
        return esegui_backup_completo()
    except BackupNonSupportato as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
