# ReChurch

Gestione parrocchiale completa — sostituisce il vecchio database Access con una
web app moderna, utilizzabile sia come **applicazione desktop** (installabile sul
PC della parrocchia) sia come **web app accessibile da fuori**, dallo stesso codice.

## Funzionalità

- **Sacramenti**: Battesimi, Comunioni, Cresime, Matrimoni — registro con ricerca,
  filtri per anno e generazione **PDF dei certificati**.
- **Modelli Certificati**: personalizzazione del testo dei certificati con segnaposti
  e anteprima live.
- **Rubrica Anime**: famiglie e persone della parrocchia, con collegamento ai sacramenti.
- **Contabilità**: entrate/uscite, categorie, fornitori, allegati (foto/documenti),
  export Excel.
- **Scadenziario**: calendario eventi con ricorrenze.
- **Scanner Documenti**: acquisizione ricevute/documenti da fotocamera (mobile).
- **Amministrazione**: attiva/disattiva moduli, statistiche, compleanni e anniversari.
- **Import da Access**: migrazione one-shot dal vecchio archivio `.accdb`.
- **Utenti e ruoli** (admin/segreteria/economo/lettura) con login JWT — disattivabile
  in modalità desktop.
- **Backup** automatico giornaliero, locale e opzionalmente su **Google Drive/Dropbox**.

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + SQLite (o Postgres in cloud)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **PDF**: ReportLab · **Packaging desktop**: PyInstaller + Inno Setup

## Avvio in sviluppo

Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (in un secondo terminale):
```bash
cd frontend
npm install
npm run dev
```

Apri <http://localhost:5173>. Al primo avvio viene creato l'utente
**`admin@parrocchia.it` / `admin123`** (cambia subito la password).

## Modalità d'uso

| Modalità | Guida | Login |
|----------|-------|-------|
| Sviluppo | sopra | attivo |
| **Desktop** (PC parrocchia, installer Windows) | [BUILD.md](BUILD.md) | disattivato in locale |
| **Web** (accessibile da fuori, deploy gratuito) | [DEPLOY.md](DEPLOY.md) | attivo |
| **Backup su cloud** (Google Drive/Dropbox) | [DEPLOY.md](DEPLOY.md#2-backup-automatico-su-cloud) | — |

## Struttura

```
backend/          FastAPI (app/), packaging desktop (launcher.py, rechurch.spec)
frontend/         React + Vite
installer/         Inno Setup (installer Windows)
Dockerfile         immagine per il deploy cloud
render.yaml        blueprint deploy gratuito (Render)
BUILD.md           build dell'app desktop Windows
DEPLOY.md          deploy web gratuito + backup cloud
```
