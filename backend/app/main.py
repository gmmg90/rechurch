from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles
import os

from app.database import engine, Base
from app.routers import battesimi, cresime, matrimoni, import_data, stats
from app.routers import config as config_router
from app.routers import pdf as pdf_router

app = FastAPI(
    title="ReChurch API",
    description="Gestione certificati ecclesiastici",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(battesimi.router)
app.include_router(cresime.router)
app.include_router(matrimoni.router)
app.include_router(import_data.router)
app.include_router(stats.router)
app.include_router(config_router.router)
app.include_router(pdf_router.router)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "ReChurch API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
