import csv
import io
import os
import subprocess
import tempfile
import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/import", tags=["import"])

# In-memory store for uploaded MDB files pending confirmation
_mdb_sessions: Dict[str, str] = {}


def _parse_date(value: str) -> Optional[date]:
    if not value or value.strip() == "":
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            from datetime import datetime
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(value: str) -> Optional[int]:
    if not value or value.strip() == "":
        return None
    try:
        return int(value.strip())
    except ValueError:
        return None


def _row_to_battesimo(row: Dict[str, str], mapping: Dict[str, str]) -> Dict[str, Any]:
    def g(key):
        col = mapping.get(key)
        return row.get(col, "").strip() if col else ""

    return {
        "nome": g("nome"),
        "cognome": g("cognome"),
        "data_nascita": _parse_date(g("data_nascita")),
        "luogo_nascita": g("luogo_nascita") or None,
        "data_battesimo": _parse_date(g("data_battesimo")),
        "luogo_battesimo": g("luogo_battesimo") or "",
        "padre_nome": g("padre_nome") or None,
        "madre_nome": g("madre_nome") or None,
        "padrino_nome": g("padrino_nome") or None,
        "madrina_nome": g("madrina_nome") or None,
        "ministro": g("ministro") or "",
        "numero_registro": g("numero_registro") or None,
        "anno_registro": _parse_int(g("anno_registro")),
        "note": g("note") or None,
    }


def _row_to_cresima(row: Dict[str, str], mapping: Dict[str, str]) -> Dict[str, Any]:
    def g(key):
        col = mapping.get(key)
        return row.get(col, "").strip() if col else ""

    return {
        "nome": g("nome"),
        "cognome": g("cognome"),
        "data_nascita": _parse_date(g("data_nascita")),
        "luogo_nascita": g("luogo_nascita") or None,
        "data_cresima": _parse_date(g("data_cresima")),
        "luogo_cresima": g("luogo_cresima") or "",
        "padre_nome": g("padre_nome") or None,
        "madre_nome": g("madre_nome") or None,
        "padrino_nome": g("padrino_nome") or None,
        "madrina_nome": g("madrina_nome") or None,
        "ministro": g("ministro") or "",
        "vescovo": g("vescovo") or None,
        "numero_registro": g("numero_registro") or None,
        "anno_registro": _parse_int(g("anno_registro")),
        "note": g("note") or None,
    }


def _row_to_matrimonio(row: Dict[str, str], mapping: Dict[str, str]) -> Dict[str, Any]:
    def g(key):
        col = mapping.get(key)
        return row.get(col, "").strip() if col else ""

    return {
        "sposo_nome": g("sposo_nome"),
        "sposo_cognome": g("sposo_cognome"),
        "sposa_nome": g("sposa_nome"),
        "sposa_cognome": g("sposa_cognome"),
        "data_matrimonio": _parse_date(g("data_matrimonio")),
        "luogo_matrimonio": g("luogo_matrimonio") or "",
        "testimone1_nome": g("testimone1_nome") or None,
        "testimone2_nome": g("testimone2_nome") or None,
        "ministro": g("ministro") or "",
        "numero_registro": g("numero_registro") or None,
        "anno_registro": _parse_int(g("anno_registro")),
        "note": g("note") or None,
    }


# ─── CSV Import ───────────────────────────────────────────────────────────────

@router.post("/csv/{tipo}")
async def import_csv(
    tipo: str,
    file: UploadFile = File(...),
    mapping: str = Form(...),  # JSON string of {field: csv_column}
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    import json

    if tipo not in ("battesimi", "cresime", "matrimoni"):
        raise HTTPException(status_code=400, detail="tipo deve essere battesimi, cresime o matrimoni")

    try:
        column_mapping: Dict[str, str] = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="Il campo 'mapping' deve essere un JSON valido")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="Il file CSV è vuoto")

    inserted = 0
    errors = []

    for i, row in enumerate(rows):
        try:
            if tipo == "battesimi":
                data = _row_to_battesimo(row, column_mapping)
                if not data["nome"] or not data["cognome"]:
                    errors.append(f"Riga {i + 2}: nome/cognome mancante")
                    continue
                if not data["data_battesimo"]:
                    errors.append(f"Riga {i + 2}: data_battesimo mancante o non valida")
                    continue
                db.add(models.Battesimo(**data))
            elif tipo == "cresime":
                data = _row_to_cresima(row, column_mapping)
                if not data["nome"] or not data["cognome"]:
                    errors.append(f"Riga {i + 2}: nome/cognome mancante")
                    continue
                if not data["data_cresima"]:
                    errors.append(f"Riga {i + 2}: data_cresima mancante o non valida")
                    continue
                db.add(models.Cresima(**data))
            elif tipo == "matrimoni":
                data = _row_to_matrimonio(row, column_mapping)
                if not data["sposo_nome"] or not data["sposa_nome"]:
                    errors.append(f"Riga {i + 2}: sposo_nome/sposa_nome mancante")
                    continue
                if not data["data_matrimonio"]:
                    errors.append(f"Riga {i + 2}: data_matrimonio mancante o non valida")
                    continue
                db.add(models.Matrimonio(**data))
            inserted += 1
        except Exception as e:
            errors.append(f"Riga {i + 2}: {str(e)}")

    db.commit()

    return {
        "inserted": inserted,
        "errors": errors,
        "total_rows": len(rows),
    }


