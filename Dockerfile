# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: backend runtime ──────────────────────────────────────────────────
FROM python:3.11-slim AS runtime
WORKDIR /app

# System deps kept minimal; psycopg2-binary/reportlab ship wheels.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RECHURCH_DATA_DIR=/data

COPY backend/requirements.txt backend/requirements-cloud.txt /app/backend/
RUN pip install -r /app/backend/requirements-cloud.txt

COPY backend/ /app/backend/
# Built SPA goes where app.paths.get_static_dir() looks: <repo>/frontend/dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Persistent data (SQLite, uploads, backups) live here — mount a volume in prod.
RUN mkdir -p /data
VOLUME ["/data"]

WORKDIR /app/backend
EXPOSE 8000

# Honor the platform-provided $PORT (Render/Railway/Koyeb) with a sane default.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
