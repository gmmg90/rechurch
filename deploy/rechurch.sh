#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# ReChurch — gestione di più parrocchie sullo stesso server (es. Kimsufi/OVH)
#
# Ogni parrocchia è un container separato con il PROPRIO database, i propri
# upload e i propri backup in  $RECHURCH_HOME/data/<slug>/ ; tutte usano la
# stessa immagine Docker. Caddy fa da reverse proxy con HTTPS automatico e
# instrada ogni dominio verso la parrocchia giusta.
#
#   $RECHURCH_HOME (default /srv/rechurch)
#   ├── .env                    impostazioni comuni (email ACME, owner, backup cloud)
#   ├── parrocchie/<slug>.env   impostazioni della singola parrocchia
#   ├── data/<slug>/            rechurch.db, uploads/, backups/   ← i dati
#   ├── backups/<slug>/         archivi creati da "rechurch.sh backup"
#   ├── archivio/               parrocchie rimosse (config; i dati restano in data/)
#   ├── docker-compose.yml      GENERATO — non modificare a mano
#   └── caddy/                  Caddyfile generato + certificati
#
# Uso:  sudo deploy/rechurch.sh <comando> [argomenti]   (help per l'elenco)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${RECHURCH_HOME:-/srv/rechurch}"
IMAGE="${RECHURCH_IMAGE:-rechurch:latest}"
PROJECT="rechurch"

PANNELLO_DIR="${RECHURCH_PANNELLO_DIR:-/opt/rechurch-pannello}"
PANNELLO_PORT=9300

# Colori solo su terminale (il pannello web legge l'output in chiaro)
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_ERR=$'\e[31m'; C_B=$'\e[1m'; C_0=$'\e[0m'
else
    C_OK=''; C_WARN=''; C_ERR=''; C_B=''; C_0=''
fi
info() { echo "${C_B}==>${C_0} $*"; }
ok()   { echo "${C_OK}✔${C_0} $*"; }
warn() { echo "${C_WARN}!${C_0} $*" >&2; }
die()  { echo "${C_ERR}✘ $*${C_0}" >&2; exit 1; }

dc() { docker compose --project-name "$PROJECT" --project-directory "$HOME_DIR" -f "$HOME_DIR/docker-compose.yml" "$@"; }

# ── utilità ───────────────────────────────────────────────────────────────────

# Legge KEY da un file .env senza eseguirlo (niente "source": i valori sono dati)
get_var() {
    local file="$1" key="$2" line
    [[ -f "$file" ]] || return 0
    line="$(grep -E "^${key}=" "$file" | tail -n1 || true)"
    line="${line#*=}"
    line="${line%\"}"; line="${line#\"}"
    printf '%s' "$line"
}

set_var() {  # set_var file KEY valore — aggiorna o aggiunge
    local file="$1" key="$2" val="$3" tmp
    tmp="$(mktemp)"
    grep -vE "^${key}=" "$file" > "$tmp" || true
    printf '%s="%s"\n' "$key" "$val" >> "$tmp"
    cat "$tmp" > "$file"; rm -f "$tmp"
}

del_var() {
    local file="$1" key="$2" tmp
    tmp="$(mktemp)"
    grep -vE "^${key}=" "$file" > "$tmp" || true
    cat "$tmp" > "$file"; rm -f "$tmp"
}

random_secret() { openssl rand -hex 32; }
# Password leggibile (niente caratteri ambigui o speciali che rompono gli .env)
random_password() {
    # "|| true": head chiude la pipe e tr esce con SIGPIPE (fatale con pipefail)
    local p; p="$(LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9' < /dev/urandom | head -c 16 || true)"
    printf '%s' "$p"
}

need_root() { [[ $EUID -eq 0 ]] || die "Esegui come root (sudo)."; }

# Conferma interattiva; RECHURCH_YES=1 (usato dal pannello web) risponde sì
conferma() {
    [[ "${RECHURCH_YES:-}" == "1" ]] && return 0
    local r; read -r -p "$1 [s/N] " r
    [[ "$r" =~ ^[sS]$ ]]
}