@router.post("/csv/{tipo}/preview")
async def preview_csv(
    tipo: str,
    file: UploadFile = File(...),
    _: models.Utente = Depends(get_current_user),
):
    """Return first 10 rows and column names of a CSV without importing."""
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    columns = reader.fieldnames or []
    preview = rows[:10]

    return {
        "columns": columns,
        "preview": preview,
        "total_rows": len(rows),
    }


# ─── MDB Import ───────────────────────────────────────────────────────────────

@router.post("/mdb")
async def upload_mdb(
    file: UploadFile = File(...),
    _: models.Utente = Depends(get_current_user),
):
    """Upload an MDB/ACCDB file, detect tables, return table names and sample columns."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nessun file ricevuto")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".mdb", ".accdb"):
        raise HTTPException(status_code=400, detail="Il file deve essere .mdb o .accdb")

    # Save to a temp file that persists (we'll track by session id)
    tmp_dir = tempfile.gettempdir()
    session_id = str(uuid.uuid4())
    tmp_path = os.path.join(tmp_dir, f"rechurch_{session_id}{ext}")

    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    # Get table list
    try:
        result = subprocess.run(
            ["mdb-tables", "-1", tmp_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            os.unlink(tmp_path)
            raise HTTPException(
                status_code=422,
                detail=f"Impossibile leggere il file MDB: {result.stderr.strip()}",
            )
        tables = [t.strip() for t in result.stdout.strip().splitlines() if t.strip()]
    except FileNotFoundError:
        os.unlink(tmp_path)
        raise HTTPException(
            status_code=500,
            detail="mdbtools non installato sul server. Installare con: apt install mdbtools",
        )

    if not tables:
        os.unlink(tmp_path)
        raise HTTPException(status_code=422, detail="Nessuna tabella trovata nel file MDB")

    # For each table get column headers (first row of mdb-export)
    table_info = []
    for table in tables:
        try:
            exp = subprocess.run(
                ["mdb-export", tmp_path, table],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if exp.returncode == 0 and exp.stdout.strip():
                reader = csv.reader(io.StringIO(exp.stdout))
                header = next(reader, [])
                sample_rows = []
                for _ in range(3):
                    row = next(reader, None)
                    if row:
                        sample_rows.append(row)
                table_info.append({
                    "name": table,
                    "columns": header,
                    "sample": sample_rows,
                })
            else:
                table_info.append({"name": table, "columns": [], "sample": []})
        except Exception:
            table_info.append({"name": table, "columns": [], "sample": []})

    # Store session
    _mdb_sessions[session_id] = tmp_path

    return {
        "session_id": session_id,
        "tables": table_info,
    }


@router.post("/mdb/confirm")
async def confirm_mdb_import(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    """
    payload: {
      session_id: str,
      mappings: [
        {
          table: str,           # MDB table name
          tipo: str,            # battesimi | cresime | matrimoni
          column_mapping: {...} # field -> csv_column
        }
      ]
    }
    """
    session_id = payload.get("session_id")
    mappings = payload.get("mappings", [])

    if not session_id or session_id not in _mdb_sessions:
        raise HTTPException(status_code=400, detail="Sessione MDB non trovata o scaduta")

    tmp_path = _mdb_sessions[session_id]
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="File MDB temporaneo non trovato")

    total_inserted = 0
    total_errors: List[str] = []

    for mapping_entry in mappings:
        table = mapping_entry.get("table")
        tipo = mapping_entry.get("tipo")
        column_mapping = mapping_entry.get("column_mapping", {})

        if tipo not in ("battesimi", "cresime", "matrimoni"):
            total_errors.append(f"Tabella '{table}': tipo non valido '{tipo}'")
            continue

        try:
            exp = subprocess.run(
                ["mdb-export", tmp_path, table],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if exp.returncode != 0:
                total_errors.append(f"Tabella '{table}': errore nell'esportazione")
                continue

            reader = csv.DictReader(io.StringIO(exp.stdout))
            rows = list(reader)
        except Exception as e:
            total_errors.append(f"Tabella '{table}': {str(e)}")
            continue

        for i, row in enumerate(rows):
            try:
                if tipo == "battesimi":
                    data = _row_to_battesimo(row, column_mapping)
                    if not data["nome"] or not data["data_battesimo"]:
                        continue
                    db.add(models.Battesimo(**data))
                elif tipo == "cresime":
                    data = _row_to_cresima(row, column_mapping)
                    if not data["nome"] or not data["data_cresima"]:
                        continue
                    db.add(models.Cresima(**data))
                elif tipo == "matrimoni":
                    data = _row_to_matrimonio(row, column_mapping)
                    if not data["sposo_nome"] or not data["data_matrimonio"]:
                        continue
                    db.add(models.Matrimonio(**data))
                total_inserted += 1
            except Exception as e:
                total_errors.append(f"Tabella '{table}' riga {i + 2}: {str(e)}")

    db.commit()

    # Cleanup
    try:
        os.unlink(tmp_path)
    except Exception:
        pass
    _mdb_sessions.pop(session_id, None)

    return {
        "inserted": total_inserted,
        "errors": total_errors,
    }


@router.get("/stats")
def import_stats(
    db: Session = Depends(get_db),
    _: models.Utente = Depends(get_current_user),
):
    return {
        "battesimi": db.query(models.Battesimo).count(),
        "cresime": db.query(models.Cresima).count(),
        "matrimoni": db.query(models.Matrimonio).count(),
    }
