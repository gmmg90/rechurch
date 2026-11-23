"""Backup locale del database SQLite (+ upload cloud opzionale).

Usato sia dal job notturno sia dal pulsante "Backup ora". La copia usa l'API di
backup di SQLite, che produce un file consistente anche mentre l'app scrive
(con il journal WAL una semplice copia del file potrebbe perdere le ultime
transazioni).
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path

from app.paths import get_data_dir, get_db_path

_BACKEND_DIR = Path(__file__).resolve().parent.parent


class BackupNonSupportato(Exception):
    """Il database non è SQLite (es. Postgres): va salvato con pg_dump."""


def get_backup_dir() -> Path:
    p = get_data_dir() / "backups"
    p.mkdir(parents=True, exist_ok=True)
    return p


def sqlite_db_path() -> Path:
    """Percorso del file SQLite in uso (rispetta DATABASE_URL se è SQLite)."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        if not db_url.startswith("sqlite:///"):
            raise BackupNonSupportato("Backup supportato solo per database SQLite")
        raw = db_url[len("sqlite:///"):]
        return Path(raw) if os.path.isabs(raw) else (_BACKEND_DIR / raw).resolve()
    return get_db_path()


def crea_backup_locale() -> Path:
    """Crea backups/rechurch_YYYYmmdd_HHMMSS.db e restituisce il percorso."""
    src = sqlite_db_path()
    if not src.exists():
        raise FileNotFoundError(f"Database non trovato: {src}")

    dest = get_backup_dir() / f"rechurch_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    with sqlite3.connect(str(src), timeout=30) as s, sqlite3.connect(str(dest)) as d:
        s.backup(d)
    # Il file di backup è autonomo: niente WAL accanto
    with sqlite3.connect(str(dest)) as d:
        d.execute("PRAGMA journal_mode=DELETE")
    pulisci_backup_locali()
    return dest


def pulisci_backup_locali() -> None:
    """Tiene solo gli ultimi BACKUP_KEEP_LOCAL backup locali (default 60, 0 = tutti)."""
    keep = int(os.getenv("BACKUP_KEEP_LOCAL", "60"))
    if keep <= 0:
        return
    files = sorted(get_backup_dir().glob("rechurch_*.db"), reverse=True)
    for f in files[keep:]:
        try:
            f.unlink()
        except OSError:
            pass


def esegui_backup_completo() -> dict:
    """Backup locale + upload cloud (se configurato). Non solleva per errori cloud."""
    dest = crea_backup_locale()
    result = {"filename": dest.name, "size_kb": round(dest.stat().st_size / 1024, 2)}

    from app.cloud_backup import cloud_backup_enabled, provider_name, upload_backup
    if cloud_backup_enabled():
        try:
            remote_id = upload_backup(dest)
            result["cloud"] = {"provider": provider_name(), "ok": True, "id": remote_id}
        except Exception as e:  # il backup locale resta valido
            result["cloud"] = {"provider": provider_name(), "ok": False, "error": str(e)}
    return result