# Normalizza e valida una lista di domini separati da virgole.
# "auto" (o vuoto) = <slug>.<DOMINIO_BASE> del file .env comune.
valida_domini() {  # valida_domini <slug> <domini> → stampa la lista normalizzata
    local slug="$1" domains="$2" base d altri out=()
    domains="$(echo "$domains" | tr 'A-Z' 'a-z' | tr -d ' ')"
    if [[ -z "$domains" || "$domains" == "auto" ]]; then
        base="$(get_var "$HOME_DIR/.env" DOMINIO_BASE)"
        [[ -n "$base" ]] || die "Imposta DOMINIO_BASE in $HOME_DIR/.env oppure indica il dominio."
        domains="${slug}.${base}"
    fi
    for d in ${domains//,/ }; do
        [[ "$d" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || die "Dominio non valido: $d"
        # Già usato da un'altra parrocchia?
        for altri in "$HOME_DIR"/parrocchie/*.env; do
            [[ -f "$altri" && "$(basename "$altri" .env)" != "$slug" ]] || continue
            if [[ ",$(get_var "$altri" DOMAINS)," == *",$d,"* ]]; then
                die "Il dominio $d è già usato dalla parrocchia $(basename "$altri" .env)."
            fi
        done
        [[ "$d" == "$(get_var "$HOME_DIR/.env" PANNELLO_DOMAIN)" ]] && die "Il dominio $d è quello del pannello."
        out+=("$d")
    done
    (IFS=,; echo "${out[*]}")
}
need_init() { [[ -f "$HOME_DIR/.env" ]] || die "Server non inizializzato: esegui prima '$0 init'."; }

valid_slug() { [[ "$1" =~ ^[a-z0-9][a-z0-9-]{1,30}$ ]] || die "Slug non valido '$1': solo minuscole, numeri e '-', 2-31 caratteri (es. sanrocco-gela)."; }

parish_env() { echo "$HOME_DIR/parrocchie/$1.env"; }

list_slugs() {
    local f
    shopt -s nullglob
    for f in "$HOME_DIR"/parrocchie/*.env; do basename "$f" .env; done
    shopt -u nullglob
}

exists_slug() { [[ -f "$(parish_env "$1")" ]] || die "Parrocchia '$1' non trovata (vedi '$0 list')."; }

# ── generazione docker-compose.yml + Caddyfile ────────────────────────────────

generate() {
    need_init
    local compose="$HOME_DIR/docker-compose.yml" caddy="$HOME_DIR/caddy/conf/Caddyfile"
    local acme slug domains tmp pannello
    acme="$(get_var "$HOME_DIR/.env" ACME_EMAIL)"
    mkdir -p "$HOME_DIR/caddy/conf" "$HOME_DIR/caddy/data" "$HOME_DIR/caddy/config"

    # docker-compose.yml
    tmp="$(mktemp)"
    cat > "$tmp" <<EOF
# GENERATO da deploy/rechurch.sh — non modificare a mano: verrà sovrascritto.
# Per cambiare una parrocchia modifica parrocchie/<slug>.env e lancia "rechurch.sh up".
x-parrocchia: &parrocchia
  image: ${IMAGE}
  restart: unless-stopped
  mem_limit: \${MEM_LIMIT:-512m}
  networks: [rechurch]
  logging:
    driver: json-file
    options: { max-size: "10m", max-file: "3" }

services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./caddy/conf:/etc/caddy:ro
      - ./caddy/data:/data
      - ./caddy/config:/config
    # Il pannello del gestore gira sull'host (deve comandare Docker)
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks: [rechurch]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
EOF
    for slug in $(list_slugs); do
        cat >> "$tmp" <<EOF

  p-${slug}:
    <<: *parrocchia
    env_file:
      - .env
      - parrocchie/${slug}.env
    environment:
      RECHURCH_TENANT: "${slug}"
      RECHURCH_DATA_DIR: /data
    volumes:
      - ./data/${slug}:/data
EOF
    done
    cat >> "$tmp" <<'EOF'

networks:
  rechurch: {}
EOF
    cat "$tmp" > "$compose"; rm -f "$tmp"

    # Caddyfile (scritto in place: il container monta la cartella)
    tmp="$(mktemp)"
    {
        echo "# GENERATO da deploy/rechurch.sh — non modificare a mano."
        echo "{"
        [[ -n "$acme" ]] && echo "	email $acme"
        echo "}"
        cat <<'EOF'

(comune) {
	encode zstd gzip
	request_body {
		max_size 200MB
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}
EOF
        for slug in $(list_slugs); do
            domains="$(get_var "$(parish_env "$slug")" DOMAINS | tr ',' ' ' | xargs)"
            [[ -n "$domains" ]] || { warn "Parrocchia $slug senza DOMAINS: saltata nel proxy"; continue; }
            echo
            echo "# $(get_var "$(parish_env "$slug")" PARROCCHIA_NOME) [$slug]"
            echo "${domains// /, } {"
            echo "	import comune"
            echo "	reverse_proxy p-${slug}:8000"
            echo "}"
        done
        pannello="$(get_var "$HOME_DIR/.env" PANNELLO_DOMAIN)"
        if [[ -n "$pannello" ]]; then
            echo
            echo "# Pannello del gestore (servizio rechurch-pannello sull'host)"
            echo "$pannello {"
            echo "	import comune"
            echo "	header Cache-Control \"no-store\""
            echo "	reverse_proxy host.docker.internal:${PANNELLO_PORT}"
            echo "}"
        fi
    } > "$tmp"
    cat "$tmp" > "$caddy"; rm -f "$tmp"
}

caddy_reload() {
    if [[ -n "$(dc ps -q caddy 2>/dev/null)" ]]; then
        dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null \
            && ok "Proxy HTTPS ricaricato" || warn "Ricarica di Caddy fallita: controlla '$0 logs caddy'"
    fi
}

wait_healthy() {  # wait_healthy <slug>
    local id status
    for _ in $(seq 1 45); do
        id="$(dc ps -q "p-$1" 2>/dev/null || true)"
        if [[ -n "$id" ]]; then
            status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
            [[ "$status" == "healthy" ]] && return 0
            [[ "$status" == "unhealthy" || "$status" == "exited" ]] && return 1
        fi
        sleep 2
    done
    return 1
}

# ── comandi ───────────────────────────────────────────────────────────────────

cmd_init() {
    need_root
    command -v docker >/dev/null || die "Docker non installato: esegui prima deploy/kimsufi-setup.sh"
    mkdir -p "$HOME_DIR"/{parrocchie,data,backups,archivio,caddy/conf,caddy/data,caddy/config}
    chmod 700 "$HOME_DIR/parrocchie" "$HOME_DIR/archivio"
    if [[ ! -f "$HOME_DIR/.env" ]]; then
        cp "$REPO_DIR/deploy/env.globale.example" "$HOME_DIR/.env"
        chmod 600 "$HOME_DIR/.env"
        ok "Creato $HOME_DIR/.env — compilalo (almeno ACME_EMAIL) prima di aggiungere parrocchie"
    else
        ok "$HOME_DIR/.env già presente"
    fi
    cmd_build
    generate
    dc up -d --remove-orphans
    git -C "$REPO_DIR" rev-parse HEAD > "$HOME_DIR/.versione-installata" 2>/dev/null || true
    if [[ -d /run/systemd/system ]] && ! systemctl is-enabled --quiet rechurch-aggiornamento.timer 2>/dev/null; then
        cmd_aggiornamenti attiva
    fi
    ok "Inizializzazione completata. Prossimo passo: $0 add <slug> <dominio> \"Nome parrocchia\""
}

cmd_build() {
    if [[ "${RECHURCH_SKIP_BUILD:-}" == "1" ]]; then
        warn "RECHURCH_SKIP_BUILD=1: uso l'immagine $IMAGE già presente"
        return 0
    fi
    info "Build dell'immagine $IMAGE da $REPO_DIR"
    local rev
    rev="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo dev)"
    docker build -t "$IMAGE" -t "rechurch:$rev" "$REPO_DIR"
    ok "Immagine pronta (rechurch:$rev)"
}

cmd_add() {
    need_root; need_init
    local slug="${1:-}" domains="${2:-}" nome="${3:-}" admin_email="${4:-}"
    [[ -n "$slug" && -n "$nome" ]] || die "Uso: $0 add <slug> <dominio[,altro-dominio]|auto> \"Nome parrocchia\" [email-admin]"
    valid_slug "$slug"
    local envf; envf="$(parish_env "$slug")"
    [[ -f "$envf" ]] && die "La parrocchia '$slug' esiste già."
    [[ -d "$HOME_DIR/data/$slug" && -n "$(ls -A "$HOME_DIR/data/$slug" 2>/dev/null)" ]] && \
        warn "Esiste già una cartella dati per '$slug': verrà riutilizzata (dati esistenti)."

    domains="$(valida_domini "$slug" "$domains")"

    [[ -n "$admin_email" ]] || admin_email="admin@${domains%%,*}"
    local password; password="$(random_password)"

    # Backup notturni sfalsati: ogni parrocchia parte a un minuto diverso
    local n minute hour
    n="$(list_slugs | wc -l)"
    minute=$(( (n * 7) % 60 )); hour=$(( 2 + (n * 7) / 60 )); (( hour > 5 )) && hour=5

    umask 077
    cat > "$envf" <<EOF
# Parrocchia: $nome
# Creato il $(date '+%Y-%m-%d %H:%M') da rechurch.sh. Dopo una modifica: rechurch.sh up
PARROCCHIA_NOME="$nome"
DOMAINS="$domains"
SECRET_KEY="$(random_secret)"
ADMIN_EMAIL="$admin_email"
ADMIN_PASSWORD="$password"
BACKUP_HOUR="$hour"
BACKUP_MINUTE="$minute"
# Backup cloud in una sottocartella dedicata a questa parrocchia
DROPBOX_FOLDER="/ReChurch/$slug"
# Google Drive: ID della cartella di QUESTA parrocchia (sovrascrive quello comune)
#GDRIVE_FOLDER_ID=""
# Facoltativo: nome della chiesa parrocchiale se diverso dal nome della parrocchia
#CHIESA_PRINCIPALE=""
EOF
    umask 022
    mkdir -p "$HOME_DIR/data/$slug"

    generate
    info "Avvio di $slug..."
    dc up -d "p-$slug"
    dc up -d caddy
    caddy_reload

    if wait_healthy "$slug"; then
        # La password iniziale serve solo al primo avvio: non la lasciamo su disco
        del_var "$envf" ADMIN_PASSWORD
        ok "Parrocchia '$nome' attiva"
        echo
        echo "   Indirizzo:  https://${domains%%,*}"
        echo "   Utente:     $admin_email"
        echo "   Password:   $password"
        echo
        warn "Annota ora la password (non viene salvata) e falla cambiare al primo accesso."
        warn "Ricorda il record DNS:  ${domains%%,*}  A  $(hostname -I 2>/dev/null | awk '{print $1}' || echo '<IP del server>')"
    else
        warn "Il container non risulta pronto: controlla con '$0 logs $slug'."
        warn "Password iniziale (ancora in $envf): $password"
    fi
}

cmd_remove() {
    need_root; need_init
    local slug="${1:-}"; [[ -n "$slug" ]] || die "Uso: $0 remove <slug>"
    exists_slug "$slug"
    conferma "Disattivare la parrocchia '$slug'? I dati in data/$slug NON vengono cancellati." || { echo "Annullato."; return; }
    dc stop "p-$slug" >/dev/null 2>&1 || true
    dc rm -f "p-$slug" >/dev/null 2>&1 || true
    mv "$(parish_env "$slug")" "$HOME_DIR/archivio/$slug.$(date +%Y%m%d%H%M).env"
    generate; caddy_reload
    ok "Parrocchia '$slug' disattivata. Config in archivio/, dati ancora in data/$slug."
}

cmd_list() {
    need_init
    local slug envf id status
    printf "%-22s %-36s %-10s %s\n" "SLUG" "DOMINI" "STATO" "NOME"
    for slug in $(list_slugs); do
        envf="$(parish_env "$slug")"
        id="$(dc ps -q "p-$slug" 2>/dev/null || true)"
        status="fermo"
        [[ -n "$id" ]] && status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo '?')"
        printf "%-22s %-36s %-10s %s\n" "$slug" "$(get_var "$envf" DOMAINS)" "$status" "$(get_var "$envf" PARROCCHIA_NOME)"
    done
}

cmd_up() {
    need_root; need_init
    generate
    dc up -d --remove-orphans
    caddy_reload
    ok "Tutte le parrocchie avviate"
}

cmd_update() {
    need_root; need_init
    # Un solo aggiornamento alla volta (terminale, pannello o automatico)
    exec 9>"$HOME_DIR/.lock-aggiornamento"
    flock -n 9 || die "C'è già un aggiornamento in corso."
    info "Aggiornamento del codice in $REPO_DIR"
    git -C "$REPO_DIR" pull --ff-only
    info "Backup di sicurezza prima dell'aggiornamento"
    cmd_backup all || warn "Backup pre-aggiornamento non riuscito per qualche parrocchia"
    cmd_build
    cmd_up
    docker image prune -f >/dev/null || true
    # Pannello del gestore: dipendenze e riavvio col codice nuovo (in differita,
    # perché l'aggiornamento può essere stato lanciato proprio dal pannello)
    if [[ -x "$PANNELLO_DIR/venv/bin/pip" ]]; then
        "$PANNELLO_DIR/venv/bin/pip" install -q -r "$REPO_DIR/deploy/pannello/requirements.txt" || true
    fi
    if systemctl is-active --quiet rechurch-pannello 2>/dev/null; then
        ok "Il pannello si riavvia tra pochi secondi con la nuova versione"
        # Timer di systemd a parte: un "sleep &" verrebbe ucciso a fine
        # aggiornamento insieme al servizio rechurch-aggiornamento (o al pannello)
        systemctl reset-failed rechurch-pannello-riavvio.timer rechurch-pannello-riavvio.service >/dev/null 2>&1 || true
        systemd-run --quiet --collect --unit=rechurch-pannello-riavvio --on-active=5 \
            systemctl try-restart rechurch-pannello >/dev/null 2>&1 \
            || { (sleep 5; systemctl try-restart rechurch-pannello) >/dev/null 2>&1 & }
    fi
    git -C "$REPO_DIR" rev-parse HEAD > "$HOME_DIR/.versione-installata"
    ok "Versione installata: $(git -C "$REPO_DIR" log -1 --format='%h %s')"
}

# ── aggiornamenti automatici da GitHub ────────────────────────────────────────

STATO_AUTO() { echo "$HOME_DIR/aggiornamento-automatico.stato"; }

scrivi_stato_auto() {  # scrivi_stato_auto <esito> <messaggio>
    {
        echo "CONTROLLO=\"$(date '+%Y-%m-%d %H:%M')\""
        echo "ESITO=\"$1\""
        echo "MESSAGGIO=\"$2\""
        echo "VERSIONE=\"$(git -C "$REPO_DIR" log -1 --format='%h %ad' --date=short 2>/dev/null)\""
    } > "$(STATO_AUTO)"
}

# Controlla GitHub e aggiorna solo se c'è una versione nuova del branch.
# Confronta con l'ultima versione installata con successo: se un aggiornamento
# fallisce (es. build), il tentativo si ripete al controllo successivo.
cmd_auto_update() {
    need_root; need_init
    local branch remoto installata
    branch="$(get_var "$HOME_DIR/.env" RECHURCH_BRANCH)"; branch="${branch:-main}"
    if ! git -C "$REPO_DIR" fetch -q origin "$branch"; then
        scrivi_stato_auto "errore" "GitHub non raggiungibile"
        die "Impossibile contattare GitHub"
    fi
    remoto="$(git -C "$REPO_DIR" rev-parse "origin/$branch")"
    installata="$(cat "$HOME_DIR/.versione-installata" 2>/dev/null || true)"
    if [[ "$remoto" == "$installata" ]]; then
        scrivi_stato_auto "aggiornato" "Nessuna novità"
        echo "$(date '+%F %T') nessun aggiornamento ($branch ${remoto:0:7})"
        return 0
    fi
    if [[ -n "$(git -C "$REPO_DIR" status --porcelain --untracked-files=no)" ]]; then
        scrivi_stato_auto "errore" "Modifiche locali nel codice: aggiornamento sospeso"
        die "Ci sono modifiche locali in $REPO_DIR: aggiornamento automatico sospeso."
    fi
    if [[ "$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)" != "$branch" ]]; then
        git -C "$REPO_DIR" checkout -q "$branch"
    fi
    echo "$(date '+%F %T') nuova versione ${remoto:0:7}: aggiornamento"
    # Nuovo processo: dopo il pull esegue lo script nella versione aggiornata
    if "$REPO_DIR/deploy/rechurch.sh" update; then
        scrivi_stato_auto "ok" "Aggiornato alla nuova versione"
    else
        scrivi_stato_auto "errore" "Aggiornamento fallito: le parrocchie restano sulla versione precedente"
        die "Aggiornamento fallito (vedi /var/log/rechurch-aggiornamento.log)"
    fi
}

cmd_aggiornamenti() {
    need_root; need_init
    local sub="${1:-stato}" ora="${2:-04:30}"
    case "$sub" in
        attiva)
            [[ -d /run/systemd/system ]] || die "Serve systemd"
            [[ "$ora" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || die "Orario non valido: $ora (es. 04:30)"
            {
                echo "[Unit]"
                echo "Description=ReChurch - aggiornamento automatico da GitHub"
                echo "After=network-online.target docker.service"
                echo "Wants=network-online.target"
                echo
                echo "[Service]"
                echo "Type=oneshot"
                echo "Environment=RECHURCH_HOME=$HOME_DIR"
                echo "ExecStart=$REPO_DIR/deploy/rechurch.sh auto-update"
                echo "StandardOutput=append:/var/log/rechurch-aggiornamento.log"
                echo "StandardError=append:/var/log/rechurch-aggiornamento.log"
                echo "TimeoutStartSec=2h"
            } > /etc/systemd/system/rechurch-aggiornamento.service
            {
                echo "[Unit]"
                echo "Description=ReChurch - controllo giornaliero degli aggiornamenti"
                echo
                echo "[Timer]"
                echo "OnCalendar=*-*-* $ora:00"
                echo "RandomizedDelaySec=10m"
                echo "Persistent=true"
                echo
                echo "[Install]"
                echo "WantedBy=timers.target"
            } > /etc/systemd/system/rechurch-aggiornamento.timer
            systemctl daemon-reload
            systemctl enable --now rechurch-aggiornamento.timer >/dev/null 2>&1
            [[ -f "$HOME_DIR/.versione-installata" ]] || git -C "$REPO_DIR" rev-parse HEAD > "$HOME_DIR/.versione-installata"
            ok "Aggiornamenti automatici attivi: ogni notte alle $ora controllo di GitHub" ;;
        disattiva)
            systemctl disable --now rechurch-aggiornamento.timer >/dev/null 2>&1 || true
            ok "Aggiornamenti automatici disattivati" ;;
        ora)
            systemctl start --no-block rechurch-aggiornamento.service
            ok "Controllo avviato: tail -f /var/log/rechurch-aggiornamento.log" ;;
        stato)
            if systemctl is-enabled --quiet rechurch-aggiornamento.timer 2>/dev/null; then
                echo "Aggiornamenti automatici: attivi"
                systemctl list-timers rechurch-aggiornamento.timer --no-pager 2>/dev/null | sed -n 2p
            else
                echo "Aggiornamenti automatici: disattivati"
            fi
            [[ -f "$(STATO_AUTO)" ]] && cat "$(STATO_AUTO)"
            tail -n 5 /var/log/rechurch-aggiornamento.log 2>/dev/null || true ;;
        *) die "Uso: $0 aggiornamenti attiva [HH:MM] | disattiva | ora | stato" ;;
    esac
}

cmd_backup() {
    need_root; need_init
    local target="${1:-all}" slugs slug out keep ts db_path name dest
    keep="$(get_var "$HOME_DIR/.env" SERVER_BACKUP_KEEP)"; keep="${keep:-14}"
    if [[ "$target" == "all" ]]; then slugs="$(list_slugs)"; else exists_slug "$target"; slugs="$target"; fi
    local fail=0
    for slug in $slugs; do
        ts="$(date +%Y%m%d_%H%M%S)"
        # Copia consistente del DB fatta dall'app stessa (API di backup SQLite)
        if ! out="$(dc exec -T "p-$slug" python -c 'from app.backup_utils import crea_backup_locale as b; print(b())' 2>&1)"; then
            warn "[$slug] backup fallito: $out"; fail=1; continue
        fi
        db_path="$(echo "$out" | tail -n1)"; name="$(basename "$db_path")"
        mkdir -p "$HOME_DIR/backups/$slug"
        dest="$HOME_DIR/backups/$slug/${slug}_${ts}.tar.gz"
        tar -czf "$dest" -C "$HOME_DIR/data/$slug" "backups/$name" uploads 2>/dev/null \
            || tar -czf "$dest" -C "$HOME_DIR/data/$slug" "backups/$name"
        chmod 600 "$dest"
        ls -1t "$HOME_DIR/backups/$slug"/*.tar.gz 2>/dev/null | tail -n +$((keep + 1)) | xargs -r rm -f
        ok "[$slug] $(du -h "$dest" | cut -f1)  $dest"
    done
    return $fail
}

cmd_restore() {
    need_root; need_init
    local slug="${1:-}" file="${2:-}"
    [[ -n "$slug" && -n "$file" ]] || die "Uso: $0 restore <slug> <file.db | archivio.tar.gz>"
    exists_slug "$slug"; [[ -f "$file" ]] || die "File non trovato: $file"
    local data="$HOME_DIR/data/$slug" tmpd db
    tmpd="$(mktemp -d)"
    if [[ "$file" == *.tar.gz ]]; then
        tar -xzf "$file" -C "$tmpd"
        db="$(ls -1 "$tmpd"/backups/rechurch_*.db | head -n1)"
    else
        cp "$file" "$tmpd/"; db="$tmpd/$(basename "$file")"
    fi
    [[ -f "$db" ]] || die "Nessun database nel file indicato."
    conferma "Sostituire il database di '$slug' con $(basename "$db")? L'attuale viene conservato." || { rm -rf "$tmpd"; echo "Annullato."; return; }

    dc stop "p-$slug"
    local ts; ts="$(date +%Y%m%d_%H%M%S)"
    [[ -f "$data/rechurch.db" ]] && mv "$data/rechurch.db" "$data/rechurch.db.prima-del-ripristino-$ts"
    rm -f "$data/rechurch.db-wal" "$data/rechurch.db-shm"
    cp "$db" "$data/rechurch.db"
    if [[ -d "$tmpd/uploads" ]]; then
        [[ -d "$data/uploads" ]] && mv "$data/uploads" "$data/uploads.prima-del-ripristino-$ts"
        cp -a "$tmpd/uploads" "$data/uploads"
    fi
    rm -rf "$tmpd"
    dc up -d "p-$slug"
    wait_healthy "$slug" && ok "Ripristino completato per '$slug'" || warn "Controlla '$0 logs $slug'"
}

cmd_reset_password() {
    need_root; need_init
    local slug="${1:-}" email="${2:-}"
    [[ -n "$slug" && -n "$email" ]] || die "Uso: $0 reset-password <slug> <email-utente>"
    exists_slug "$slug"
    local pw; pw="$(random_password)"
    dc exec -T -e RP_EMAIL="$email" -e RP_PW="$pw" "p-$slug" python - <<'EOF'
import os, sys
from app.database import SessionLocal
from app.auth import hash_password
from app import models
db = SessionLocal()
u = db.query(models.Utente).filter(models.Utente.email == os.environ["RP_EMAIL"]).first()
if not u:
    sys.exit("Utente non trovato")
u.password_hash = hash_password(os.environ["RP_PW"]); u.attivo = True
from datetime import datetime, timezone
u.deve_cambiare_password = True; u.password_cambiata_il = datetime.now(timezone.utc)
db.commit()
EOF
    ok "Nuova password per $email ($slug): $pw"
}

cmd_domini() {
    need_root; need_init
    local slug="${1:-}" domains="${2:-}"
    [[ -n "$slug" && -n "$domains" ]] || die "Uso: $0 domini <slug> <dominio[,altro]|auto>"
    exists_slug "$slug"
    domains="$(valida_domini "$slug" "$domains")"
    set_var "$(parish_env "$slug")" DOMAINS "$domains"
    generate; dc up -d caddy >/dev/null; caddy_reload
    ok "Domini di '$slug': $domains"
    warn "Ricorda i record DNS (A) di questi domini verso l'IP del server."
}

# ── pannello web del gestore ──────────────────────────────────────────────────

pannello_env() { echo "$HOME_DIR/pannello.env"; }

pannello_py() { "$PANNELLO_DIR/venv/bin/python" "$REPO_DIR/deploy/pannello/pannello.py" "$@"; }

cmd_pannello() {
    need_root; need_init
    local sub="${1:-}"; shift || true
    case "$sub" in
        installa) pannello_installa "$@" ;;
        password) pannello_password ;;
        otp) pannello_otp ;;
        stato) systemctl --no-pager status rechurch-pannello || true ;;
        disattiva)
            systemctl disable --now rechurch-pannello 2>/dev/null || true
            del_var "$HOME_DIR/.env" PANNELLO_DOMAIN
            generate; caddy_reload
            ok "Pannello disattivato." ;;
        *) die "Uso: $0 pannello installa <dominio> <email> | password | otp | stato | disattiva" ;;
    esac
}

pannello_installa() {
    local dominio="${1:-}" email="${2:-}"
    [[ -n "$dominio" && -n "$email" ]] || die "Uso: $0 pannello installa <dominio-pannello> <tua-email>"
    [[ "$dominio" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Dominio non valido: $dominio"
    [[ "$email" =~ ^[^@[:space:]]+@[^@[:space:]]+$ ]] || die "Email non valida: $email"
    command -v python3 >/dev/null || die "Serve python3"

    info "Ambiente Python del pannello in $PANNELLO_DIR"
    mkdir -p "$PANNELLO_DIR"
    [[ -x "$PANNELLO_DIR/venv/bin/python" ]] || python3 -m venv "$PANNELLO_DIR/venv" \
        || die "Creazione venv fallita (apt-get install python3-venv)"
    "$PANNELLO_DIR/venv/bin/pip" install -q --upgrade pip
    "$PANNELLO_DIR/venv/bin/pip" install -q -r "$REPO_DIR/deploy/pannello/requirements.txt"

    local envf; envf="$(pannello_env)"
    umask 077
    [[ -f "$envf" ]] || printf '# Pannello del gestore — generato da rechurch.sh pannello installa\n' > "$envf"
    grep -q '^PANNELLO_SESSION_KEY=' "$envf" || set_var "$envf" PANNELLO_SESSION_KEY "$(random_secret)"
    set_var "$envf" PANNELLO_EMAIL "$email"
    set_var "$envf" RECHURCH_HOME "$HOME_DIR"
    set_var "$envf" RECHURCH_SCRIPT "$REPO_DIR/deploy/rechurch.sh"
    umask 022

    {
        echo "[Unit]"
        echo "Description=ReChurch - pannello web del gestore"
        echo "After=network-online.target docker.service"
        echo "Requires=docker.service"
        echo
        echo "[Service]"
        echo "EnvironmentFile=$envf"
        echo "ExecStart=$PANNELLO_DIR/venv/bin/uvicorn pannello:app --app-dir $REPO_DIR/deploy/pannello --host 0.0.0.0 --port $PANNELLO_PORT"
        echo "Restart=on-failure"
        echo "NoNewPrivileges=yes"
        echo "PrivateTmp=yes"
        echo
        echo "[Install]"
        echo "WantedBy=multi-user.target"
    } > /etc/systemd/system/rechurch-pannello.service

    # Raggiungibile solo dai container (Caddy), mai direttamente da Internet
    if command -v ufw >/dev/null; then
        ufw allow from 172.16.0.0/12 to any port "$PANNELLO_PORT" proto tcp comment 'ReChurch pannello (da Caddy)' >/dev/null || true
    fi

    set_var "$HOME_DIR/.env" PANNELLO_DOMAIN "$dominio"
    generate
    dc up -d caddy >/dev/null
    caddy_reload

    grep -q '^PANNELLO_PASSWORD_HASH=' "$envf" || pannello_password
    grep -q '^PANNELLO_TOTP_SECRET=' "$envf" || pannello_otp
    systemctl daemon-reload
    systemctl enable rechurch-pannello >/dev/null 2>&1
    systemctl restart rechurch-pannello
    ok "Pannello attivo su https://$dominio (serve il record DNS A verso questo server)"
}

pannello_password() {
    local envf pw; envf="$(pannello_env)"
    [[ -f "$envf" ]] || die "Pannello non installato: $0 pannello installa <dominio> <email>"
    pw="$(random_password)$(random_password)"
    set_var "$envf" PANNELLO_PASSWORD_HASH "$(printf '%s' "$pw" | pannello_py hash-password)"
    systemctl restart rechurch-pannello 2>/dev/null || true
    echo
    echo "   Password del pannello: $pw"
    echo
    warn "Annotala ora in un gestore di password: non viene salvata in chiaro."
}

pannello_otp() {
    local envf secret email uri; envf="$(pannello_env)"
    [[ -f "$envf" ]] || die "Pannello non installato: $0 pannello installa <dominio> <email>"
    secret="$(pannello_py nuovo-segreto-otp)"
    set_var "$envf" PANNELLO_TOTP_SECRET "$secret"
    email="$(get_var "$envf" PANNELLO_EMAIL)"
    uri="otpauth://totp/ReChurch:${email}?secret=${secret}&issuer=ReChurch"
    systemctl restart rechurch-pannello 2>/dev/null || true
    echo
    echo "   Codice OTP (2FA): aggiungilo all'app Authenticator (Google/Microsoft Authenticator, Aegis, 1Password...)"
    command -v qrencode >/dev/null && qrencode -t ansiutf8 "$uri"
    echo "   Chiave da inserire a mano: $secret"
    echo
}

cmd_logs()    { need_init; local s="${1:-}"; [[ -z "$s" ]] && { dc logs --tail=100 -f; return; }; [[ "$s" == caddy ]] && { dc logs --tail=200 -f caddy; return; }; exists_slug "$s"; dc logs --tail=200 -f "p-$s"; }
cmd_restart() { need_root; need_init; local s="${1:-}"; [[ -n "$s" ]] || die "Uso: $0 restart <slug>"; exists_slug "$s"; dc restart "p-$s"; }
cmd_shell()   { need_root; need_init; local s="${1:-}"; [[ -n "$s" ]] || die "Uso: $0 shell <slug>"; exists_slug "$s"; dc exec "p-$s" sh; }

cmd_help() {
    cat <<EOF
ReChurch — gestione multi-parrocchia   (dati in $HOME_DIR)

  init                                   prepara $HOME_DIR, builda l'immagine, avvia il proxy
  add <slug> <dominio[,dom2]|auto> "Nome" [email-admin]
                                         ("auto" = <slug>.DOMINIO_BASE)
                                         crea una parrocchia (DB nuovo e separato) e la avvia
  list                                   elenca le parrocchie e il loro stato
  up                                     rigenera la configurazione e avvia tutto
  update                                 git pull + backup + build + riavvio di tutte le parrocchie
  aggiornamenti attiva [HH:MM] | disattiva | ora | stato
                                         aggiornamento automatico notturno da GitHub (attivo dopo init)
  backup [slug|all]                      archivio DB+allegati in $HOME_DIR/backups/<slug>/
  restore <slug> <file.db|.tar.gz>       ripristina il database di una parrocchia
  reset-password <slug> <email>          genera una nuova password per un utente
  domini <slug> <dom1[,dom2]|auto>       cambia i domini di una parrocchia
  remove <slug>                          disattiva una parrocchia (i dati restano su disco)
  pannello installa <dominio> <email>    pannello web del gestore (password + codice OTP)
  pannello password | otp | stato | disattiva
  logs [slug|caddy]   restart <slug>   shell <slug>   build

Esempio:
  $0 add sanrocco-gela sanrocco.tuodominio.it "Parrocchia San Rocco" parroco@example.it
EOF
}

main() {
    local cmd="${1:-help}"; shift || true
    case "$cmd" in
        init) cmd_init "$@" ;;
        build) need_root; cmd_build ;;
        add) cmd_add "$@" ;;
        remove|rm) cmd_remove "$@" ;;
        list|ls) cmd_list ;;
        up|regen) cmd_up ;;
        update) cmd_update ;;
        auto-update) cmd_auto_update ;;
        aggiornamenti) cmd_aggiornamenti "$@" ;;
        backup) cmd_backup "$@" ;;
        restore) cmd_restore "$@" ;;
        reset-password) cmd_reset_password "$@" ;;
        domini) cmd_domini "$@" ;;
        pannello) cmd_pannello "$@" ;;
        logs) cmd_logs "$@" ;;
        restart) cmd_restart "$@" ;;
        shell) cmd_shell "$@" ;;
        help|-h|--help) cmd_help ;;
        *) cmd_help; die "Comando sconosciuto: $cmd" ;;
    esac
}

main "$@"
