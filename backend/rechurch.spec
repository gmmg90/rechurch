# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec per ReChurch.

Esegui dalla cartella backend/:
    pyinstaller rechurch.spec --clean --noconfirm

Output: dist/ReChurch/ReChurch.exe (con cartelle dipendenze accanto).
"""
import os
from pathlib import Path

BACKEND_DIR = Path.cwd()
PROJECT_DIR = BACKEND_DIR.parent
FRONTEND_DIST = PROJECT_DIR / "frontend" / "dist"

datas = []

# Frontend buildato (servito da FastAPI come SPA)
if FRONTEND_DIST.exists():
    datas.append((str(FRONTEND_DIST), "frontend_dist"))
else:
    print("ATTENZIONE: frontend/dist non trovato. Esegui prima `npm run build` nel frontend.")

# Icona
ICON_PATH = BACKEND_DIR / "icon.ico"
if ICON_PATH.exists():
    datas.append((str(ICON_PATH), "."))

# DB di seed (opzionale): se presente, viene copiato in C:\ReChurch\ al primo avvio
SEED_DB = BACKEND_DIR / "rechurch_seed.db"
if SEED_DB.exists():
    datas.append((str(SEED_DB), "."))
    print(f"[spec] DB di seed incluso: {SEED_DB} ({SEED_DB.stat().st_size} byte)")
else:
    print("[spec] Nessun DB di seed (cerca rechurch_seed.db in backend/). Salto.")

a = Analysis(
    ["launcher.py"],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        # FastAPI / Uvicorn
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # SQLAlchemy dialects
        "sqlalchemy.dialects.sqlite",
        # email-validator non serve ma pydantic lo importa lazy
        "email_validator",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter.test", "matplotlib", "numpy.tests", "scipy"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ReChurch",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # finestra senza terminale
    icon=str(ICON_PATH) if ICON_PATH.exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="ReChurch",
)
