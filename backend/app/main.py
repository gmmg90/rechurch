import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import engine, Base, SessionLocal
from app import models
from app.auth import hash_password
from app.paths import get_uploads_dir, get_static_dir, get_db_path
from app.routers import battesimi, cresime, matrimoni, comunioni, import_data, stats
from app.routers import config as config_router
from app.routers import pdf as pdf_router
from app.routers import auth as auth_router
from app.routers import backup as backup_router
from app.routers import rubrica as rubrica_router
from app.routers import contabilita as contabilita_router
from app.routers import scadenziario as scadenziario_router
from app.routers import report_templates as report_templates_router

app = FastAPI(
    title="ReChurch API",
    description="Gestione parrocchiale completa",
    version="2.1.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_debug = os.getenv("DEBUG", "").lower() in ("1", "true", "yes")
_origins = ["*"] if _debug else ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=not _debug,  # credentials not allowed with wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# Registered twice: bare (dev — the Vite proxy strips the /api prefix) and under
# /api (production — the packaged app serves the SPA on / and the API on /api).
_ROUTERS = [
    auth_router.router,
    backup_router.router,
    battesimi.router,
    cresime.router,
    matrimoni.router,
    comunioni.router,
    import_data.router,
    stats.router,
    config_router.router,
    pdf_router.router,
    rubrica_router.router,
    contabilita_router.router,
    scadenziario_router.router,
    report_templates_router.router,
]

API = "/api"
for r in _ROUTERS:
    app.include_router(r)          # bare, e.g. /battesimi
    app.include_router(r, prefix=API)  # prefixed, e.g. /api/battesimi

# ── Static files (uploads) ────────────────────────────────────────────────────
UPLOAD_DIR = str(get_uploads_dir())
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads_api")


# ── Scheduler ─────────────────────────────────────────────────────────────────
def _run_scheduled_backup():
    """Scheduled backup job — runs daily at 02:00."""
    import shutil
    from datetime import datetime
    from pathlib import Path

    db_url = os.getenv("DATABASE_URL")
    if db_url:
        if not db_url.startswith("sqlite:///"):
            return
        raw = db_url[len("sqlite:///"):]
        db_path = Path(raw) if os.path.isabs(raw) else (Path(__file__).resolve().parent.parent / raw).resolve()
    else:
        db_path = get_db_path()

    if not db_path.exists():
        print(f"[backup] Database non trovato: {db_path}")
        return

    from app.paths import get_data_dir
    backup_dir = get_data_dir() / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"rechurch_{timestamp}.db"
    dest = backup_dir / filename
    shutil.copy2(str(db_path), str(dest))
    print(f"[backup] Backup automatico creato: {filename}")

    # Optional cloud upload (see app.cloud_backup); no-op if not configured.
    try:
        from app.cloud_backup import upload_backup
        upload_backup(dest)
    except Exception as e:  # never let cloud errors break the local backup
        print(f"[backup] Upload cloud saltato/fallito: {e}")


_scheduler = BackgroundScheduler()
_scheduler.add_job(_run_scheduled_backup, "cron", hour=2, minute=0)


# ── Default module list ───────────────────────────────────────────────────────
_MODULI_DEFAULT = [
    {"codice": "battesimi",   "nome": "Battesimi",         "descrizione": "Registro dei battesimi con generazione PDF dei certificati", "icona": "Droplets",     "ordine": 1},
    {"codice": "comunioni",   "nome": "Comunioni",         "descrizione": "Registro delle prime comunioni",                            "icona": "Wheat",        "ordine": 2},
    {"codice": "cresime",     "nome": "Cresime",           "descrizione": "Registro delle cresime con generazione PDF dei certificati", "icona": "Star",         "ordine": 3},
    {"codice": "matrimoni",   "nome": "Matrimoni",         "descrizione": "Registro dei matrimoni con generazione PDF dei certificati", "icona": "Heart",        "ordine": 4},
    {"codice": "rubrica",     "nome": "Rubrica Anime",     "descrizione": "Gestione famiglie e persone della parrocchia",               "icona": "BookOpen",     "ordine": 5},
    {"codice": "contabilita", "nome": "Contabilità",       "descrizione": "Entrate, uscite, categorie, fornitori ed export Excel",      "icona": "Wallet",       "ordine": 6},
    {"codice": "scadenziario","nome": "Scadenziario",      "descrizione": "Calendario eventi con ricorrenze",                           "icona": "CalendarDays", "ordine": 7},
    {"codice": "scanner",     "nome": "Scanner Documenti", "descrizione": "Scansione di ricevute e documenti da allegare ai movimenti", "icona": "ScanLine",     "ordine": 8},
    {"codice": "certificati", "nome": "Modelli Certificati","descrizione": "Personalizza il testo dei certificati stampabili",          "icona": "FileText",     "ordine": 9},
    {"codice": "importa",     "nome": "Importa Dati",      "descrizione": "Importa dati da file CSV o MDB (Access)",                    "icona": "Upload",       "ordine": 10},
]


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Create default admin user if no users exist
        if db.query(models.Utente).count() == 0:
            admin = models.Utente(
                nome="Admin",
                cognome="Parrocchia",
                email="admin@parrocchia.it",
                password_hash=hash_password("admin123"),
                ruolo="admin",
                attivo=True,
            )
            db.add(admin)
            db.commit()
            print(
                "\n"
                "⚠️  Nessun utente trovato. Creato utente admin: "
                "admin@parrocchia.it / admin123 — CAMBIA LA PASSWORD!\n"
            )

        # Seed moduli (idempotent — only adds missing ones)
        for m in _MODULI_DEFAULT:
            if not db.query(models.ModuloConfig).filter_by(codice=m["codice"]).first():
                db.add(models.ModuloConfig(**m))
        db.commit()
    finally:
        db.close()

    _scheduler.start()


@app.on_event("shutdown")
def on_shutdown():
    _scheduler.shutdown(wait=False)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── Frontend statico (produzione / desktop) ───────────────────────────────────
STATIC_DIR = get_static_dir()
if STATIC_DIR is not None:
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str, request: Request):
        # Leave API and uploads routes to their handlers
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)

        target = STATIC_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(str(target))

        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"detail": "Frontend non disponibile"}, status_code=404)
else:
    @app.get("/")
    def root():
        return {"message": "ReChurch API", "version": "2.1.0"}
