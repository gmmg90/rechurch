"""
Backup, ripristino ed esportazione dati.
"""
import csv
import io
import os
import shutil
import tempfile
import zipfile
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db, engine, DATABASE_URL
from app import models

router = APIRouter(prefix="/backup", tags=["backup"])


def _get_db_path() -> str:
    """Estrae il path del file SQLite dal DATABASE_URL."""
    if not DATABASE_URL.startswith("sqlite:///"):
        raise HTTPException(400, "Backup disponibile solo per database SQLite")
    # sqlite:///./rechurch.db -> ./rechurch.db
    path = DATABASE_URL.replace("sqlite:///", "", 1)
    return os.path.abspath(path)


@router.get("/download")
def download_backup():
    """Scarica una copia del database SQLite."""
    db_path = _get_db_path()
    if not os.path.exists(db_path):
        raise HTTPException(404, "Database non trovato")

    # SQLite Online Backup API per ottenere un file consistente anche con scritture attive
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"rechurch_backup_{timestamp}.db"

    # Crea una copia temporanea usando il backup API di SQLite (più sicuro di una copy)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    tmp.close()
    try:
        import sqlite3
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(tmp.name)
        with dst:
            src.backup(dst)
        src.close()
        dst.close()
    except Exception as e:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
        raise HTTPException(500, f"Errore creazione backup: {e}")

    def iterfile():
        try:
            with open(tmp.name, "rb") as f:
                while chunk := f.read(64 * 1024):
                    yield chunk
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...)):
    """Ripristina il database da un backup. ATTENZIONE: sovrascrive il DB corrente."""
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(400, "Il file deve essere un .db SQLite")

    db_path = _get_db_path()

    # Salva il file caricato in un percorso temporaneo
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()

        # Verifica che sia un SQLite valido
        import sqlite3
        try:
            con = sqlite3.connect(tmp.name)
            cur = con.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {r[0] for r in cur.fetchall()}
            con.close()
        except Exception:
            raise HTTPException(400, "Il file caricato non è un database SQLite valido")

        required = {"battesimi", "comunioni", "cresime", "matrimoni", "parrocchia_config"}
        if not required.issubset(tables):
            missing = required - tables
            raise HTTPException(400, f"Backup non valido: tabelle mancanti {missing}")

        # Chiude tutte le connessioni dell'engine prima di sostituire il file
        engine.dispose()

        # Salva un backup di sicurezza del DB attuale (.bak)
        if os.path.exists(db_path):
            backup_path = db_path + ".bak"
            shutil.copy2(db_path, backup_path)

        # Sostituisce il file
        shutil.copy2(tmp.name, db_path)

        return {
            "ok": True,
            "message": "Database ripristinato con successo. Riavvia l'applicazione per ricaricare i dati.",
            "backup_precedente": db_path + ".bak" if os.path.exists(db_path + ".bak") else None,
        }
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


@router.get("/info")
def backup_info(db: Session = Depends(get_db)):
    """Informazioni sul database corrente."""
    db_path = _get_db_path()
    size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    modified = datetime.fromtimestamp(os.path.getmtime(db_path)) if os.path.exists(db_path) else None

    return {
        "path": db_path,
        "size_bytes": size,
        "size_human": _human_size(size),
        "modified": modified.isoformat() if modified else None,
        "counts": {
            "battesimi": db.query(models.Battesimo).count(),
            "comunioni": db.query(models.Comunione).count(),
            "cresime": db.query(models.Cresima).count(),
            "matrimoni": db.query(models.Matrimonio).count(),
        },
    }


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


# ─── Esportazioni CSV ─────────────────────────────────────────────────────────

def _model_rows(model_cls, records) -> List[dict]:
    cols = [c.name for c in model_cls.__table__.columns]
    return [
        {c: _fmt_val(getattr(r, c)) for c in cols}
        for r in records
    ]


def _fmt_val(v):
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def _csv_bytes(rows: List[dict], fieldnames: List[str]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    # BOM UTF-8 per Excel
    return "﻿".encode("utf-8") + buf.getvalue().encode("utf-8")


_MODELS_BY_TIPO = {
    "battesimi": models.Battesimo,
    "comunioni": models.Comunione,
    "cresime": models.Cresima,
    "matrimoni": models.Matrimonio,
}


@router.get("/export/csv/{tipo}")
def export_csv(tipo: str, db: Session = Depends(get_db)):
    """Esporta tutti i record di un tipo in CSV (UTF-8 con BOM, compatibile Excel)."""
    if tipo not in _MODELS_BY_TIPO:
        raise HTTPException(400, "Tipo non valido")

    Model = _MODELS_BY_TIPO[tipo]
    records = db.query(Model).all()
    rows = _model_rows(Model, records)
    fieldnames = [c.name for c in Model.__table__.columns]
    data = _csv_bytes(rows, fieldnames)

    timestamp = datetime.now().strftime("%Y%m%d")
    fname = f"{tipo}_{timestamp}.csv"

    return StreamingResponse(
        iter([data]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/export/zip")
def export_all_zip(db: Session = Depends(get_db)):
    """Esporta tutti i tipi in un singolo file ZIP."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for tipo, Model in _MODELS_BY_TIPO.items():
            records = db.query(Model).all()
            rows = _model_rows(Model, records)
            fieldnames = [c.name for c in Model.__table__.columns]
            data = _csv_bytes(rows, fieldnames)
            zf.writestr(f"{tipo}.csv", data)

        # Aggiungi anche la configurazione parrocchia
        cfg = db.query(models.ParrocchiaConfig).first()
        if cfg:
            cfg_rows = _model_rows(models.ParrocchiaConfig, [cfg])
            cfg_fields = [c.name for c in models.ParrocchiaConfig.__table__.columns]
            zf.writestr("parrocchia_config.csv", _csv_bytes(cfg_rows, cfg_fields))

    buf.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"rechurch_export_{timestamp}.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
