from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.paths import get_uploads_dir, get_static_dir, is_frozen
from app.routers import battesimi, cresime, matrimoni, comunioni, import_data, stats, anime, report_templates, backup
from app.routers import config as config_router
from app.routers import pdf as pdf_router

app = FastAPI(
    title="ReChurch API",
    description="Gestione certificati ecclesiastici",
    version="1.0.0",
)

# CORS solo per dev (frontend Vite su 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API routers ──────────────────────────────────────────────────────────────
# Prefisso /api per tutto, così il frontend statico può vivere su /
API = "/api"

app.include_router(battesimi.router, prefix=API)
app.include_router(cresime.router, prefix=API)
app.include_router(matrimoni.router, prefix=API)
app.include_router(comunioni.router, prefix=API)
app.include_router(import_data.router, prefix=API)
app.include_router(stats.router, prefix=API)
app.include_router(config_router.router, prefix=API)
app.include_router(pdf_router.router, prefix=API)
app.include_router(anime.router, prefix=API)
app.include_router(report_templates.router, prefix=API)
app.include_router(backup.router, prefix=API)

# Compatibilità: in dev il proxy Vite mappa /api → backend rimuovendo il prefisso;
# manteniamo anche le rotte non-prefissate per non rompere chi le usa direttamente.
app.include_router(battesimi.router)
app.include_router(cresime.router)
app.include_router(matrimoni.router)
app.include_router(comunioni.router)
app.include_router(import_data.router)
app.include_router(stats.router)
app.include_router(config_router.router)
app.include_router(pdf_router.router)
app.include_router(anime.router)
app.include_router(report_templates.router)
app.include_router(backup.router)

# ─── Uploads (logo parrocchia) ────────────────────────────────────────────────
UPLOAD_DIR = str(get_uploads_dir())
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads_api")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Frontend statico (produzione) ────────────────────────────────────────────
STATIC_DIR = get_static_dir()
if STATIC_DIR is not None:
    # Mount /assets (Vite mette qui CSS/JS/etc.)
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # SPA fallback: qualsiasi rotta sconosciuta serve index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str, request: Request):
        # Lascia le rotte API ai router (matchano prima)
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)

        # Se è un file statico nella root (favicon, logo, ecc.), serviamolo
        target = STATIC_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(str(target))

        # Altrimenti torna l'HTML della SPA
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"detail": "Frontend non disponibile"}, status_code=404)
else:
    @app.get("/")
    def root():
        return {
            "message": "ReChurch API",
            "version": "1.0.0",
            "frontend": "non buildato (dev mode: usa Vite su :5173)",
        }
