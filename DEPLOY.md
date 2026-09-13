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

### 2a. Dropbox — consigliato per account personali
Più semplice e affidabile di Google Drive per un account normale (nessun problema
di quota, cartella dedicata isolata).

1. Vai su <https://www.dropbox.com/developers/apps> → **Create app**:
   - *Scoped access* → *App folder* → dai un nome (es. `ReChurch`).
2. Tab **Permissions**: spunta `files.content.write` e `files.content.read` → **Submit**.
3. Tab **Settings**: copia **App key** e **App secret**.
4. Genera il **refresh token** (una volta sola), nel browser:
   a. Apri questo URL (metti la tua App key al posto di `APPKEY`):
      `https://www.dropbox.com/oauth2/authorize?client_id=APPKEY&token_access_type=offline&response_type=code`
   b. Autorizza → copia il **codice** che ti mostra.
   c. Scambia il codice con un refresh token (da terminale, sostituendo i valori):
      ```bash
      curl https://api.dropbox.com/oauth2/token \
        -d code=IL_CODICE -d grant_type=authorization_code \
        -u APPKEY:APPSECRET
      ```
      Nella risposta JSON copia il valore di `refresh_token`.
5. Imposta le variabili (su Render → servizio → *Environment*):
   - `CLOUD_BACKUP_PROVIDER=dropbox`
   - `DROPBOX_APP_KEY=...`
   - `DROPBOX_APP_SECRET=...`
   - `DROPBOX_REFRESH_TOKEN=...`
   - `DROPBOX_FOLDER=/ReChurch` (opzionale)

### 2b. Google Drive — OAuth utente (per Gmail personale)
Usa lo spazio del tuo account Google. (I *service account* non funzionano col Drive
personale per limiti di quota: usa questo metodo OAuth.)

1. Su <https://console.cloud.google.com> crea un progetto → abilita **Google Drive API**.
2. **Credenziali → Crea credenziali → ID client OAuth** → tipo *App desktop*.
   Copia **Client ID** e **Client secret**. In *Schermata consenso OAuth* aggiungi
   il tuo indirizzo Gmail tra gli **utenti di test**.
3. Genera il **refresh token** con l'OAuth Playground:
   a. Apri <https://developers.google.com/oauthplayground> → ingranaggio in alto a
      destra → spunta *Use your own OAuth credentials* → incolla Client ID/secret.
   b. Nella lista scegli *Drive API v3* → `https://www.googleapis.com/auth/drive.file`
      → **Authorize APIs** → accedi col tuo Gmail.
   c. **Exchange authorization code for tokens** → copia il **Refresh token**.
4. In Google Drive crea una cartella (es. "ReChurch Backup") e copia l'**ID** dall'URL
   (`https://drive.google.com/drive/folders/<QUESTO_ID>`).
5. Imposta le variabili:
   - `CLOUD_BACKUP_PROVIDER=gdrive`
   - `GDRIVE_CLIENT_ID=...`
   - `GDRIVE_CLIENT_SECRET=...`
   - `GDRIVE_REFRESH_TOKEN=...`
   - `GDRIVE_FOLDER_ID=<id cartella>`

   > Per Google **Workspace** puoi invece usare un service account:
   > `GDRIVE_SERVICE_ACCOUNT_INFO=<JSON>` (o `GDRIVE_SERVICE_ACCOUNT_JSON=/percorso`)
   > + `GDRIVE_FOLDER_ID` di una cartella condivisa col service account.

Le librerie cloud sono già incluse nell'immagine Docker (`requirements-cloud.txt`).
Per usarle in locale: `pip install -r backend/requirements-cloud.txt`.

---

## 2c. Account amministratore di sistema (owner)

ReChurch può avere un **account amministratore di sistema** dedicato all'owner/gestore
tecnico. È un normale amministratore (pieni poteri) con due particolarità:

- **Non compare** nella pagina *Utenti* (è un account di servizio, tenuto fuori dalla
  gestione utenti quotidiana per non essere modificato per errore).
- **Non può essere eliminato o declassato** dagli altri amministratori.

Non ci sono credenziali nel codice: l'account esiste **solo** se imposti queste
variabili d'ambiente (ed è ricreato/riallineato ad ogni avvio):

- `SUPERADMIN_EMAIL` — email di accesso dell'owner
- `SUPERADMIN_PASSWORD` — password (scegline una robusta; cambiabile in seguito da *Cambia password*)
- `SUPERADMIN_NOME` / `SUPERADMIN_COGNOME` — opzionali (default "System" / "Owner")

Se non imposti queste variabili, l'account **non viene creato**. Per revocarlo,
rimuovi le variabili e disattiva/ricrea il database, oppure cambia l'email.

> Questo è un account di servizio trasparente e documentato, non un accesso occulto:
> chi amministra il sistema sa che esiste e come è configurato.

---

## 3. Variabili d'ambiente — riepilogo

| Variabile | Scopo | Default |
|-----------|-------|---------|
| `DATABASE_URL` | Connection string DB (Postgres in cloud) | SQLite locale |
| `SECRET_KEY` | Firma dei token JWT | valore di sviluppo (cambiare!) |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Account admin di sistema (owner), non elencato in Utenti | non creato |
| `RECHURCH_DESKTOP` | `1` = nessun login (modalità desktop) | non impostato |
| `AUTH_DISABLED` | `1` = nessun login (come sopra) | non impostato |
| `PORT` | Porta di ascolto (impostata dall'host) | 8000 |
| `CLOUD_BACKUP_PROVIDER` | `gdrive`/`dropbox`/`none` | `none` |
| `CLOUD_BACKUP_KEEP` | Backup da conservare nel cloud | 30 |

> In cloud **non** impostare `RECHURCH_DESKTOP`/`AUTH_DISABLED`: il login deve
> restare attivo perché l'app è esposta pubblicamente.
