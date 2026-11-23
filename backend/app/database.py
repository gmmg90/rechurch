import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

from app.paths import get_db_path

load_dotenv()

# DATABASE_URL wins if explicitly set (web / server deployment).
# Otherwise fall back to the resolved data-dir path (desktop / packaged app),
# which is backend/rechurch.db in dev, C:\ReChurch\rechurch.db when frozen and
# /data/rechurch.db in Docker (RECHURCH_DATA_DIR=/data, one volume per parish).
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{get_db_path()}"

IS_SQLITE = DATABASE_URL.startswith("sqlite")

connect_args = {}
if IS_SQLITE:
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        # WAL: letture e scritture concorrenti (web + backup notturno) senza
        # "database is locked". busy_timeout: attende invece di fallire subito.
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA busy_timeout=30000")
        cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
