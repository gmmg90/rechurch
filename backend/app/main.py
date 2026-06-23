import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import engine, Base, SessionLocal
from app import models
from app.auth import hash_password
from app.routers import battesimi, cresime, matrimoni, import_data, stats
from app.routers import config as config_router
from app.routers import pdf as pdf_router
from app.routers import auth as auth_router
from app.routers import backup as backup_router
from app.routers import rubrica as rubrica_router
from app.routers import contabilita as contabilita_router
from app.routers import scadenziario as scadenziario_router

app = FastAPI(
    title="ReChurch API",
    description="Gestione certificati ecclesiastici",
    version="1.0.0",
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
app.include_router(auth_router.router)
app.include_router(backup_router.router)
app.include_router(battesimi.router)
app.include_router(cresime.router)
app.include_router(matrimoni.router)
app.include_router(import_data.router)
app.include_router(stats.router)
app.include_router(config_router.router)
app.include_router(pdf_router.router)
app.include_router(rubrica_router.router)
app.include_router(contabilita_router.router)
app.include_router(scadenziario_router.router)

# ── Static files ──────────────────────────────────────────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ── Scheduler ─────────────────────────────────────────────────────────────────
def _run_scheduled_backup():
    """Scheduled backup job — runs daily at 02:00."""
    import shutil
    from datetime import datetime
    from pathlib import Path

    db_url = os.getenv("DATABASE_URL", "sqlite:///./rechurch.db")
    if not db_url.startswith("sqlite:///"):
        return

    raw = db_url[len("sqlite:///"):]
    backend_dir = Path(__file__).resolve().parent.parent
    db_path = Path(raw) if os.path.isabs(raw) else (backend_dir / raw).resolve()

    if not db_path.exists():
        print(f"[backup] Database non trovato: {db_path}")
        return

    backup_dir = backend_dir / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"rechurch_{timestamp}.db"
    dest = backup_dir / filename
    shutil.copy2(str(db_path), str(dest))
    print(f"[backup] Backup automatico creato: {filename}")


_scheduler = BackgroundScheduler()
_scheduler.add_job(_run_scheduled_backup, "cron", hour=2, minute=0)


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    # Create default admin user if no users exist
    db = SessionLocal()
    try:
        count = db.query(models.Utente).count()
        if count == 0:
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
    finally:
        db.close()

    _scheduler.start()


@app.on_event("shutdown")
def on_shutdown():
    _scheduler.shutdown(wait=False)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "ReChurch API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
