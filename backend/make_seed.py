"""
Genera un rechurch_seed.db partendo dal DB attualmente in uso.

Esegui da backend/:
    python make_seed.py

Crea backend/rechurch_seed.db (copia consistente via SQLite Online Backup API)
che sara' incluso nel prossimo build PyInstaller e copiato in
C:\\ReChurch\\rechurch.db al primo avvio se il DB di destinazione non esiste.

Per rimuovere il seed dal build: cancellare backend/rechurch_seed.db prima
di rieseguire build.ps1.
"""
import sqlite3
import sys
from pathlib import Path

from app.paths import get_db_path


def main():
    src_path = Path(sys.argv[1]) if len(sys.argv) > 1 else get_db_path()
    dst_path = Path(__file__).resolve().parent / "rechurch_seed.db"

    if not src_path.exists():
        print(f"ERRORE: DB sorgente non trovato: {src_path}")
        sys.exit(1)

    print(f"Sorgente:     {src_path}")
    print(f"Destinazione: {dst_path}")

    src = sqlite3.connect(str(src_path))
    dst = sqlite3.connect(str(dst_path))
    with dst:
        src.backup(dst)
    src.close()
    dst.close()

    size_mb = dst_path.stat().st_size / (1024 * 1024)
    print(f"\nSeed generato: {dst_path} ({size_mb:.2f} MB)")
    print("Eseguire build.ps1 per includerlo nel prossimo eseguibile.")


if __name__ == "__main__":
    main()
