# ReChurch su Kimsufi (OVH): più parrocchie su un server

Guida per ospitare ReChurch su un server dedicato **Kimsufi** (o qualunque server
OVH/VPS con Ubuntu o Debian) e distribuirlo a **più parrocchie**, ognuna con il
**proprio database**.

## Come è organizzato

```
                 Internet (HTTPS)
                        │
                ┌───────▼────────┐   certificati Let's Encrypt automatici
                │     Caddy      │   un blocco per ogni dominio
                └──┬─────────┬───┘
   sanrocco.tuodominio.it   parrocchia-sanmichele.it
        ┌──────▼─────┐   ┌─────▼──────┐
        │ p-sanrocco │   │p-sanmichele│   stessa immagine Docker,
        └──────┬─────┘   └─────┬──────┘   un container per parrocchia
   data/sanrocco/        data/sanmichele/
   ├ rechurch.db         ├ rechurch.db     ← database separati
   ├ uploads/            ├ uploads/
   └ backups/            └ backups/
```

- **Un database per parrocchia.** Ogni parrocchia gira nel proprio container con
  il proprio file SQLite, i propri allegati e i propri backup. Non c'è nessuna
  tabella condivisa: i dati di una parrocchia non possono finire in un'altra, e
  si possono salvare, ripristinare, spostare o cancellare una per una.
- **Chiavi separate.** Ogni parrocchia ha la propria `SECRET_KEY`, quindi un
  login fatto su una parrocchia non vale sulle altre.
- **Un solo aggiornamento per tutte.** Tutte usano la stessa immagine:
  `rechurch.sh update` aggiorna l'intero server.
