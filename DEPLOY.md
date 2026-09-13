# ReChurch — Deploy & Backup cloud

ReChurch può girare in due modi, dallo stesso codice:

| Modalità | Come | Login | Dati |
|----------|------|-------|------|
| **Desktop** (PC parrocchia) | `build.ps1` → installer Windows | disattivato (locale) | `C:\ReChurch\` |
| **Web** (accessibile da fuori) | deploy cloud (sotto) | attivo | Postgres cloud |

---

## 1. Deploy web gratuito (Render + Neon)

Obiettivo: app raggiungibile da qualsiasi luogo tramite un URL HTTPS, **senza costi**.
Usiamo **Render** (hosting web, piano free) + **Neon** (Postgres persistente, piano free).
Il piano free di Render non ha disco persistente: per questo i dati vanno su Neon.

### 1a. Crea il database Postgres gratuito (Neon)
1. Registrati su <https://neon.tech> (gratis).
2. Crea un progetto → copia la **connection string**, del tipo:
   `postgresql://utente:password@host/dbname?sslmode=require`
   (In alternativa va bene anche Supabase: <https://supabase.com>.)

### 1b. Deploy su Render
1. Registrati su <https://render.com> (gratis) e collega il tuo account GitHub.
2. **New → Blueprint** → seleziona il repo `gmmg90/rechurch`.
   Render legge `render.yaml` e crea il servizio web dal `Dockerfile`.
3. Quando chiede le variabili, imposta:
   - `DATABASE_URL` = la connection string di Neon del punto 1a
   - `SECRET_KEY` = lascia che Render ne generi una (già configurato)
4. Deploy. Al primo avvio l'app crea le tabelle e l'utente admin:
   **`admin@parrocchia.it` / `admin123`** → cambia subito la password.

> L'app free di Render si "addormenta" dopo ~15 min di inattività e si riavvia
> alla prima richiesta (qualche secondo di attesa). Per un servizio sempre attivo
> serve un piano a pagamento.

### Alternative gratuite
- **Fly.io**: mantiene SQLite grazie a un volume persistente gratuito.
  `fly launch` dal repo, poi `fly volumes create data` e monta su `/data`
  (l'immagine usa già `RECHURCH_DATA_DIR=/data`). In questo caso **non** serve Postgres.
- **Koyeb**, **Railway**: stesso `Dockerfile`, con Postgres esterno come sopra.

---

## 2. Backup automatico su cloud

Ogni notte alle **02:00** l'app crea un backup del database. Con la configurazione
qui sotto, il backup viene anche caricato su Google Drive o Dropbox. Il pulsante
"Backup ora" (area Amministrazione) fa lo stesso su richiesta.
Senza configurazione, il backup resta solo locale (nessun errore).

Variabili comuni:
- `CLOUD_BACKUP_PROVIDER` = `gdrive` | `dropbox` | `none`
- `CLOUD_BACKUP_KEEP` = quanti backup tenere nel cloud (default 30)

### 2a. Google Drive (service account)
1. Su <https://console.cloud.google.com> crea un progetto → abilita **Google Drive API**.
2. Crea un **Service Account** → genera una chiave **JSON**.
3. In Google Drive crea una cartella (es. "ReChurch Backup") e **condividila**
   (come Editor) con l'email del service account (`...@...iam.gserviceaccount.com`).
4. Copia l'**ID della cartella** dall'URL (`https://drive.google.com/drive/folders/<QUESTO_ID>`).
5. Imposta le variabili:
   - `CLOUD_BACKUP_PROVIDER=gdrive`
   - `GDRIVE_FOLDER_ID=<id cartella>`
   - `GDRIVE_SERVICE_ACCOUNT_INFO=<contenuto del file JSON>` (incolla il JSON intero)
     — in alternativa `GDRIVE_SERVICE_ACCOUNT_JSON=/percorso/al/file.json`

### 2b. Dropbox (refresh token)
1. Su <https://www.dropbox.com/developers/apps> crea un'app (Scoped access, App folder).
2. Aggiungi il permesso `files.content.write` e genera un **refresh token** (OAuth).
3. Imposta le variabili:
   - `CLOUD_BACKUP_PROVIDER=dropbox`
   - `DROPBOX_APP_KEY=...`
   - `DROPBOX_APP_SECRET=...`
   - `DROPBOX_REFRESH_TOKEN=...`
   - `DROPBOX_FOLDER=/ReChurch` (opzionale)

Le librerie cloud sono già incluse nell'immagine Docker (`requirements-cloud.txt`).
Per usarle in locale: `pip install -r backend/requirements-cloud.txt`.

---

## 3. Variabili d'ambiente — riepilogo

| Variabile | Scopo | Default |
|-----------|-------|---------|
| `DATABASE_URL` | Connection string DB (Postgres in cloud) | SQLite locale |
| `SECRET_KEY` | Firma dei token JWT | valore di sviluppo (cambiare!) |
| `RECHURCH_DESKTOP` | `1` = nessun login (modalità desktop) | non impostato |
| `AUTH_DISABLED` | `1` = nessun login (come sopra) | non impostato |
| `PORT` | Porta di ascolto (impostata dall'host) | 8000 |
| `CLOUD_BACKUP_PROVIDER` | `gdrive`/`dropbox`/`none` | `none` |
| `CLOUD_BACKUP_KEEP` | Backup da conservare nel cloud | 30 |

> In cloud **non** impostare `RECHURCH_DESKTOP`/`AUTH_DISABLED`: il login deve
> restare attivo perché l'app è esposta pubblicamente.
