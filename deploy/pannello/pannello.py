"""ReChurch — pannello web del gestore.

Gira sull'host (systemd: rechurch-pannello) perché deve comandare Docker, ed è
raggiungibile solo attraverso Caddy sul dominio PANNELLO_DOMAIN. Tutte le
operazioni passano da deploy/rechurch.sh, lo stesso script usato da terminale.

Sicurezza:
  - accesso con email + password + codice OTP (TOTP, app Authenticator);
  - accetta connessioni solo da indirizzi privati (Caddy nella rete Docker);
  - blocco temporaneo dopo troppi tentativi falliti (per IP e globale);
  - sessione in cookie firmato (HMAC), HttpOnly, Secure, SameSite=Strict,
    invalidata cambiando password o OTP; token CSRF su ogni modulo;
  - nessun JavaScript; Content-Security-Policy restrittiva.

Uso da riga di comando (lo chiama rechurch.sh):
  echo -n PASSWORD | python pannello.py hash-password
  python pannello.py nuovo-segreto-otp
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import ipaddress
import json
import os
import re
import secrets
import struct
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

# ── Configurazione (da /srv/rechurch/pannello.env, via systemd) ──────────────

HOME = Path(os.environ.get("RECHURCH_HOME", "/srv/rechurch"))
SCRIPT = os.environ.get("RECHURCH_SCRIPT", str(Path(__file__).resolve().parents[1] / "rechurch.sh"))
EMAIL = os.environ.get("PANNELLO_EMAIL", "").strip().lower()
PASSWORD_HASH = os.environ.get("PANNELLO_PASSWORD_HASH", "")
TOTP_SECRET = os.environ.get("PANNELLO_TOTP_SECRET", "")
SESSION_KEY = os.environ.get("PANNELLO_SESSION_KEY", "").encode()
# Solo per i test in locale senza HTTPS
DEV = os.environ.get("PANNELLO_DEV") == "1"

SESSION_TTL = 4 * 3600
COOKIE = "rcp" if DEV else "__Host-rcp"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DOMINI_RE = re.compile(r"^(auto|[a-z0-9.,-]+)$")
BACKUP_RE = re.compile(r"^[a-z0-9-]+_\d{8}_\d{6}\.tar\.gz$")


# ── Password (scrypt) e OTP (TOTP, RFC 6238) ──────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024 * 1024)
    return "scrypt$32768$8$1$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(h).decode()


def verifica_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, h = stored.split("$")
        if algo != "scrypt":
            return False
        calc = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r),
                              p=int(p), maxmem=64 * 1024 * 1024)
        return hmac.compare_digest(calc, base64.b64decode(h))
    except Exception:
        return False


def _totp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


_ultimo_contatore_otp = 0


def verifica_otp(codice: str) -> bool:
    """Codice valido nella finestra ±30 s, e mai riutilizzabile."""
    global _ultimo_contatore_otp
    codice = re.sub(r"\s", "", codice or "")
    if not TOTP_SECRET or not re.fullmatch(r"\d{6}", codice):
        return False
    ora = int(time.time() // 30)
    for c in (ora - 1, ora, ora + 1):
        if c > _ultimo_contatore_otp and hmac.compare_digest(_totp(TOTP_SECRET, c), codice):
            _ultimo_contatore_otp = c
            return True
    return False


# ── Limite ai tentativi di accesso ────────────────────────────────────────────

_fallimenti: dict[str, list[float]] = {}
_fallimenti_globali: list[float] = []
FINESTRA, MAX_PER_IP, MAX_GLOBALI = 15 * 60, 5, 20


def _pulisci(lst: list[float]) -> list[float]:
    limite = time.time() - FINESTRA
    return [t for t in lst if t > limite]


def bloccato(ip: str) -> bool:
    _fallimenti[ip] = _pulisci(_fallimenti.get(ip, []))
    _fallimenti_globali[:] = _pulisci(_fallimenti_globali)
    return len(_fallimenti[ip]) >= MAX_PER_IP or len(_fallimenti_globali) >= MAX_GLOBALI


def registra_fallimento(ip: str) -> None:
    _fallimenti.setdefault(ip, []).append(time.time())
    _fallimenti_globali.append(time.time())


# ── Sessione firmata ──────────────────────────────────────────────────────────

def _versione_credenziali() -> str:
    # Cambiando password o OTP le sessioni aperte decadono
    return hashlib.sha256((PASSWORD_HASH + TOTP_SECRET).encode()).hexdigest()[:16]


def crea_sessione() -> tuple[str, str]:
    csrf = secrets.token_urlsafe(24)
    dati = {"e": int(time.time()) + SESSION_TTL, "c": csrf, "v": _versione_credenziali(),
            "n": secrets.token_hex(8)}
    payload = base64.urlsafe_b64encode(json.dumps(dati).encode()).decode()
    firma = hmac.new(SESSION_KEY, payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{firma}", csrf


def leggi_sessione(valore: str | None) -> dict | None:
    if not valore or "." not in valore or not SESSION_KEY:
        return None
    payload, firma = valore.rsplit(".", 1)
    atteso = hmac.new(SESSION_KEY, payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(firma, atteso):
        return None
    try:
        dati = json.loads(base64.urlsafe_b64decode(payload))
    except Exception:
        return None
    if dati.get("e", 0) < time.time() or dati.get("v") != _versione_credenziali():
        return None
    if dati.get("n") in _revocate:
        return None
    return dati


# Sessioni chiuse con "Esci" (in memoria: un riavvio del servizio le scorda,
# ma il cookie è già stato cancellato dal browser e scade comunque in 4 ore)
_revocate: set[str] = set()


# ── Dati delle parrocchie ─────────────────────────────────────────────────────

def leggi_env(path: Path) -> dict[str, str]:
    dati = {}
    try:
        for riga in path.read_text(encoding="utf-8").splitlines():
            if "=" in riga and not riga.lstrip().startswith("#"):
                k, v = riga.split("=", 1)
                dati[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return dati


def dimensione(path: Path) -> int:
    tot = 0
    for radice, _dirs, files in os.walk(path):
        for f in files:
            try:
                tot += os.path.getsize(os.path.join(radice, f))
            except OSError:
                pass
    return tot


def fmt_bytes(n: int) -> str:
    for unita in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unita}" if unita == "B" else f"{n:.1f} {unita}"
        n /= 1024
    return f"{n:.1f} TB"


def stato_container() -> dict[str, tuple[str, str]]:
    try:
        out = subprocess.run(
            ["docker", "ps", "-a", "--filter", "label=com.docker.compose.project=rechurch",
             "--format", '{{.Label "com.docker.compose.service"}}|{{.State}}|{{.Status}}'],
            capture_output=True, text=True, timeout=15,
        ).stdout
    except Exception:
        return {}
    stati = {}
    for riga in out.splitlines():
        parti = riga.split("|", 2)
        if len(parti) == 3:
            stati[parti[0]] = (parti[1], parti[2])
    return stati


def parrocchie() -> list[dict]:
    stati = stato_container()
    elenco = []
    for f in sorted((HOME / "parrocchie").glob("*.env")):
        slug = f.stem
        env = leggi_env(f)
        dati = HOME / "data" / slug
        backups = sorted((dati / "backups").glob("rechurch_*.db"), reverse=True) if dati.exists() else []
        stato, dettaglio = stati.get(f"p-{slug}", ("fermo", ""))
        if "(healthy)" in dettaglio:
            stato = "attiva"
        elif "unhealthy" in dettaglio:
            stato = "problemi"
        elif "starting" in dettaglio:
            stato = "in avvio"
        elenco.append({
            "slug": slug,
            "nome": env.get("PARROCCHIA_NOME", slug),
            "domini": [d for d in env.get("DOMAINS", "").split(",") if d],
            "stato": stato,
            "dettaglio": dettaglio,
            "spazio": fmt_bytes(dimensione(dati)) if dati.exists() else "—",
            "ultimo_backup": datetime.fromtimestamp(backups[0].stat().st_mtime).strftime("%d/%m/%Y %H:%M")
            if backups else "mai",
        })
    return elenco


# ── Esecuzione di rechurch.sh ─────────────────────────────────────────────────

_lock = threading.Lock()
_aggiornamento = {"in_corso": False, "inizio": None, "fine": None, "esito": None}
LOG_AGGIORNAMENTO = HOME / "pannello-aggiornamento.log"


def esegui(*args: str, timeout: int = 300) -> tuple[int, str]:
    if not _lock.acquire(blocking=False):
        return 1, "Un'altra operazione è in corso (ad esempio un aggiornamento). Riprova tra poco."
    try:
        env = {**os.environ, "NO_COLOR": "1", "RECHURCH_YES": "1", "RECHURCH_HOME": str(HOME)}
        r = subprocess.run([SCRIPT, *args], capture_output=True, text=True, timeout=timeout, env=env)
        return r.returncode, (r.stdout + r.stderr).strip()
    except subprocess.TimeoutExpired:
        return 1, "Operazione interrotta: tempo scaduto."
    finally:
        _lock.release()


def _aggiorna_in_background() -> None:
    with _lock:
        _aggiornamento.update(in_corso=True, inizio=datetime.now(), fine=None, esito=None)
        env = {**os.environ, "NO_COLOR": "1", "RECHURCH_YES": "1", "RECHURCH_HOME": str(HOME)}
        try:
            with LOG_AGGIORNAMENTO.open("w", encoding="utf-8") as log:
                r = subprocess.run([SCRIPT, "update"], stdout=log, stderr=subprocess.STDOUT,
                                   text=True, timeout=3600, env=env)
            _aggiornamento["esito"] = "completato" if r.returncode == 0 else "fallito"
        except Exception as e:  # noqa: BLE001
            _aggiornamento["esito"] = f"fallito ({e})"
        finally:
            _aggiornamento.update(in_corso=False, fine=datetime.now())


# ── HTML ──────────────────────────────────────────────────────────────────────

CSS = """
:root{--bg:#f6f7fb;--card:#fff;--text:#1f2937;--muted:#6b7280;--line:#e5e7eb;--accent:#4f46e5;
--ok:#15803d;--okbg:#dcfce7;--warn:#b45309;--warnbg:#fef3c7;--err:#b91c1c;--errbg:#fee2e2}
@media (prefers-color-scheme:dark){:root{--bg:#0f1117;--card:#181b23;--text:#e5e7eb;--muted:#9ca3af;
--line:#2a2f3a;--accent:#818cf8;--ok:#4ade80;--okbg:#14301f;--warn:#fbbf24;--warnbg:#3a2a0b;--err:#f87171;--errbg:#3b1414}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card)}
header b{font-size:17px}main{max-width:1100px;margin:0 auto;padding:20px 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:18px}
h2{font-size:16px;margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
input,button,select{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text)}
button{cursor:pointer}button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button.danger{color:var(--err)}
form.inline{display:inline-flex;gap:6px;flex-wrap:wrap;margin:2px 0}.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600}
.attiva{background:var(--okbg);color:var(--ok)}.problemi,.fermo{background:var(--errbg);color:var(--err)}.in.avvio{background:var(--warnbg);color:var(--warn)}
.muted{color:var(--muted);font-size:13px}pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto;white-space:pre-wrap;font-size:13px}
details summary{cursor:pointer;color:var(--accent)}a{color:var(--accent)}.err{color:var(--err)}
.login{max-width:380px;margin:10vh auto}.login label{display:block;margin:10px 0 4px;font-size:13px;color:var(--muted)}.login input{width:100%}
@media (max-width:700px){table.parr thead{display:none}table.parr td{display:block;border:0;padding:4px 0}table.parr tr{display:block;border-bottom:1px solid var(--line);padding:10px 0}}
"""


def e(v) -> str:
    return html.escape(str(v), quote=True)


def pagina(titolo: str, corpo: str, csrf: str | None = None) -> str:
    esci = (f'<form method="post" action="/logout" class="inline"><input type="hidden" name="csrf" value="{e(csrf)}">'
            f'<button>Esci</button></form>') if csrf else ""
    return (f'<!doctype html><html lang="it"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{e(titolo)}</title><style>{CSS}</style></head><body>'
            f'<header><b>ReChurch · Gestione</b>{esci}</header><main>{corpo}</main></body></html>')


# ── App ───────────────────────────────────────────────────────────────────────

if __name__ != "__main__":
    from fastapi import FastAPI, Form, Request
    from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    def ip_client(request: Request) -> str:
        # Caddy imposta X-Forwarded-For con l'IP reale del visitatore
        xff = request.headers.get("x-forwarded-for", "")
        return xff.split(",")[-1].strip() if xff else (request.client.host if request.client else "?")

    @app.middleware("http")
    async def sicurezza(request: Request, call_next):
        peer = request.client.host if request.client else ""
        try:
            privato = ipaddress.ip_address(peer).is_private
        except ValueError:
            privato = False
        if not privato:
            return PlainTextResponse("Accesso consentito solo tramite il proxy.", status_code=403)
        risposta = await call_next(request)
        risposta.headers["Content-Security-Policy"] = (
            "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
        )
        risposta.headers["X-Frame-Options"] = "DENY"
        risposta.headers["Referrer-Policy"] = "no-referrer"
        risposta.headers["Cache-Control"] = "no-store"
        return risposta

    def sessione(request: Request) -> dict | None:
        return leggi_sessione(request.cookies.get(COOKIE))

    def verifica_csrf(request: Request, csrf: str) -> dict | None:
        s = sessione(request)
        if s and hmac.compare_digest(s.get("c", "").encode(), (csrf or "").encode()):
            return s
        return None

    def vai_al_login() -> RedirectResponse:
        return RedirectResponse("/login", status_code=303)

    def esito(titolo: str, codice: int, output: str, csrf: str) -> HTMLResponse:
        classe = "attiva" if codice == 0 else "problemi"
        corpo = (f'<div class="card"><h2>{e(titolo)} <span class="pill {classe}">'
                 f'{"completato" if codice == 0 else "errore"}</span></h2>'
                 f'<pre>{e(output) or "(nessun messaggio)"}</pre><p><a href="/">← Torna al pannello</a></p></div>')
        return HTMLResponse(pagina(titolo, corpo, csrf), status_code=200 if codice == 0 else 400)

    # ── login ────────────────────────────────────────────────────────────────

    def modulo_login(errore: str = "") -> str:
        msg = f'<p class="err">{e(errore)}</p>' if errore else ""
        config = "" if (EMAIL and PASSWORD_HASH and TOTP_SECRET and SESSION_KEY) else (
            '<p class="err">Pannello non configurato: esegui "rechurch.sh pannello installa".</p>')
        return pagina("Accesso", f'''<div class="card login"><h2>Accesso gestore</h2>{config}{msg}
<form method="post" action="/login">
<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
<label for="otp">Codice OTP (app Authenticator)</label><input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{{6,7}}" required>
<p><button class="primary" style="width:100%">Entra</button></p></form></div>''')

    @app.get("/login", response_class=HTMLResponse)
    def login_form():
        return modulo_login()

    @app.post("/login")
    def login(request: Request, email: str = Form(""), password: str = Form(""), otp: str = Form("")):
        ip = ip_client(request)
        if bloccato(ip):
            return HTMLResponse(modulo_login("Troppi tentativi falliti: riprova tra 15 minuti."), status_code=429)
        configurato = bool(EMAIL and PASSWORD_HASH and TOTP_SECRET and SESSION_KEY)
        email_ok = hmac.compare_digest(email.strip().lower().encode(), EMAIL.encode())
        # La password si verifica sempre (stesso tempo di risposta con email sbagliata)
        password_ok = verifica_password(password, PASSWORD_HASH)
        ok = configurato and email_ok and password_ok
        # L'OTP si controlla solo con credenziali giuste, per non "consumarlo"
        if ok:
            ok = verifica_otp(otp)
        if not ok:
            registra_fallimento(ip)
            print(f"[pannello] accesso fallito da {ip}", flush=True)
            time.sleep(1)
            return HTMLResponse(modulo_login("Credenziali o codice non validi."), status_code=401)
        valore, _csrf = crea_sessione()
        print(f"[pannello] accesso da {ip}", flush=True)
        r = RedirectResponse("/", status_code=303)
        r.set_cookie(COOKIE, valore, max_age=SESSION_TTL, httponly=True, secure=not DEV,
                     samesite="strict", path="/")
        return r

    @app.post("/logout")
    def logout(request: Request, csrf: str = Form("")):
        r = RedirectResponse("/login", status_code=303)
        s = verifica_csrf(request, csrf)
        if s:
            _revocate.add(s.get("n", ""))
            # Un cookie __Host- si cancella solo con gli stessi attributi (Secure)
            r.delete_cookie(COOKIE, path="/", secure=not DEV, httponly=True, samesite="strict")
        return r

    # ── pagina principale ────────────────────────────────────────────────────

    @app.get("/", response_class=HTMLResponse)
    def home(request: Request):
        s = sessione(request)
        if not s:
            return vai_al_login()
        csrf = s["c"]
        h = f'<input type="hidden" name="csrf" value="{e(csrf)}">'
        globale = leggi_env(HOME / ".env")
        base = globale.get("DOMINIO_BASE", "")

        righe = []
        for p in parrocchie():
            slug = e(p["slug"])
            link = " ".join(f'<a href="https://{e(d)}" rel="noreferrer">{e(d)}</a>' for d in p["domini"]) or "—"
            righe.append(f'''<tr>
<td><b>{e(p["nome"])}</b><div class="muted">{slug}</div></td>
<td>{link}</td>
<td><span class="pill {e(p["stato"])}">{e(p["stato"])}</span><div class="muted">{e(p["dettaglio"])}</div></td>
<td>{e(p["spazio"])}<div class="muted">backup: {e(p["ultimo_backup"])}</div></td>
<td>
<form method="post" action="/parrocchie/{slug}/backup" class="inline">{h}<button>Backup ora</button></form>
<form method="post" action="/parrocchie/{slug}/riavvia" class="inline">{h}<button>Riavvia</button></form>
<a href="/parrocchie/{slug}/log">Log</a> · <a href="/parrocchie/{slug}/backup">Archivi</a>
<details><summary>Altro</summary>
<form method="post" action="/parrocchie/{slug}/password" class="inline">{h}
<input name="email" type="email" placeholder="email utente" required><button>Nuova password</button></form>
<form method="post" action="/parrocchie/{slug}/domini" class="inline">{h}
<input name="domini" value="{e(",".join(p["domini"]))}" required size="28"><button>Cambia domini</button></form>
<form method="post" action="/parrocchie/{slug}/disattiva" class="inline">{h}
<input name="conferma" placeholder="scrivi {slug}" required size="14"><button class="danger">Disattiva</button></form>
</details></td></tr>''')
        tabella = ("<table class='parr'><thead><tr><th>Parrocchia</th><th>Domini</th><th>Stato</th>"
                   "<th>Dati</th><th>Azioni</th></tr></thead><tbody>" + "".join(righe) + "</tbody></table>"
                   ) if righe else '<p class="muted">Nessuna parrocchia. Aggiungine una qui sotto.</p>'

        agg = _aggiornamento
        if agg["in_corso"]:
            stato_agg = f'<p>Aggiornamento in corso dalle {agg["inizio"]:%H:%M}… <a href="/aggiornamento">vedi il log</a></p>'
        elif agg["fine"]:
            stato_agg = (f'<p class="muted">Ultimo aggiornamento: {e(agg["esito"])} alle {agg["fine"]:%d/%m %H:%M} · '
                         f'<a href="/aggiornamento">log</a></p>')
        else:
            stato_agg = ""

        auto = leggi_env(HOME / "aggiornamento-automatico.stato")
        if auto:
            stato_agg += (f'<p class="muted">Aggiornamento automatico: ultimo controllo {e(auto.get("CONTROLLO", ""))} — '
                          f'{e(auto.get("MESSAGGIO", ""))} · versione {e(auto.get("VERSIONE", ""))}</p>')

        suggerimento = (f'scrivi "auto" per {e("<slug>." + base)}' if base
                        else "es. sanrocco.tuodominio.it (più domini separati da virgola)")
        corpo = f'''
<div class="card"><h2>Parrocchie</h2>{tabella}</div>
<div class="card"><h2>Nuova parrocchia</h2>
<form method="post" action="/parrocchie">{h}<div class="grid">
<input name="slug" placeholder="slug (es. sanrocco-gela)" pattern="[a-z0-9][a-z0-9-]{{1,30}}" required>
<input name="nome" placeholder="Nome parrocchia" required>
<input name="domini" placeholder="dominio" value="{"auto" if base else ""}" required>
<input name="email" type="email" placeholder="email amministratore (facoltativa)">
</div><p class="muted">Dominio: {suggerimento}. Il DNS deve puntare a questo server.</p>
<button class="primary">Crea parrocchia</button></form>
<p class="muted">La password iniziale dell'amministratore viene mostrata una sola volta.</p></div>
<div class="card"><h2>Server</h2>{stato_agg}
<form method="post" action="/aggiorna" class="inline">{h}<button>Aggiorna ReChurch (git pull + backup + riavvio)</button></form>
<form method="post" action="/backup-tutte" class="inline">{h}<button>Backup di tutte le parrocchie</button></form>
</div>'''
        return HTMLResponse(pagina("Pannello", corpo, csrf))

    # ── azioni ───────────────────────────────────────────────────────────────

    def slug_valido(slug: str) -> bool:
        return bool(SLUG_RE.match(slug)) and (HOME / "parrocchie" / f"{slug}.env").exists()

    @app.post("/parrocchie")
    def crea(request: Request, csrf: str = Form(""), slug: str = Form(""), nome: str = Form(""),
             domini: str = Form(""), email: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        slug, domini, email, nome = slug.strip(), domini.strip().lower().replace(" ", ""), email.strip(), nome.strip()
        if not SLUG_RE.match(slug) or not DOMINI_RE.match(domini) or not nome or len(nome) > 200 \
                or (email and not EMAIL_RE.match(email)) or '"' in nome:
            return esito("Nuova parrocchia", 1, "Dati non validi.", s["c"])
        args = ["add", slug, domini, nome] + ([email] if email else [])
        codice, out = esegui(*args, timeout=600)
        return esito(f"Nuova parrocchia: {nome}", codice, out, s["c"])

    @app.post("/parrocchie/{slug}/backup")
    def backup(request: Request, slug: str, csrf: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return esito("Backup", 1, "Parrocchia non trovata.", s["c"])
        return esito(f"Backup di {slug}", *esegui("backup", slug), s["c"])

    @app.post("/backup-tutte")
    def backup_tutte(request: Request, csrf: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        return esito("Backup di tutte le parrocchie", *esegui("backup", "all", timeout=1800), s["c"])

    @app.post("/parrocchie/{slug}/riavvia")
    def riavvia(request: Request, slug: str, csrf: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return esito("Riavvio", 1, "Parrocchia non trovata.", s["c"])
        return esito(f"Riavvio di {slug}", *esegui("restart", slug), s["c"])

    @app.post("/parrocchie/{slug}/password")
    def nuova_password(request: Request, slug: str, csrf: str = Form(""), email: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug) or not EMAIL_RE.match(email.strip()):
            return esito("Nuova password", 1, "Dati non validi.", s["c"])
        return esito(f"Nuova password ({slug})", *esegui("reset-password", slug, email.strip()), s["c"])

    @app.post("/parrocchie/{slug}/domini")
    def cambia_domini(request: Request, slug: str, csrf: str = Form(""), domini: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        domini = domini.strip().lower().replace(" ", "")
        if not slug_valido(slug) or not DOMINI_RE.match(domini):
            return esito("Domini", 1, "Dati non validi.", s["c"])
        return esito(f"Domini di {slug}", *esegui("domini", slug, domini), s["c"])

    @app.post("/parrocchie/{slug}/disattiva")
    def disattiva(request: Request, slug: str, csrf: str = Form(""), conferma: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug) or conferma.strip() != slug:
            return esito("Disattivazione", 1, "Per confermare scrivi esattamente lo slug della parrocchia.", s["c"])
        return esito(f"Disattivazione di {slug}", *esegui("remove", slug), s["c"])

    @app.post("/aggiorna")
    def aggiorna(request: Request, csrf: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if _aggiornamento["in_corso"] or _lock.locked():
            return esito("Aggiornamento", 1, "C'è già un'operazione in corso.", s["c"])
        threading.Thread(target=_aggiorna_in_background, daemon=True).start()
        return RedirectResponse("/aggiornamento", status_code=303)

    @app.get("/aggiornamento", response_class=HTMLResponse)
    def log_aggiornamento(request: Request):
        s = sessione(request)
        if not s:
            return vai_al_login()
        try:
            testo = LOG_AGGIORNAMENTO.read_text(encoding="utf-8")[-20000:]
        except OSError:
            testo = "(nessun aggiornamento eseguito)"
        stato = "in corso — ricarica la pagina per seguire l'avanzamento" if _aggiornamento["in_corso"] \
            else (_aggiornamento["esito"] or "")
        return HTMLResponse(pagina("Aggiornamento", f'<div class="card"><h2>Aggiornamento {e(stato)}</h2>'
                                   f'<pre>{e(testo)}</pre><p><a href="/">← Torna al pannello</a></p></div>', s["c"]))

    @app.get("/parrocchie/{slug}/log", response_class=HTMLResponse)
    def log_parrocchia(request: Request, slug: str):
        s = sessione(request)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return HTMLResponse(pagina("Log", "<p>Parrocchia non trovata.</p>", s["c"]), status_code=404)
        try:
            r = subprocess.run(["docker", "logs", "--tail", "300", f"rechurch-p-{slug}-1"],
                               capture_output=True, text=True, timeout=20)
            testo = (r.stdout + r.stderr)[-40000:]
        except Exception as ex:  # noqa: BLE001
            testo = str(ex)
        return HTMLResponse(pagina(f"Log {slug}", f'<div class="card"><h2>Log di {e(slug)}</h2>'
                                   f'<pre>{e(testo)}</pre><p><a href="/">← Torna al pannello</a></p></div>', s["c"]))

    @app.get("/parrocchie/{slug}/backup", response_class=HTMLResponse)
    def archivi(request: Request, slug: str):
        s = sessione(request)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return HTMLResponse(pagina("Archivi", "<p>Parrocchia non trovata.</p>", s["c"]), status_code=404)
        cartella = HOME / "backups" / slug
        files = sorted(cartella.glob("*.tar.gz"), reverse=True) if cartella.exists() else []
        righe = "".join(
            f'<tr><td><a href="/parrocchie/{e(slug)}/backup/{e(f.name)}">{e(f.name)}</a></td>'
            f'<td>{fmt_bytes(f.stat().st_size)}</td>'
            f'<td>{datetime.fromtimestamp(f.stat().st_mtime):%d/%m/%Y %H:%M}</td></tr>' for f in files
        ) or '<tr><td colspan="3" class="muted">Nessun archivio: usa "Backup ora".</td></tr>'
        corpo = (f'<div class="card"><h2>Archivi di {e(slug)}</h2><p class="muted">Database + allegati. '
                 f'Per ripristinarne uno: <code>rechurch.sh restore {e(slug)} &lt;file&gt;</code></p>'
                 f'<table><thead><tr><th>File</th><th>Dimensione</th><th>Data</th></tr></thead>'
                 f'<tbody>{righe}</tbody></table><p><a href="/">← Torna al pannello</a></p></div>')
        return HTMLResponse(pagina(f"Archivi {slug}", corpo, s["c"]))

    @app.get("/parrocchie/{slug}/backup/{nome}")
    def scarica_archivio(request: Request, slug: str, nome: str):
        s = sessione(request)
        if not s:
            return vai_al_login()
        if not slug_valido(slug) or not BACKUP_RE.match(nome):
            return PlainTextResponse("Non trovato", status_code=404)
        f = HOME / "backups" / slug / nome
        if not f.is_file():
            return PlainTextResponse("Non trovato", status_code=404)
        return FileResponse(str(f), filename=nome, media_type="application/gzip")


# ── Riga di comando ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else ""
    if comando == "hash-password":
        pw = sys.stdin.read()
        if len(pw) < 12:
            sys.exit("Password troppo corta (minimo 12 caratteri)")
        print(hash_password(pw))
    elif comando == "nuovo-segreto-otp":
        print(base64.b32encode(secrets.token_bytes(20)).decode().rstrip("="))
    else:
        sys.exit("Uso: pannello.py hash-password | nuovo-segreto-otp")
