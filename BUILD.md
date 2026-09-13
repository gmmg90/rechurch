# Build dell'applicazione desktop ReChurch

Guida alla creazione dell'installer Windows `.exe` distribuibile.

## Architettura del pacchetto

```
ReChurch installato
├── C:\Program Files\ReChurch\     ← codice applicazione (read-only)
│   ├── ReChurch.exe                ← launcher
│   ├── _internal\                  ← Python + dipendenze (PyInstaller)
│   └── frontend_dist\              ← UI buildata (statici Vite)
│
└── C:\ReChurch\                    ← dati persistenti (read-write)
    ├── rechurch.db                 ← database SQLite
    ├── rechurch.db.bak             ← backup di sicurezza pre-restore
    └── uploads\                    ← logo parrocchia
```

L'eseguibile avvia un server FastAPI su `127.0.0.1:8765` e apre il browser sull'app.
Una finestra Tk piccola tiene vivo il processo; chiuderla termina il server.

## Prerequisiti per il build

- **Windows 10/11 x64**
- **Python 3.10+** con dipendenze:
  ```
  cd backend
  pip install -r requirements-dev.txt
  ```
- **Node.js 18+** (per `npm run build`)
- **Inno Setup 6** (per generare l'installer): https://jrsoftware.org/isdl.php

Opzionale: un file `backend/icon.ico` per l'icona dell'app (256x256 consigliato).

## Build completo

Dalla root del progetto:

```powershell
.\build.ps1
```

Lo script:
1. Compila il frontend (`npm run build`) → `frontend/dist/`
2. Esegue PyInstaller (`rechurch.spec`) → `backend/dist/ReChurch/`
3. Genera l'installer Inno Setup → `installer/Output/ReChurch-Setup-1.0.0.exe`

## Build manuale (passo passo)

### 1. Frontend

```powershell
cd frontend
npm install
npm run build
```

Output: `frontend/dist/`

### 2. Eseguibile

```powershell
cd backend
pyinstaller rechurch.spec --clean --noconfirm
```

Output: `backend/dist/ReChurch/ReChurch.exe`

Per testare prima di pacchettizzare:
```powershell
backend\dist\ReChurch\ReChurch.exe
```

### 3. Installer

```powershell
cd installer
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" rechurch.iss
```

Output: `installer/Output/ReChurch-Setup-1.0.0.exe`

## DB di seed (distribuire con dati pre-caricati)

Se vuoi che l'installer porti con sé i dati già presenti nel DB attuale (es.
l'archivio storico importato dal `.accdb`), genera un **DB di seed** prima di
buildare:

```powershell
cd backend
python make_seed.py
```

Questo crea `backend/rechurch_seed.db` partendo dal DB attualmente in uso
(`C:\ReChurch\rechurch.db` o quello dev). Il seed viene **automaticamente
incluso** nel prossimo build PyInstaller e copiato in `C:\ReChurch\rechurch.db`
al **primo avvio** sul dispositivo di destinazione (solo se il DB di
destinazione non esiste già — non sovrascrive mai dati esistenti).

Per distribuire un installer "vuoto" (senza dati), cancella semplicemente
`backend/rechurch_seed.db` prima di rieseguire `build.ps1`.

## Posizione dei dati

Per default in `C:\ReChurch\`. Per cambiare:

```powershell
$env:RECHURCH_DATA_DIR = "D:\Backup\ReChurch"
.\backend\dist\ReChurch\ReChurch.exe
```

## Aggiornare versione

1. Modifica `version` in `frontend/package.json`
2. Modifica `version="1.0.0"` in `backend/app/main.py` (FastAPI)
3. Modifica `MyAppVersion` in `installer/rechurch.iss`
4. Esegui `build.ps1`

## Testing rapido senza installer

```powershell
.\backend\dist\ReChurch\ReChurch.exe
```

Si apre la finestra di controllo + browser sull'app. La cartella `C:\ReChurch\`
viene creata automaticamente al primo avvio.

## Disinstallazione

Standard Windows (Pannello di controllo > App). L'uninstaller **non rimuove** la
cartella `C:\ReChurch\` per preservare i dati. Per rimuovere anche i dati,
decommentare la riga in `[UninstallDelete]` di `rechurch.iss`.

## Risoluzione problemi

**"Il modulo X non si trova" all'avvio dell'.exe** → aggiungere `X` a
`hiddenimports` in `rechurch.spec` e ricompilare.

**Antivirus blocca l'eseguibile** → comune con PyInstaller. Firmare l'.exe con
un certificato code-signing risolve. In alternativa, segnalare come falso
positivo al vendor antivirus.

**Backup fallisce** → verificare che `C:\ReChurch\` abbia permessi di scrittura.
L'installer Inno Setup lo configura per `users-modify`.

**Porta 8765 occupata** → il launcher cerca automaticamente una porta libera.
