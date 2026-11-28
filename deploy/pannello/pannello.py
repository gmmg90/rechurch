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
import unicodedata
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


# ── Dati dentro la parrocchia (utenti, dati di base) ──────────────────────────
#
# Lo script gira DENTRO il container della parrocchia (docker exec), con i
# modelli dell'app (l'account proprietario non viene mai mostrato).
# Le chiese NON si gestiscono da qui: le crea la parrocchia dall'app.

SCRIPT_DB = r'''
import json, os, sys
from app.database import SessionLocal
from app import models
from app.auth import is_owner

op = os.environ["RC_OP"]
d = json.loads(os.environ.get("RC_DATA") or "{}")
db = SessionLocal()


def fine(x=None, errore=None):
    print(json.dumps({"ok": errore is None, "errore": errore, "dati": x}, default=str))
    sys.exit(0)


if op == "leggi":
    cfg = db.query(models.ParrocchiaConfig).first()
    fine({
        "parrocchia": {k: getattr(cfg, k, None) for k in ("nome", "diocesi", "citta")} if cfg else {},
        "utenti": [{"email": x.email, "ruolo": x.ruolo, "attivo": x.attivo}
                   for x in db.query(models.Utente).order_by(models.Utente.ruolo, models.Utente.email) if not is_owner(x)],
    })

if op == "dati_parrocchia":
    cfg = db.query(models.ParrocchiaConfig).first()
    if cfg:
        for k in ("diocesi", "citta"):
            if (d.get(k) or "").strip():
                setattr(cfg, k, d[k].strip())
        db.commit()
    fine({})

fine(errore="Operazione sconosciuta")
'''


def db_parrocchia(slug: str, op: str, dati: dict | None = None) -> tuple[bool, object]:
    """Esegue un'operazione sul database della parrocchia. (ok, dati | messaggio d'errore)"""
    try:
        r = subprocess.run(
            ["docker", "exec", "-i", "-e", f"RC_OP={op}", "-e", "RC_DATA=" + json.dumps(dati or {}),
             f"rechurch-p-{slug}-1", "python", "-"],
            input=SCRIPT_DB, capture_output=True, text=True, timeout=60,
        )
    except Exception as ex:  # noqa: BLE001
        return False, f"Impossibile contattare la parrocchia ({ex})"
    righe = [x for x in r.stdout.splitlines() if x.startswith("{")]
    if not righe:
        err = (r.stderr or r.stdout).strip()
        if "No such container" in err or "is not running" in err:
            return False, "La parrocchia è ferma: riavviala per vederne gli utenti."
        return False, "Errore: " + (err[-400:] or "nessuna risposta")
    try:
        risposta = json.loads(righe[-1])
    except ValueError:
        return False, "Risposta non valida"
    return (True, risposta["dati"]) if risposta.get("ok") else (False, risposta.get("errore") or "Errore")


def slug_da_nome(nome: str) -> str:
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\bparrocchia\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    while len(s) > 31 and "-" in s:
        s = s.rsplit("-", 1)[0]
    return s[:31].strip("-")


# ── HTML ──────────────────────────────────────────────────────────────────────

