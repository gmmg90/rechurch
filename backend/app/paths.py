"""
Risoluzione path applicazione.

In sviluppo: usa la cartella backend/ del progetto.
In produzione (binario PyInstaller): usa C:\\ReChurch\\ (o RECHURCH_DATA_DIR se settato).
"""
import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    """True se l'app gira come binario PyInstaller."""
    return getattr(sys, "frozen", False)


def get_data_dir() -> Path:
    """Cartella dati persistente: DB, uploads, log."""
    override = os.getenv("RECHURCH_DATA_DIR")
    if override:
        p = Path(override)
    elif is_frozen():
        # In produzione: C:\ReChurch\
        p = Path("C:/ReChurch")
    else:
        # In sviluppo: backend/
        p = Path(__file__).resolve().parent.parent

    p.mkdir(parents=True, exist_ok=True)
    return p


def get_db_path() -> Path:
    """Path del file SQLite."""
    return get_data_dir() / "rechurch.db"


def get_uploads_dir() -> Path:
    """Cartella per upload (logo parrocchia, ecc.)."""
    p = get_data_dir() / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_static_dir() -> Path | None:
    """Cartella con il frontend buildato (per servirlo dal backend)."""
    if is_frozen():
        # PyInstaller estrae i bundle in sys._MEIPASS
        base = Path(getattr(sys, "_MEIPASS", "."))
        candidate = base / "frontend_dist"
    else:
        # In sviluppo: frontend/dist se esiste
        candidate = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

    return candidate if candidate.exists() else None


def get_seed_db_path() -> Path | None:
    """Path al DB di seed incluso nel pacchetto (se presente).

    Cerca rechurch_seed.db prima nel bundle PyInstaller, poi nella cartella backend.
    Restituisce None se non c'è.
    """
    candidates = []
    if is_frozen():
        base = Path(getattr(sys, "_MEIPASS", "."))
        candidates.append(base / "rechurch_seed.db")
    else:
        candidates.append(Path(__file__).resolve().parent.parent / "rechurch_seed.db")

    for c in candidates:
        if c.exists():
            return c
    return None


def ensure_seed_db():
    """Se il DB di destinazione non esiste e c'è un seed nel bundle, lo copia.
    Chiamato in launcher.main() prima di avviare il server.
    """
    target = get_db_path()
    if target.exists():
        return  # DB già presente: non sovrascrivere

    seed = get_seed_db_path()
    if seed is None:
        return  # nessun seed disponibile

    import shutil
    shutil.copy2(seed, target)
