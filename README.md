# ReChurch

Applicazione per la **gestione dei certificati ecclesiastici** di una parrocchia: battesimi, cresime e matrimoni. Permette di archiviare i registri, importare dati esistenti e generare certificati in PDF.

## Stack tecnologico

**Backend** — Python 3 + FastAPI
- FastAPI 0.111 + Uvicorn
- SQLAlchemy 2.0 + Alembic (SQLite di default)
- Pydantic 2
- ReportLab + Pillow (generazione PDF e gestione logo)

**Frontend** — React 18 + TypeScript
- Vite 5
- React Router 6
- TanStack Query 5
- React Hook Form + Zod
- Tailwind CSS 3
- Recharts (grafici dashboard)
- Lucide React (icone)

## Struttura del progetto

```
rechurch/
├── backend/
│   ├── app/
│   │   ├── main.py            # Entry point FastAPI
│   │   ├── database.py        # Setup SQLAlchemy
│   │   ├── models.py          # Modelli ORM (Battesimo, Cresima, Matrimonio, ParrocchiaConfig)
│   │   ├── schemas.py         # Schemi Pydantic
│   │   └── routers/
│   │       ├── battesimi.py   # CRUD battesimi
│   │       ├── cresime.py     # CRUD cresime
│   │       ├── matrimoni.py   # CRUD matrimoni
│   │       ├── config.py      # Configurazione parrocchia
│   │       ├── import_data.py # Import CSV / MDB
│   │       ├── pdf.py         # Generazione certificati PDF
│   │       └── stats.py       # Statistiche dashboard
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── api/client.ts      # Client HTTP
    │   ├── components/Layout.tsx
    │   └── pages/
    │       ├── Dashboard.tsx
    │       ├── ImportaDati.tsx
    │       ├── Impostazioni.tsx
    │       ├── battesimi/     # Lista + form
    │       ├── cresime/       # Lista + form
    │       └── matrimoni/     # Lista + form
    ├── package.json
    └── vite.config.ts
```

## Funzionalità

- **Gestione registri** — anagrafica completa per battesimi, cresime e matrimoni (anagrafica, ministri, padrini/madrine/testimoni, numero e anno di registro, note)
- **Dashboard** — statistiche aggregate e grafici sui sacramenti registrati
- **Generazione PDF** — certificati ecclesiastici stampabili con dati della parrocchia
- **Import CSV guidato** — caricamento massivo con template scaricabili e mappatura colonne
- **Configurazione parrocchia** — dati anagrafici, parroco, diocesi e logo

## Requisiti

- Python 3.10+
- Node.js 18+ e npm
- (Solo per import iniziale da Access) driver ODBC "Microsoft Access Driver (*.mdb, *.accdb)" 64-bit + `pyodbc`

## Avvio in locale

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # su Windows: copy .env.example .env

uvicorn app.main:app --reload
```

Il backend è disponibile su `http://localhost:8000`.
Documentazione automatica delle API: `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Il frontend è disponibile su `http://localhost:5173` e proxa le richieste `/api/*` verso il backend su `localhost:8000`.

## Variabili d'ambiente

File `backend/.env`:

```
DATABASE_URL=sqlite:///./rechurch.db
```

Per usare un altro database (PostgreSQL, MySQL…) basta sostituire la `DATABASE_URL` con la connection string corrispondente.

## Importazione dati

### Importazione guidata da CSV (dall'app)

Dalla pagina **Importa Dati** del frontend:

1. Si sceglie il tipo di registro (Battesimi / Cresime / Matrimoni)
2. Si scarica il **template CSV** di esempio (bottone "Scarica template")
3. Si compila il CSV mantenendo le intestazioni; i campi obbligatori sono evidenziati
4. Si carica il file: l'app mostra anteprima delle prime 10 righe e propone la mappatura automatica delle colonne
5. Si conferma l'importazione

Formato date accettato: `AAAA-MM-GG`, `GG/MM/AAAA`, `GG-MM-AAAA`, `AAAA/MM/GG`.
Encoding accettati: UTF-8 (anche con BOM) o Latin-1.

### Importazione iniziale dall'archivio Access (one-shot)

Il progetto include lo script `backend/import_accdb.py` per migrare i dati storici dal file `ARCHIVIO REGINA PACIS.accdb`. Lo script:

- legge la `Tabella1` e popola **battesimi** (dove `databattes` è valorizzato) e **cresime** (dove `datacresi` è valorizzato)
- legge la `Tabella per matrimonio` e popola **matrimoni**
- **ricrea da zero** le tabelle sacramentali nel SQLite (preserva `parrocchia_config`)

Prerequisiti: driver ODBC "Microsoft Access Driver (\*.mdb, \*.accdb)" 64-bit installato + `pip install pyodbc`.

```bash
cd backend
python import_accdb.py
# oppure indicando un percorso esplicito:
python import_accdb.py "C:/path/to/ARCHIVIO REGINA PACIS.accdb"
```

> Nota: lo schema del DB ha i campi `ministro` e `luogo_*` nullable per accogliere dati storici incompleti. Per i nuovi inserimenti dalla UI questi campi restano facoltativi.

## Distribuzione come app desktop

L'app può essere impacchettata come installer Windows `.exe`. Vedi [BUILD.md](BUILD.md) per istruzioni dettagliate.

```powershell
# Da root del progetto:
.\build.ps1
```

Output: `installer/Output/ReChurch-Setup-1.0.0.exe` — installer standalone ~80MB che:
- Installa l'app in `C:\Program Files\ReChurch\`
- Crea cartella dati in `C:\ReChurch\` (DB + uploads)
- Aggiunge shortcut su Desktop e menu Start
- Apre il browser sull'app al primo avvio

## Build di produzione

**Frontend**
```bash
cd frontend
npm run build
```
Output statico nella cartella `frontend/dist/`.

**Backend**
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Endpoint principali

| Metodo | Path | Descrizione |
|--------|------|-------------|
| GET    | `/health` | Health check |
| GET/POST | `/battesimi` | Lista / creazione battesimi |
| GET/POST | `/cresime` | Lista / creazione cresime |
| GET/POST | `/matrimoni` | Lista / creazione matrimoni |
| GET    | `/stats` | Statistiche aggregate |
| GET/PUT | `/config` | Configurazione parrocchia |
| GET    | `/import/template/{tipo}` | Scarica template CSV (battesimi / cresime / matrimoni) |
| GET    | `/import/fields/{tipo}` | Elenco campi attesi con flag di obbligatorietà |
| POST   | `/import/csv/{tipo}/preview` | Anteprima CSV (colonne + prime 10 righe) |
| POST   | `/import/csv/{tipo}` | Importa CSV con mappatura colonne |
| GET    | `/pdf/...` | Generazione certificati PDF |
| GET    | `/uploads/*` | File statici (logo parrocchia) |

## Licenza

Progetto privato.