- **Più chiese per parrocchia.** Dentro ogni parrocchia, in *Impostazioni →
  Chiese della parrocchia*, si registrano la chiesa parrocchiale e le altre
  (sussidiarie, rettorie, cappelle). Vedi [Più chiese](#più-chiese-nella-stessa-parrocchia).

Una parrocchia occupa circa **100–150 MB di RAM** da ferma. Un server con 4 GB
di RAM regge senza problemi 15–20 parrocchie.

---

## 1. Ordinare e installare il server

1. Su <https://eco.ovhcloud.com> (Kimsufi) scegli un server. Per iniziare basta
   il modello più economico. Prendi un **datacenter europeo** (Francia o
   Germania): i registri parrocchiali sono dati personali e il GDPR chiede che
   restino nell'UE.
2. Dal pannello OVH: **Reinstalla → Ubuntu Server 24.04 LTS** e incolla la tua
   **chiave SSH pubblica**. Se hai due dischi, va bene il RAID 1 proposto di
   default.
3. Al termine ricevi l'IP del server. Collegati:
   ```bash
   ssh ubuntu@IP_DEL_SERVER      # oppure root@, secondo il template OVH
   ```

## 2. Preparare il server (una volta sola)

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/gmmg90/rechurch.git /opt/rechurch
sudo bash /opt/rechurch/deploy/kimsufi-setup.sh --ssh-solo-chiavi
```

> Se il repository è privato, prima del `git clone` crea una *deploy key* (in sola
> lettura) su GitHub → Settings → Deploy keys, oppure usa un token personale.

Lo script installa Docker, apre nel firewall solo SSH/80/443, attiva fail2ban e
gli aggiornamenti di sicurezza automatici, crea lo swap se manca e programma il
backup notturno di tutte le parrocchie. `--ssh-solo-chiavi` disattiva il login
SSH con password, ma solo se trova già una chiave installata.

## 3. Inizializzare ReChurch

```bash
sudo /opt/rechurch/deploy/rechurch.sh init
sudo nano /srv/rechurch/.env
```

Nel file `.env` (impostazioni **comuni** a tutte le parrocchie) imposta almeno:

| Variabile | Scopo |
|-----------|-------|
| `ACME_EMAIL` | La tua email: Let's Encrypt la usa per gli avvisi sui certificati |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Il tuo account di gestore. Viene creato in **ogni** parrocchia e non compare nella pagina Utenti (vedi DEPLOY.md §2c) |
| `CLOUD_BACKUP_PROVIDER` + credenziali | Backup fuori dal server (consigliato, vedi §6) |

Poi applica le modifiche con `sudo /opt/rechurch/deploy/rechurch.sh up`.

## 4. Aggiungere una parrocchia

**DNS.** Per prima cosa crea il record DNS che punta al server:

| Tipo | Nome | Valore |
|------|------|--------|
| A | `sanrocco.tuodominio.it` | IP del server |

> **Comodo:** con un record jolly `*.tuodominio.it → IP` qualunque nuova
> parrocchia `<nome>.tuodominio.it` funziona subito, senza toccare il DNS.
> Una parrocchia può anche usare un dominio proprio (`parrocchiasanrocco.it`):
> basta che il suo record A punti al server.
>
> Non aggiungere un record **AAAA** (IPv6) se l'IPv6 non è configurato sul
> server: Let's Encrypt lo proverebbe per primo e il certificato non verrebbe
> rilasciato.

**Creazione:**

```bash
sudo /opt/rechurch/deploy/rechurch.sh add sanrocco sanrocco.tuodominio.it "Parrocchia San Rocco" parroco@example.it
```

- `sanrocco` è lo *slug*, cioè il nome tecnico: minuscole, numeri e trattini.
- Più domini per la stessa parrocchia vanno separati da virgole:
  `parrocchiasanrocco.it,www.parrocchiasanrocco.it`.
- L'ultimo argomento è l'email dell'amministratore della parrocchia. Se lo ometti
  viene usato `admin@<dominio>`.

Lo script crea il database, avvia il container, ottiene il certificato HTTPS e
stampa **una sola volta** la password iniziale. La password non viene salvata da
nessuna parte: consegnala al parroco e chiedigli di cambiarla al primo accesso.

Il nome della parrocchia viene usato anche per la **chiesa parrocchiale**, creata
in automatico. Se la chiesa ha un nome diverso, imposta `CHIESA_PRINCIPALE`
nel file della parrocchia prima del primo avvio, oppure rinominala dalle
Impostazioni.

## 5. Gestione quotidiana

```bash
R=/opt/rechurch/deploy/rechurch.sh
sudo $R list                          # parrocchie e stato (healthy = ok)
sudo $R logs sanrocco                 # log di una parrocchia (Ctrl+C per uscire)
sudo $R update                        # aggiorna il codice: backup, build, riavvio di tutte
sudo $R reset-password sanrocco parroco@example.it
sudo $R remove sanrocco               # disattiva; i dati restano in /srv/rechurch/data/sanrocco
```

Per cambiare un'impostazione di una sola parrocchia (domini, cartella dei
backup, ecc.) modifica `/srv/rechurch/parrocchie/<slug>.env` e lancia
`sudo $R up`.

## 6. Backup

Sono previsti tre livelli:

1. **In ogni parrocchia, ogni notte** (orari sfalsati tra le 02:00 e le 05:00):
   una copia del DB in `data/<slug>/backups/`. Si scarica anche dalla pagina
   *Impostazioni*. Ne vengono tenute 60 (`BACKUP_KEEP_LOCAL`).
2. **Archivio del server, alle 03:30** (cron installato da `kimsufi-setup.sh`):
   `rechurch.sh backup all` salva DB + allegati di ogni parrocchia in
   `/srv/rechurch/backups/<slug>/*.tar.gz`. Ne vengono tenuti 14 (`SERVER_BACKUP_KEEP`).
3. **Fuori dal server (da attivare).** Kimsufi non include spazio di backup e un
   guasto del disco porterebbe via tutto. Attiva almeno una di queste opzioni:
   - **Dropbox / Google Drive**: configura `CLOUD_BACKUP_PROVIDER` nel `.env`
     comune (procedura in [DEPLOY.md §2](DEPLOY.md#2-backup-automatico-su-cloud)).
     Ogni parrocchia scrive nella propria cartella `/ReChurch/<slug>`. Con Google
     Drive imposta `GDRIVE_FOLDER_ID` nel file di ciascuna parrocchia.
   - **Copia degli archivi su un altro server** (ad esempio uno storage box), con
     un cron giornaliero:
     `rsync -a /srv/rechurch/backups/ utente@altro-server:rechurch-backups/`

**Ripristino** (il DB attuale viene conservato accanto con il suffisso
`.prima-del-ripristino-<data>`):

```bash
sudo $R restore sanrocco /srv/rechurch/backups/sanrocco/sanrocco_20261123_033000.tar.gz
# oppure un singolo file .db scaricato dalla pagina Impostazioni
```

> Non copiare a mano `rechurch.db` mentre l'app è in esecuzione: il database
> lavora in modalità WAL e la copia potrebbe essere incompleta. Usa sempre
> `rechurch.sh backup`.

## 7. Spostare una parrocchia già esistente sul server

1. Crea la parrocchia con `rechurch.sh add ...`.
2. Esporta il DB dalla vecchia installazione (pagina *Impostazioni → Backup →
   Scarica*, oppure il file `C:\ReChurch\rechurch.db` dell'app desktop).
3. Copialo sul server (`scp file.db ubuntu@IP:/tmp/`) e lancia
   `sudo $R restore <slug> /tmp/file.db`.

All'avvio il database viene aggiornato in automatico allo schema nuovo (vengono
aggiunte le colonne mancanti, come quelle per le chiese). Gli utenti e le
password restano quelli del database importato.

## Più chiese nella stessa parrocchia

- In **Impostazioni → Chiese della parrocchia** l'amministratore aggiunge le
  chiese, sceglie qual è la parrocchiale (stella) e può disattivare quelle non
  più in uso. Una chiesa già collegata a dei sacramenti non si può eliminare,
  solo disattivare.
- Nei moduli di **battesimi, comunioni, cresime e matrimoni** compare il campo
  **Chiesa**. Scegliendo una chiesa, il *luogo* del sacramento viene compilato
  con il suo nome, che è quello stampato sul certificato. Il luogo resta
  comunque modificabile a mano.
- Se la parrocchia ha più di una chiesa, nelle **liste** compare il filtro
  *Tutte le chiese*.
- Dopo un import dall'archivio Access, il pulsante 🔗 accanto a una chiesa
  collega a quella chiesa tutti i sacramenti che non ne hanno ancora una.
- Le API di **scadenziario** (`/scadenziario/eventi/?chiesa_id=`) e
  **contabilità** (`/contabilita/movimenti/`, `/riepilogo/`, `/export/excel`,
  tutte con `?chiesa_id=`) accettano già la chiesa. Nelle pagine di questi due
  moduli il campo non è ancora presente.

## Riferimento: variabili per parrocchia

File `/srv/rechurch/parrocchie/<slug>.env`. Le variabili scritte qui hanno la
precedenza su quelle del `.env` comune.

| Variabile | Scopo |
|-----------|-------|
| `PARROCCHIA_NOME` | Nome usato al primo avvio (poi si modifica da Impostazioni) |
| `DOMAINS` | Domini della parrocchia, separati da virgole |
| `SECRET_KEY` | Firma dei login, generata dallo script. Se la cambi, tutti devono rifare l'accesso |
| `ADMIN_EMAIL` | Amministratore creato al primo avvio |
| `BACKUP_HOUR` / `BACKUP_MINUTE` | Orario del backup notturno, sfalsato in automatico |
| `DROPBOX_FOLDER` / `GDRIVE_FOLDER_ID` | Cartella cloud della parrocchia |
| `CHIESA_PRINCIPALE` | Nome della chiesa parrocchiale, se diverso dal nome della parrocchia |
| `DATABASE_URL` | Facoltativo: Postgres invece di SQLite (un database per parrocchia) |
