#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# ReChurch — preparazione di un server dedicato Kimsufi / OVH (Ubuntu 22.04/24.04
# o Debian 12) appena installato dal pannello OVH.
#
# Cosa fa (idempotente, si può rilanciare):
#   - aggiornamenti di sistema + aggiornamenti di sicurezza automatici
#   - fuso orario Europe/Rome
#   - Docker Engine + plugin compose (con rotazione dei log)
#   - firewall UFW: solo SSH, HTTP, HTTPS
#   - fail2ban per proteggere SSH dai tentativi di accesso
#   - swap da 2 GB se il server non ne ha
#   - (opzionale) clona il repository in /opt/rechurch
#   - (opzionale, --ssh-solo-chiavi) disabilita il login SSH con password
#
# Uso (come root):
#   bash kimsufi-setup.sh [--repo URL_GIT] [--ssh-solo-chiavi]
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL=""
SSH_HARDEN=0
INSTALL_DIR="/opt/rechurch"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo) REPO_URL="$2"; shift 2 ;;
        --ssh-solo-chiavi) SSH_HARDEN=1; shift ;;
        --dir) INSTALL_DIR="$2"; shift 2 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *) echo "Opzione sconosciuta: $1" >&2; exit 1 ;;
    esac
done

[[ $EUID -eq 0 ]] || { echo "Esegui come root: sudo bash $0" >&2; exit 1; }
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo "Sistema non supportato: $ID (serve Ubuntu o Debian)" >&2; exit 1 ;; esac

step() { echo; echo "==> $*"; }
export DEBIAN_FRONTEND=noninteractive

step "Aggiornamento del sistema"
apt-get update -q
apt-get -y -q -o Dpkg::Options::="--force-confold" upgrade
apt-get install -y -q ca-certificates curl git openssl ufw fail2ban unattended-upgrades sqlite3 rsync

step "Fuso orario Europe/Rome"
timedatectl set-timezone Europe/Rome || true

step "Aggiornamenti di sicurezza automatici"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

step "Docker"
if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
fi
mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
    cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
EOF
    systemctl restart docker
fi
systemctl enable --now docker
docker compose version

step "Firewall (UFW): SSH, HTTP, HTTPS"
SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"; SSH_PORT="${SSH_PORT:-22}"
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Let'"'"'s Encrypt + redirect)'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
ufw --force enable
# Nota: le porte pubblicate da Docker scavalcano UFW. ReChurch pubblica solo
# 80/443 (Caddy); i container delle parrocchie non espongono porte all'esterno.

step "fail2ban (protezione SSH)"
cat > /etc/fail2ban/jail.d/rechurch-sshd.local <<EOF
[sshd]
enabled = true
port = ${SSH_PORT}
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

step "Swap"
if [[ -z "$(swapon --show --noheadings)" ]]; then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Creato /swapfile da 2 GB"
else
    echo "Swap già presente"
fi

if [[ $SSH_HARDEN -eq 1 ]]; then
    step "SSH: solo accesso con chiave"
    if [[ -s /root/.ssh/authorized_keys ]] || ls /home/*/.ssh/authorized_keys >/dev/null 2>&1; then
        cat > /etc/ssh/sshd_config.d/99-rechurch.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
        if sshd -t; then
            systemctl reload ssh 2>/dev/null || systemctl reload sshd
            echo "Login con password disabilitato."
        else
            rm -f /etc/ssh/sshd_config.d/99-rechurch.conf
            echo "Configurazione SSH non valida: modifica annullata."
        fi
    else
        echo "ATTENZIONE: nessuna chiave SSH trovata — NON disabilito le password (rischieresti di restare chiuso fuori)."
    fi
fi

if [[ -n "$REPO_URL" ]]; then
    step "Codice ReChurch in $INSTALL_DIR"
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        git -C "$INSTALL_DIR" pull --ff-only
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi
fi

step "Backup notturno di tutte le parrocchie (cron)"
cat > /etc/cron.d/rechurch-backup <<EOF
# Archivio DB + allegati di ogni parrocchia in /srv/rechurch/backups (03:30)
30 3 * * * root [ -x ${INSTALL_DIR}/deploy/rechurch.sh ] && ${INSTALL_DIR}/deploy/rechurch.sh backup all >> /var/log/rechurch-backup.log 2>&1
EOF

echo
echo "✔ Server pronto."
echo "  Prossimi passi:"
[[ -z "$REPO_URL" ]] && echo "   git clone <url-del-repo> $INSTALL_DIR"
echo "   sudo $INSTALL_DIR/deploy/rechurch.sh init"
echo "   sudo nano /srv/rechurch/.env        # ACME_EMAIL, SUPERADMIN_*, backup cloud"
echo "   sudo $INSTALL_DIR/deploy/rechurch.sh add <slug> <dominio> \"Nome parrocchia\""
