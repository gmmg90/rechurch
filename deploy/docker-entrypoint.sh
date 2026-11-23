#!/bin/sh
# Avvio del container ReChurch.
# Parte come root solo per sistemare i permessi della cartella dati montata
# (volume/bind mount di una parrocchia, eventualmente creato da root), poi
# esegue l'app come utente non privilegiato "rechurch".
set -e

DATA_DIR="${RECHURCH_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA_DIR"
    chown -R rechurch:rechurch "$DATA_DIR" 2>/dev/null || true
    exec setpriv --reuid=rechurch --regid=rechurch --init-groups "$@"
fi

exec "$@"
