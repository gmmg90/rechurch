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

# System deps:
#  - mdbtools: import dei file Access (.mdb) via import_data.py
#  - tzdata: orario corretto per il backup notturno (TZ=Europe/Rome)
# (psycopg2-binary/reportlab arrivano come wheel, non servono altre lib.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends mdbtools tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RECHURCH_DATA_DIR=/data \
    TZ=Europe/Rome \
    PORT=8000 \
    FORWARDED_ALLOW_IPS=*

COPY backend/requirements.txt backend/requirements-cloud.txt /app/backend/
RUN pip install -r /app/backend/requirements-cloud.txt

COPY backend/ /app/backend/
# Built SPA goes where app.paths.get_static_dir() looks: <repo>/frontend/dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# L'app gira come utente non privilegiato; l'entrypoint sistema i permessi
# della cartella dati montata e poi cede i privilegi.
RUN useradd --system --uid 1000 --user-group --home-dir /app --shell /usr/sbin/nologin rechurch \
    && mkdir -p /data && chown rechurch:rechurch /data \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Persistent data (SQLite, uploads, backups) live here — one volume per parish.
VOLUME ["/data"]

WORKDIR /app/backend
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health', timeout=4)" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
# Honor the platform-provided $PORT (Render/Railway/Koyeb) with a sane default.
# --proxy-headers: dietro Caddy/reverse proxy usa IP e schema reali del client.
# Un solo worker: lo scheduler dei backup gira nel processo dell'app.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=\"${FORWARDED_ALLOW_IPS}\""]