CSS = """
:root{--bg:#f4f5fa;--card:#fff;--text:#1f2937;--muted:#6b7280;--line:#e5e7eb;--accent:#4f46e5;--accentbg:#eef2ff;
--ok:#15803d;--okbg:#dcfce7;--warn:#b45309;--warnbg:#fef3c7;--err:#b91c1c;--errbg:#fee2e2;--r:14px}
@media (prefers-color-scheme:dark){:root{--bg:#0f1117;--card:#181b23;--text:#e5e7eb;--muted:#9ca3af;--accentbg:#23264a;
--line:#2a2f3a;--accent:#818cf8;--ok:#4ade80;--okbg:#14301f;--warn:#fbbf24;--warnbg:#3a2a0b;--err:#f87171;--errbg:#3b1414}}
*{box-sizing:border-box}
body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--text);-webkit-text-size-adjust:100%}
header{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;
padding:10px 16px;padding-top:max(10px,env(safe-area-inset-top));border-bottom:1px solid var(--line);background:var(--card)}
header a.brand{font-weight:700;font-size:17px;color:var(--text);text-decoration:none}
main{max-width:980px;margin:0 auto;padding:16px 16px 48px}
h1{font-size:22px;margin:4px 0 4px}h2{font-size:17px;margin:0 0 12px}h3{font-size:15px;margin:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:16px}
.muted{color:var(--muted);font-size:14px}.small{font-size:13px}.err{color:var(--err)}
a{color:var(--accent)}code{font-size:13px;background:var(--bg);padding:1px 5px;border-radius:5px}
.back{display:inline-block;margin:0 0 8px;text-decoration:none;font-size:15px}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.between{justify-content:space-between}.grow{flex:1;min-width:0}
input,select,textarea{font:inherit;font-size:16px;width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;
background:var(--card);color:var(--text)}textarea{min-height:90px;resize:vertical}
label{display:block;font-size:14px;font-weight:600;margin:0 0 4px}.hint{font-size:13px;color:var(--muted);margin-top:4px;font-weight:400}
.field{margin-bottom:14px}.check{display:flex;gap:8px;align-items:center;font-weight:500;margin:6px 0}.check input{width:20px;height:20px}
.grid{display:grid;gap:0 12px;grid-template-columns:1fr}@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}.grid .full{grid-column:1/-1}}
.btn,button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;font:inherit;
font-size:15px;font-weight:600;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);
cursor:pointer;text-decoration:none;white-space:nowrap}
.btn.primary,button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
button.danger{color:var(--err);border-color:var(--err)}.btn.small,button.small{min-height:36px;padding:0 12px;font-size:14px}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(min-width:640px){.actions{display:flex;flex-wrap:wrap}}
.actions form{display:contents}.wide{width:100%}
.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;white-space:nowrap}
.attiva{background:var(--okbg);color:var(--ok)}.problemi,.fermo{background:var(--errbg);color:var(--err)}
.in.avvio{background:var(--warnbg);color:var(--warn)}.tag{background:var(--accentbg);color:var(--accent)}.spenta{background:var(--bg);color:var(--muted)}
.list{list-style:none;margin:0;padding:0}.list>li{border-top:1px solid var(--line)}.list>li:first-child{border-top:0}
a.parr{display:flex;align-items:center;gap:12px;padding:14px 4px;color:var(--text);text-decoration:none}
a.parr:active{background:var(--bg)}.chev{color:var(--muted);font-size:22px}
.ini{width:42px;height:42px;border-radius:12px;background:var(--accentbg);color:var(--accent);font-weight:800;display:flex;
align-items:center;justify-content:center;flex-shrink:0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px}.stat b{display:block;font-size:22px}
.box{border-radius:12px;padding:14px;margin:0 0 14px}.box.ok{background:var(--okbg)}.box.warn{background:var(--warnbg)}.box.errore{background:var(--errbg)}
.cred{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:15px}.cred b{font-family:ui-monospace,monospace;word-break:break-all}
pre{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;overflow-x:auto;white-space:pre-wrap;font-size:13px;margin:0}
details.altro>summary{cursor:pointer;color:var(--accent);font-weight:600;padding:6px 0}
.zona{border-color:var(--err)}
.login{max-width:400px;margin:8vh auto}
"""


def e(v) -> str:
    return html.escape(str(v if v is not None else ""), quote=True)


def pagina(titolo: str, corpo: str, csrf: str | None = None) -> str:
    esci = (f'<form method="post" action="/logout"><input type="hidden" name="csrf" value="{e(csrf)}">'
            f'<button class="small">Esci</button></form>') if csrf else ""
    return (f'<!doctype html><html lang="it"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            f'<meta name="color-scheme" content="light dark">'
            f'<title>{e(titolo)} · ReChurch</title><style>{CSS}</style></head><body>'
            f'<header><a class="brand" href="/">ReChurch · Gestione</a>{esci}</header><main>{corpo}</main></body></html>')


