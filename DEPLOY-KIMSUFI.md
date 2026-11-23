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
- **Più chiese per parrocchia.** Dentro ogni parrocchia si registrano la chiesa
  parrocchiale e le altre (sussidiarie, rettorie, cappelle), ognuna con i propri
  registri, la propria cassa e, volendo, i propri utenti. Vedi
  [Più chiese](#più-chiese-nella-stessa-parrocchia).
- **Pannello web del gestore.** Su un dominio dedicato, con password e codice
  OTP: creazione delle parrocchie, stato, backup, aggiornamenti. Vedi
  [§5](#5-pannello-web-del-gestore).

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
| `DOMINIO_BASE` | Il tuo dominio per i sottodomini delle parrocchie (es. `tuodominio.it` → `sanrocco.tuodominio.it`) |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Il tuo account di gestore. Viene creato in **ogni** parrocchia e non compare nella pagina Utenti (vedi DEPLOY.md §2c) |
| `CLOUD_BACKUP_PROVIDER` + credenziali | Backup fuori dal server (consigliato, vedi §7) |

Poi applica le modifiche con `sudo /opt/rechurch/deploy/rechurch.sh up`.

## 4. Aggiungere una parrocchia

**Domini.** Ogni parrocchia ha di default un sottodominio tuo e, se ne ha uno,
anche un dominio proprio. Nel DNS:

| Tipo | Nome | Valore | Quando |
|------|------|--------|--------|
| A | `*.tuodominio.it` | IP del server | una volta sola: tutti i sottodomini funzionano subito |
| A | `parrocchiasanrocco.it` | IP del server | per ogni dominio proprio di una parrocchia |
| A | `gestione.tuodominio.it` | IP del server | il pannello del gestore (coperto anche dal jolly) |

> Non aggiungere record **AAAA** (IPv6) se l'IPv6 non è configurato sul server:
> Let's Encrypt lo proverebbe per primo e il certificato non verrebbe rilasciato.

**Creazione** (da terminale, oppure dal [pannello](#5-pannello-web-del-gestore)):

```bash
R=/opt/rechurch/deploy/rechurch.sh
# sottodominio automatico: sanrocco.tuodominio.it (serve DOMINIO_BASE)
sudo $R add sanrocco auto "Parrocchia San Rocco" parroco@example.it
# oppure domini espliciti, separati da virgole
sudo $R add sanmichele sanmichele.tuodominio.it,parrocchiasanmichele.it "Parrocchia San Michele"
# aggiungere in seguito il dominio proprio di una parrocchia
sudo $R domini sanrocco sanrocco.tuodominio.it,parrocchiasanrocco.it
```

- `sanrocco` è lo *slug*, cioè il nome tecnico: minuscole, numeri e trattini.
- L'ultimo argomento è l'email dell'amministratore della parrocchia. Se lo ometti
  viene usato `admin@<primo dominio>`.
- Lo stesso dominio non può essere usato da due parrocchie.

Lo script crea il database, avvia il container, ottiene il certificato HTTPS e
stampa **una sola volta** la password iniziale. La password non viene salvata da
nessuna parte: consegnala al parroco e chiedigli di cambiarla al primo accesso.

Il nome della parrocchia viene usato anche per la **chiesa parrocchiale**, creata
in automatico. Se la chiesa ha un nome diverso, imposta `CHIESA_PRINCIPALE`
nel file della parrocchia prima del primo avvio, oppure rinominala dalle
Impostazioni.

## 5. Pannello web del gestore

Una pagina riservata a te per gestire il server senza terminale: elenco delle
parrocchie con stato, spazio usato e ultimo backup; creazione di una parrocchia;
backup, riavvio, log e archivi scaricabili; cambio dei domini; nuova password
per un utente; disattivazione; aggiornamento di ReChurch.

**Installazione** (una volta sola):

```bash
sudo /opt/rechurch/deploy/rechurch.sh pannello installa gestione.tuodominio.it tua@email.it
```

Lo script stampa **una password** e un **codice QR** (con la chiave anche in
chiaro): inquadralo con un'app Authenticator (Google o Microsoft Authenticator,
Aegis, 1Password…). Per entrare servono email, password e il codice a 6 cifre
dell'app. La password non viene salvata in chiaro: annotala subito in un
gestore di password.

Come è protetto:
- gira sul server (deve poter comandare Docker), ma **non è raggiungibile
  direttamente**: il firewall accetta la sua porta solo da Caddy, e il pannello
  stesso rifiuta le connessioni che non arrivano da lì;
- password + codice OTP, che non si può riusare;
- dopo 5 tentativi sbagliati da un indirizzo (o 20 in totale) l'accesso si
  blocca per 15 minuti;
- la sessione dura 4 ore, è legata a password e OTP (cambiandoli scade) e
  "Esci" la invalida subito;
- ogni azione è protetta da token anti-CSRF; per disattivare una parrocchia
  bisogna riscriverne il nome tecnico.

```bash
sudo $R pannello password    # nuova password
sudo $R pannello otp         # nuovo codice QR (es. telefono perso)
sudo $R pannello stato       # stato del servizio
sudo $R pannello disattiva   # spegne il pannello e toglie il dominio
```

> Chi entra nel pannello controlla l'intero server: non condividere l'accesso e
> tieni l'app Authenticator su un telefono protetto. Il ripristino di un backup
> si fa solo da terminale (`rechurch.sh restore`), apposta.

## 6. Gestione da terminale

```bash
R=/opt/rechurch/deploy/rechurch.sh
sudo $R list                          # parrocchie e stato (healthy = ok)
sudo $R logs sanrocco                 # log di una parrocchia (Ctrl+C per uscire)
sudo $R update                        # aggiorna il codice: backup, build, riavvio di tutte
sudo $R reset-password sanrocco parroco@example.it
sudo $R domini sanrocco sanrocco.tuodominio.it,parrocchiasanrocco.it
sudo $R remove sanrocco               # disattiva; i dati restano in /srv/rechurch/data/sanrocco
```

Per cambiare un'impostazione di una sola parrocchia (domini, cartella dei
backup, ecc.) modifica `/srv/rechurch/parrocchie/<slug>.env` e lancia
`sudo $R up`.

## 7. Backup

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

## 8. Spostare una parrocchia già esistente sul server

1. Crea la parrocchia con `rechurch.sh add ...`.
2. Esporta il DB dalla vecchia installazione (pagina *Impostazioni → Backup →
   Scarica*, oppure il file `C:\ReChurch\rechurch.db` dell'app desktop).
3. Copialo sul server (`scp file.db ubuntu@IP:/tmp/`) e lancia
   `sudo $R restore <slug> /tmp/file.db`.

All'avvio il database viene aggiornato in automatico allo schema nuovo (vengono
aggiunte le colonne mancanti, come quelle per le chiese). Gli utenti e le
password restano quelli del database importato.

## Più chiese nella stessa parrocchia

Tutto si configura dentro l'app della parrocchia, come amministratore.

**Chiese** — *Impostazioni → Chiese della parrocchia*: aggiungi le chiese,
scegli la parrocchiale (stella), disattiva quelle non più in uso (una chiesa con
sacramenti registrati non si elimina). Per ogni chiesa puoi indicare indirizzo,
contatti e **rettore**: servono per i certificati.

**Registri separati** — ogni chiesa ha il proprio registro per ciascun
sacramento, numerato da 1 **ogni anno** (nelle liste: `2026/12`).
- Nel modulo, lasciando vuoto *N. Registro* il numero viene assegnato in
  automatico; il campo mostra in anteprima quale sarà (*auto: 13*).
- Un numero scritto a mano viene accettato solo se non è già usato nello stesso
  registro (chiesa + anno); altrimenti l'app indica il primo numero libero.
- I numeri dei sacramenti già registrati (es. importati dall'archivio Access)
  non vengono toccati.
- I sacramenti senza chiesa formano il registro della parrocchia.
- Dopo un import, il pulsante 🔗 accanto a una chiesa collega a quella chiesa
  tutti i sacramenti che non ne hanno ancora una.

**Utenti di una sola chiesa** — in *Utenti*, campo *Accesso ai dati*: scegliendo
una chiesa, l'utente (segreteria, economo o lettura) vede e modifica **solo**
sacramenti, contabilità, eventi e controlli di quella chiesa. Non vede la
rubrica anime, le impostazioni, l'import e i modelli dei certificati. Gli
amministratori vedono sempre tutta la parrocchia.

**Contabilità** — ogni movimento appartiene alla **cassa della parrocchia** o
alla cassa di una chiesa (campo *Cassa*). La pagina mostra il riepilogo per
cassa con il totale della parrocchia; il filtro *Tutte le casse* e l'export
Excel lavorano anche su una sola cassa.

**Scadenziario** — ogni evento può essere di una chiesa o di tutta la
parrocchia; nel calendario c'è il filtro per chiesa.

**Certificati** — per i sacramenti celebrati in una chiesa che non è la
parrocchiale, l'intestazione riporta la chiesa (con *Parrocchia …* sotto), il
suo indirizzo e i suoi contatti; se è indicato il rettore, firma lui (*Il
Rettore*). I campi lasciati vuoti usano i dati della parrocchia. Nei modelli
dei certificati ci sono i segnaposti `{chiesa_nome}` e `{chiesa_indirizzo}`.

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
