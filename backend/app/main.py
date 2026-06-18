from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import battesimi, cresime, matrimoni, import_data, stats

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


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "ReChurch API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