def campo(nome: str, etichetta: str, valore="", tipo="text", aiuto="", extra="", classe="") -> str:
    aiuto_html = f'<div class="hint">{aiuto}</div>' if aiuto else ""
    return (f'<div class="field {classe}"><label for="{nome}">{e(etichetta)}</label>'
            f'<input id="{nome}" name="{nome}" type="{tipo}" value="{e(valore)}" {extra}>{aiuto_html}</div>')


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

    def hidden(csrf: str) -> str:
        return f'<input type="hidden" name="csrf" value="{e(csrf)}">'

    def esito(titolo: str, codice: int, output: str, csrf: str, ritorno: str = "/",
              testo_ritorno: str = "Torna al pannello") -> HTMLResponse:
        classe = "attiva" if codice == 0 else "problemi"
        corpo = (f'<a class="back" href="{e(ritorno)}">‹ {e(testo_ritorno)}</a>'
                 f'<div class="card"><div class="row between"><h2 style="margin:0">{e(titolo)}</h2>'
                 f'<span class="pill {classe}">{"fatto" if codice == 0 else "errore"}</span></div>'
                 f'<details class="altro" {"" if codice == 0 else "open"}><summary>Dettagli tecnici</summary>'
                 f'<pre>{e(output) or "(nessun messaggio)"}</pre></details>'
                 f'<p><a class="btn primary" href="{e(ritorno)}">{e(testo_ritorno)}</a></p></div>')
        return HTMLResponse(pagina(titolo, corpo, csrf), status_code=200 if codice == 0 else 400)

    # ── login ────────────────────────────────────────────────────────────────

    def modulo_login(errore: str = "") -> str:
        msg = f'<div class="box errore">{e(errore)}</div>' if errore else ""
        config = "" if (EMAIL and PASSWORD_HASH and TOTP_SECRET and SESSION_KEY) else (
            '<div class="box errore">Pannello non configurato: esegui "rechurch.sh pannello installa".</div>')
        return pagina("Accesso", f'''<div class="card login"><h1>Accesso gestore</h1>
<p class="muted">Pannello per creare e gestire le parrocchie.</p>{config}{msg}
<form method="post" action="/login">
<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
<div class="field"><label for="otp">Codice dell'app Authenticator</label><input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{{6,7}}" placeholder="6 cifre" required></div>
<button class="primary wide">Entra</button></form></div>''')

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

    # ── pagina principale: elenco parrocchie ─────────────────────────────────

    def stato_aggiornamenti() -> str:
        agg = _aggiornamento
        if agg["in_corso"]:
            testo = f'<div class="box warn">Aggiornamento in corso dalle {agg["inizio"]:%H:%M}… <a href="/aggiornamento">segui</a></div>'
        elif agg["fine"]:
            testo = (f'<p class="muted">Ultimo aggiornamento dal pannello: {e(agg["esito"])} alle '
                     f'{agg["fine"]:%d/%m %H:%M} · <a href="/aggiornamento">log</a></p>')
        else:
            testo = ""
        auto = leggi_env(HOME / "aggiornamento-automatico.stato")
        if auto:
            testo += (f'<p class="muted">Aggiornamento automatico: ultimo controllo {e(auto.get("CONTROLLO", ""))} — '
                      f'{e(auto.get("MESSAGGIO", ""))}. Versione {e(auto.get("VERSIONE", ""))}.</p>')
        return testo

    @app.get("/", response_class=HTMLResponse)
    def home(request: Request):
        s = sessione(request)
        if not s:
            return vai_al_login()
        csrf = s["c"]
        h = hidden(csrf)
        elenco = parrocchie()
        attive = sum(1 for p in elenco if p["stato"] == "attiva")
        voci = []
        for p in elenco:
            dominio = p["domini"][0] if p["domini"] else "nessun dominio"
            voci.append(f'''<li><a class="parr" href="/parrocchie/{e(p["slug"])}">
<span class="ini">{e((p["nome"].replace("Parrocchia", "").strip() or p["nome"])[:1].upper())}</span>
<span class="grow"><span class="row" style="gap:8px"><b>{e(p["nome"])}</b>
<span class="pill {e(p["stato"])}">{e(p["stato"])}</span></span>
<span class="muted small" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{e(dominio)} · {e(p["spazio"])} · backup {e(p["ultimo_backup"])}</span></span>
<span class="chev">›</span></a></li>''')
        lista = (f'<ul class="list">{"".join(voci)}</ul>' if voci else
                 '<p class="muted">Ancora nessuna parrocchia: creane una con il pulsante qui sopra.</p>')
        corpo = f'''
<div class="row between" style="margin-bottom:12px"><h1>Parrocchie</h1>
<a class="btn primary" href="/nuova">+ Nuova parrocchia</a></div>
<div class="stats"><div class="stat"><b>{len(elenco)}</b><span class="muted small">parrocchie</span></div>
<div class="stat"><b>{attive}</b><span class="muted small">attive</span></div>
<div class="stat"><b>{len(elenco) - attive}</b><span class="muted small">da controllare</span></div></div>
<div class="card">{lista}</div>
<div class="card"><h2>Server</h2>{stato_aggiornamenti()}
<div class="actions">
<form method="post" action="/backup-tutte">{h}<button>Backup di tutte</button></form>
<form method="post" action="/aggiorna">{h}<button>Aggiorna ReChurch</button></form>
</div><p class="muted small">«Aggiorna» scarica l'ultima versione, fa un backup e riavvia tutte le parrocchie.</p></div>'''
        return HTMLResponse(pagina("Parrocchie", corpo, csrf))

    # ── nuova parrocchia ─────────────────────────────────────────────────────

    def modulo_nuova(csrf: str, errore: str = "", v: dict | None = None) -> str:
        v = v or {}
        base = leggi_env(HOME / ".env").get("DOMINIO_BASE", "")
        h = hidden(csrf)
        aiuto_dom = (f'Lascia «auto» per usare <code>identificativo.{e(base)}</code>, oppure scrivi i tuoi domini '
                     f'separati da virgola.' if base else 'Es. sanrocco.tuodominio.it (più domini separati da virgola).')
        msg = f'<div class="box errore">{e(errore)}</div>' if errore else ""
        return pagina("Nuova parrocchia", f'''<a class="back" href="/">‹ Parrocchie</a><h1>Nuova parrocchia</h1>
<p class="muted">Crea il sito della parrocchia e il suo amministratore. Le chiese le aggiunge poi la parrocchia, da Impostazioni.</p>{msg}
<form method="post" action="/parrocchie">{h}
<div class="card"><h2>Parrocchia</h2><div class="grid">
{campo("nome", "Nome della parrocchia *", v.get("nome", ""), extra='required maxlength="200" placeholder="Es. Parrocchia San Rocco"', classe="full")}
{campo("slug", "Identificativo", v.get("slug", ""), aiuto="Breve, minuscolo, senza spazi (es. sanrocco-gela). Se lo lasci vuoto lo ricavo dal nome.", extra='pattern="[a-z0-9][a-z0-9-]{1,30}" autocapitalize="off" spellcheck="false"', classe="full")}
{campo("citta", "Città", v.get("citta", ""), extra='maxlength="100"')}
{campo("diocesi", "Diocesi", v.get("diocesi", ""), extra='maxlength="200"')}
{campo("domini", "Indirizzo del sito", v.get("domini", "auto" if base else ""), aiuto=aiuto_dom + " Il DNS deve puntare a questo server.", extra='required autocapitalize="off" spellcheck="false"', classe="full")}
{campo("email", "Email dell'amministratore", v.get("email", ""), tipo="email", aiuto="Facoltativa: se vuota uso admin@indirizzo-del-sito.", classe="full")}
</div></div>
<button class="primary wide">Crea la parrocchia</button>
<p class="muted small">Ci vuole circa un minuto. La password dell'amministratore viene mostrata una sola volta, alla fine.</p>
</form>''', csrf)

    @app.get("/nuova", response_class=HTMLResponse)
    def nuova_form(request: Request):
        s = sessione(request)
        if not s:
            return vai_al_login()
        return HTMLResponse(modulo_nuova(s["c"]))

    @app.post("/parrocchie")
    def crea(request: Request, csrf: str = Form(""), slug: str = Form(""), nome: str = Form(""),
             domini: str = Form(""), email: str = Form(""), citta: str = Form(""), diocesi: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        v = {"slug": slug, "nome": nome, "domini": domini, "email": email, "citta": citta, "diocesi": diocesi}
        nome, email = nome.strip(), email.strip()
        slug = slug.strip().lower() or slug_da_nome(nome)
        domini = domini.strip().lower().replace(" ", "")
        errore = ""
        if not nome or len(nome) > 200 or '"' in nome or "$" in nome or "`" in nome:
            errore = "Scrivi il nome della parrocchia (senza virgolette)."
        elif not SLUG_RE.match(slug):
            errore = "Identificativo non valido: solo lettere minuscole, numeri e trattini (2-31 caratteri)."
        elif (HOME / "parrocchie" / f"{slug}.env").exists():
            errore = f"Esiste già una parrocchia con identificativo «{slug}»: scegline un altro."
        elif not DOMINI_RE.match(domini):
            errore = "Indirizzo del sito non valido."
        elif email and not EMAIL_RE.match(email):
            errore = "Email dell'amministratore non valida."
        if errore:
            return HTMLResponse(modulo_nuova(s["c"], errore, v), status_code=400)

        codice, out = esegui(*(["add", slug, domini, nome] + ([email] if email else [])), timeout=600)
        if codice != 0:
            return esito(f"Nuova parrocchia: {nome}", codice, out, s["c"])

        def valore(chiave: str) -> str:
            m = re.search(rf"^\s*{chiave}:\s*(\S+)", out, re.M)
            return m.group(1) if m else ""

        indirizzo, utente, password = valore("Indirizzo"), valore("Utente"), valore("Password")
        avviso = ""
        if citta.strip() or diocesi.strip():
            ok_conf, msg_conf = db_parrocchia(slug, "dati_parrocchia", {
                "citta": citta.strip()[:100], "diocesi": diocesi.strip()[:200]})
            if not ok_conf:
                avviso = f'<div class="box warn">Città e diocesi non salvate ({e(msg_conf)}): si inseriscono da Impostazioni.</div>'
        cred = (f'<div class="box ok"><h3 style="margin-bottom:8px">Annota ora questi dati</h3><div class="cred">'
                f'<span>Sito</span><b><a href="{e(indirizzo)}" rel="noreferrer">{e(indirizzo.removeprefix("https://"))}</a></b>'
                f'<span>Utente</span><b>{e(utente)}</b><span>Password</span><b>{e(password)}</b></div>'
                f'<p class="small" style="margin:10px 0 0">La password non viene salvata da nessuna parte e al primo '
                f'accesso andrà cambiata.</p></div>') if password else ""
        corpo = (f'<a class="back" href="/">‹ Parrocchie</a><h1>{e(nome)}</h1>'
                 f'<div class="card"><div class="row between"><h2 style="margin:0">Parrocchia creata</h2>'
                 f'<span class="pill attiva">fatto</span></div><div style="height:12px"></div>{cred}{avviso}'
                 f'<details class="altro"><summary>Dettagli tecnici</summary><pre>{e(out)}</pre></details>'
                 f'<p><a class="btn primary" href="/parrocchie/{e(slug)}">Apri la scheda della parrocchia</a></p></div>')
        return HTMLResponse(pagina(f"Nuova parrocchia: {nome}", corpo, s["c"]))

    # ── scheda della parrocchia ──────────────────────────────────────────────

    def slug_valido(slug: str) -> bool:
        return bool(SLUG_RE.match(slug)) and (HOME / "parrocchie" / f"{slug}.env").exists()

    @app.get("/parrocchie/{slug}", response_class=HTMLResponse)
    def scheda(request: Request, slug: str):
        s = sessione(request)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return HTMLResponse(pagina("Non trovata", '<a class="back" href="/">‹ Parrocchie</a><p>Parrocchia non trovata.</p>',
                                       s["c"]), status_code=404)
        csrf = s["c"]
        h = hidden(csrf)
        p = next((x for x in parrocchie() if x["slug"] == slug), None)
        letto, dati = db_parrocchia(slug, "leggi")
        sl = e(slug)

        siti = " · ".join(f'<a href="https://{e(d)}" rel="noreferrer">{e(d)} ↗</a>' for d in p["domini"]) or "nessun dominio"

        if letto:
            par = dati.get("parrocchia") or {}
            info = " · ".join(e(x) for x in (par.get("citta"), par.get("diocesi") and f'Diocesi di {par["diocesi"]}') if x)
            utenti = dati["utenti"]
            avviso = ""
        else:
            info, utenti = "", []
            avviso = f'<div class="box warn">{e(dati)}</div>'

        if utenti:
            opzioni = "".join(f'<option value="{e(u["email"])}">{e(u["email"])} — {e(u["ruolo"])}'
                              f'{"" if u["attivo"] else " (disattivato)"}</option>' for u in utenti)
            campo_email = f'<select name="email" required aria-label="Utente">{opzioni}</select>'
        else:
            campo_email = '<input name="email" type="email" placeholder="email dell\'utente" required>'

        corpo = f'''<a class="back" href="/">‹ Parrocchie</a>
<div class="row between"><h1 class="grow">{e(p["nome"])}</h1><span class="pill {e(p["stato"])}">{e(p["stato"])}</span></div>
<p class="muted" style="margin:0 0 14px">{info + " · " if info else ""}{siti}</p>{avviso}

<div class="card"><h2>Operazioni</h2>
<p class="muted small" style="margin-top:-6px">Spazio usato {e(p["spazio"])} · ultimo backup {e(p["ultimo_backup"])}</p>
<div class="actions">
<form method="post" action="/parrocchie/{sl}/backup">{h}<button>Backup ora</button></form>
<a class="btn" href="/parrocchie/{sl}/backup">Archivi</a>
<form method="post" action="/parrocchie/{sl}/riavvia">{h}<button>Riavvia</button></form>
<a class="btn" href="/parrocchie/{sl}/log">Log</a>
</div></div>

<div class="card"><h2>Password provvisoria</h2>
<p class="muted small" style="margin-top:-6px">Per chi non riesce più a entrare. Di solito basta un amministratore della
parrocchia, da Utenti; qui serve se si è bloccato proprio lui.</p>
<form method="post" action="/parrocchie/{sl}/password">{h}<div class="field">{campo_email}</div>
<button>Crea password provvisoria</button></form></div>

<div class="card"><h2>Indirizzo del sito</h2>
<form method="post" action="/parrocchie/{sl}/domini">{h}
<div class="field"><input name="domini" value="{e(",".join(p["domini"]))}" required aria-label="Domini" autocapitalize="off" spellcheck="false">
<div class="hint">Più domini separati da virgola, oppure «auto». Il DNS deve puntare a questo server.</div></div>
<button>Cambia indirizzo</button></form></div>

<div class="card zona"><h2 class="err">Disattiva la parrocchia</h2>
<p class="muted small" style="margin-top:-6px">Il sito si spegne ma i dati restano sul server.</p>
<form method="post" action="/parrocchie/{sl}/disattiva">{h}
<div class="field"><label for="conferma">Per confermare scrivi <code>{sl}</code></label>
<input id="conferma" name="conferma" required autocapitalize="off" spellcheck="false"></div>
<button class="danger">Disattiva</button></form></div>
<p class="muted small">Identificativo: <code>{sl}</code> · {e(p["dettaglio"])}</p>'''
        return HTMLResponse(pagina(p["nome"], corpo, csrf))

    # ── operazioni ───────────────────────────────────────────────────────────

    def ritorno(slug: str) -> dict:
        return {"ritorno": f"/parrocchie/{slug}", "testo_ritorno": "Torna alla parrocchia"}

    @app.post("/parrocchie/{slug}/backup")
    def backup(request: Request, slug: str, csrf: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return esito("Backup", 1, "Parrocchia non trovata.", s["c"])
        return esito(f"Backup di {slug}", *esegui("backup", slug), s["c"], **ritorno(slug))

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
        return esito(f"Riavvio di {slug}", *esegui("restart", slug), s["c"], **ritorno(slug))

    @app.post("/parrocchie/{slug}/password")
    def nuova_password(request: Request, slug: str, csrf: str = Form(""), email: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug) or not EMAIL_RE.match(email.strip()):
            return esito("Password provvisoria", 1, "Dati non validi.", s["c"], **ritorno(slug))
        codice, out = esegui("reset-password", slug, email.strip())
        m = re.search(r"Nuova password per \S+ \(\S+\): (\S+)", out)
        if codice != 0 or not m:
            return esito(f"Password provvisoria ({slug})", codice or 1, out, s["c"], **ritorno(slug))
        corpo = (f'<a class="back" href="/parrocchie/{e(slug)}">‹ Torna alla parrocchia</a>'
                 f'<div class="card"><h2>Password provvisoria creata</h2><div class="box ok"><div class="cred">'
                 f'<span>Utente</span><b>{e(email.strip())}</b><span>Password</span><b>{e(m.group(1))}</b></div></div>'
                 f'<p class="muted small">Comunicala all\'utente: al primo accesso dovrà sceglierne una sua. '
                 f'Le sessioni aperte con la vecchia password sono state chiuse.</p>'
                 f'<p><a class="btn primary" href="/parrocchie/{e(slug)}">Fatto</a></p></div>')
        return HTMLResponse(pagina("Password provvisoria", corpo, s["c"]))

    @app.post("/parrocchie/{slug}/domini")
    def cambia_domini(request: Request, slug: str, csrf: str = Form(""), domini: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        domini = domini.strip().lower().replace(" ", "")
        if not slug_valido(slug) or not DOMINI_RE.match(domini):
            return esito("Indirizzo del sito", 1, "Dati non validi.", s["c"], **ritorno(slug))
        return esito(f"Indirizzo del sito di {slug}", *esegui("domini", slug, domini), s["c"], **ritorno(slug))

    @app.post("/parrocchie/{slug}/disattiva")
    def disattiva(request: Request, slug: str, csrf: str = Form(""), conferma: str = Form("")):
        s = verifica_csrf(request, csrf)
        if not s:
            return vai_al_login()
        if not slug_valido(slug) or conferma.strip() != slug:
            return esito("Disattivazione", 1, "Per confermare scrivi esattamente l'identificativo della parrocchia.",
                         s["c"], **ritorno(slug))
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
        stato = "in corso: ricarica la pagina per seguire l'avanzamento" if _aggiornamento["in_corso"] \
            else (_aggiornamento["esito"] or "")
        return HTMLResponse(pagina("Aggiornamento", f'<a class="back" href="/">‹ Parrocchie</a>'
                                   f'<div class="card"><h2>Aggiornamento {e(stato)}</h2>'
                                   f'<pre>{e(testo)}</pre></div>', s["c"]))

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
        return HTMLResponse(pagina(f"Log {slug}", f'<a class="back" href="/parrocchie/{e(slug)}">‹ Torna alla parrocchia</a>'
                                   f'<div class="card"><h2>Log di {e(slug)}</h2><pre>{e(testo)}</pre></div>', s["c"]))

    @app.get("/parrocchie/{slug}/backup", response_class=HTMLResponse)
    def archivi(request: Request, slug: str):
        s = sessione(request)
        if not s:
            return vai_al_login()
        if not slug_valido(slug):
            return HTMLResponse(pagina("Archivi", "<p>Parrocchia non trovata.</p>", s["c"]), status_code=404)
        cartella = HOME / "backups" / slug
        files = sorted(cartella.glob("*.tar.gz"), reverse=True) if cartella.exists() else []
        voci = "".join(
            f'<li class="row between" style="padding:10px 0"><span class="grow"><a href="/parrocchie/{e(slug)}/backup/{e(f.name)}" '
            f'style="word-break:break-all">{e(f.name)}</a><span class="muted small" style="display:block">'
            f'{datetime.fromtimestamp(f.stat().st_mtime):%d/%m/%Y %H:%M} · {fmt_bytes(f.stat().st_size)}</span></span></li>'
            for f in files
        ) or '<li class="muted">Nessun archivio: usa «Backup ora».</li>'
        corpo = (f'<a class="back" href="/parrocchie/{e(slug)}">‹ Torna alla parrocchia</a>'
                 f'<div class="card"><h2>Archivi di {e(slug)}</h2><p class="muted small">Database e allegati. '
                 f'Per ripristinarne uno: <code>rechurch.sh restore {e(slug)} &lt;file&gt;</code></p>'
                 f'<ul class="list">{voci}</ul></div>')
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
