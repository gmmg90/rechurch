import csv
import io
from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter(prefix="/import", tags=["import"])


# ─── Field definitions ────────────────────────────────────────────────────────

BATTESIMO_FIELDS = [
    "nome", "cognome", "data_nascita", "luogo_nascita",
    "data_battesimo", "luogo_battesimo",
    "padre_nome", "madre_nome", "padrino_nome", "madrina_nome",
    "ministro", "numero_registro", "anno_registro", "note",
]

COMUNIONE_FIELDS = [
    "nome", "cognome", "data_nascita", "luogo_nascita",
    "data_comunione", "luogo_comunione",
    "padre_nome", "madre_nome",
    "ministro", "numero_registro", "anno_registro", "note",
]

CRESIMA_FIELDS = [
    "nome", "cognome", "data_nascita", "luogo_nascita",
    "data_cresima", "luogo_cresima",
    "padre_nome", "madre_nome", "padrino_nome", "madrina_nome",
    "ministro", "vescovo", "numero_registro", "anno_registro", "note",
]

MATRIMONIO_FIELDS = [
    "sposo_nome", "sposo_cognome", "sposo_luogo_nascita", "sposo_data_nascita",
    "sposa_nome", "sposa_cognome", "sposa_luogo_nascita", "sposa_data_nascita",
    "data_matrimonio", "luogo_matrimonio",
    "testimone1_nome", "testimone2_nome", "testimone3_nome", "testimone4_nome",
    "ministro", "numero_registro", "anno_registro", "note",
]

# Esempio per ciascun tipo (una riga d'esempio)
TEMPLATE_SAMPLES = {
    "battesimi": {
        "nome": "Mario",
        "cognome": "Rossi",
        "data_nascita": "2020-05-10",
        "luogo_nascita": "Gela",
        "data_battesimo": "2020-09-15",
        "luogo_battesimo": "Parrocchia Regina Pacis",
        "padre_nome": "Giuseppe Rossi",
        "madre_nome": "Anna Bianchi",
        "padrino_nome": "Luigi Verdi",
        "madrina_nome": "Maria Neri",
        "ministro": "Don Carlo Esposito",
        "numero_registro": "12/2020",
        "anno_registro": "2020",
        "note": "",
    },
    "comunioni": {
        "nome": "Anna",
        "cognome": "Bianchi",
        "data_nascita": "2014-03-22",
        "luogo_nascita": "Gela",
        "data_comunione": "2023-05-30",
        "luogo_comunione": "Parrocchia Regina Pacis",
        "padre_nome": "Paolo Bianchi",
        "madre_nome": "Giulia Romano",
        "ministro": "Don Carlo Esposito",
        "numero_registro": "7/2023",
        "anno_registro": "2023",
        "note": "",
    },
    "cresime": {
        "nome": "Anna",
        "cognome": "Bianchi",
        "data_nascita": "2008-03-22",
        "luogo_nascita": "Gela",
        "data_cresima": "2020-05-30",
        "luogo_cresima": "Parrocchia Regina Pacis",
        "padre_nome": "Paolo Bianchi",
        "madre_nome": "Giulia Romano",
        "padrino_nome": "Marco Greco",
        "madrina_nome": "Sara Conti",
        "ministro": "Don Carlo Esposito",
        "vescovo": "Mons. Antonio Galli",
        "numero_registro": "5/2020",
        "anno_registro": "2020",
        "note": "",
    },
    "matrimoni": {
        "sposo_nome": "Mario",
        "sposo_cognome": "Rossi",
        "sposa_nome": "Anna",
        "sposa_cognome": "Bianchi",
        "data_matrimonio": "2022-06-18",
        "luogo_matrimonio": "Parrocchia Regina Pacis",
        "testimone1_nome": "Luigi Verdi",
        "testimone2_nome": "Maria Neri",
        "testimone3_nome": "",
        "testimone4_nome": "",
        "ministro": "Don Carlo Esposito",
        "numero_registro": "3/2022",
        "anno_registro": "2022",
        "note": "",
    },
}

FIELDS_BY_TIPO = {
    "battesimi": BATTESIMO_FIELDS,
    "comunioni": COMUNIONE_FIELDS,
    "cresime": CRESIMA_FIELDS,
    "matrimoni": MATRIMONIO_FIELDS,
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

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
        "luogo_battesimo": g("luogo_battesimo") or None,
        "padre_nome": g("padre_nome") or None,
        "madre_nome": g("madre_nome") or None,
        "padrino_nome": g("padrino_nome") or None,
        "madrina_nome": g("madrina_nome") or None,
        "ministro": g("ministro") or None,
        "numero_registro": g("numero_registro") or None,
        "anno_registro": _parse_int(g("anno_registro")),
        "note": g("note") or None,
    }


def _row_to_comunione(row: Dict[str, str], mapping: Dict[str, str]) -> Dict[str, Any]:
    def g(key):
        col = mapping.get(key)
        return row.get(col, "").strip() if col else ""

    return {
        "nome": g("nome"),
        "cognome": g("cognome"),
        "data_nascita": _parse_date(g("data_nascita")),
        "luogo_nascita": g("luogo_nascita") or None,
        "data_comunione": _parse_date(g("data_comunione")),
        "luogo_comunione": g("luogo_comunione") or None,
        "padre_nome": g("padre_nome") or None,
        "madre_nome": g("madre_nome") or None,
        "ministro": g("ministro") or None,
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
        "luogo_cresima": g("luogo_cresima") or None,
        "padre_nome": g("padre_nome") or None,
        "madre_nome": g("madre_nome") or None,
        "padrino_nome": g("padrino_nome") or None,
        "madrina_nome": g("madrina_nome") or None,
        "ministro": g("ministro") or None,
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
        "sposo_luogo_nascita": g("sposo_luogo_nascita") or None,
        "sposo_data_nascita": _parse_date(g("sposo_data_nascita")),
        "sposa_nome": g("sposa_nome"),
        "sposa_cognome": g("sposa_cognome"),
        "sposa_luogo_nascita": g("sposa_luogo_nascita") or None,
        "sposa_data_nascita": _parse_date(g("sposa_data_nascita")),
        "data_matrimonio": _parse_date(g("data_matrimonio")),
        "luogo_matrimonio": g("luogo_matrimonio") or None,
        "luogo_matrimonio": g("luogo_matrimonio") or None,
        "testimone1_nome": g("testimone1_nome") or None,
        "testimone2_nome": g("testimone2_nome") or None,
        "testimone3_nome": g("testimone3_nome") or None,
        "testimone4_nome": g("testimone4_nome") or None,
        "ministro": g("ministro") or None,
        "numero_registro": g("numero_registro") or None,
        "anno_registro": _parse_int(g("anno_registro")),
        "note": g("note") or None,
    }


# ─── CSV Template ─────────────────────────────────────────────────────────────

@router.get("/template/{tipo}")
def download_template(tipo: str):
    """Restituisce un CSV di esempio con intestazioni e una riga d'esempio."""
    if tipo not in FIELDS_BY_TIPO:
        raise HTTPException(status_code=400, detail="tipo deve essere battesimi, cresime o matrimoni")

    fields = FIELDS_BY_TIPO[tipo]
    sample = TEMPLATE_SAMPLES[tipo]

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    writer.writerow({k: sample.get(k, "") for k in fields})

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="template_{tipo}.csv"',
        },
    )


@router.get("/fields/{tipo}")
def get_fields(tipo: str):
    """Restituisce l'elenco dei campi attesi per un tipo, con etichetta e obbligatorietà."""
    if tipo not in FIELDS_BY_TIPO:
        raise HTTPException(status_code=400, detail="tipo deve essere battesimi, cresime o matrimoni")

    required_by_tipo = {
        "battesimi": {"nome", "cognome", "data_battesimo"},
        "comunioni": {"nome", "cognome", "data_comunione"},
        "cresime": {"nome", "cognome", "data_cresima"},
        "matrimoni": {"sposo_nome", "sposo_cognome", "sposa_nome", "sposa_cognome", "data_matrimonio"},
    }
    required = required_by_tipo[tipo]

    return {
        "tipo": tipo,
        "fields": [
            {"name": f, "required": f in required}
            for f in FIELDS_BY_TIPO[tipo]
        ],
        "sample": TEMPLATE_SAMPLES[tipo],
    }


# ─── CSV Import ───────────────────────────────────────────────────────────────

@router.post("/csv/{tipo}")
async def import_csv(
    tipo: str,
    file: UploadFile = File(...),
    mapping: str = Form(...),  # JSON string of {field: csv_column}
    db: Session = Depends(get_db),
):
    import json

    if tipo not in ("battesimi", "comunioni", "cresime", "matrimoni"):
        raise HTTPException(status_code=400, detail="tipo deve essere battesimi, comunioni, cresime o matrimoni")

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
            elif tipo == "comunioni":
                data = _row_to_comunione(row, column_mapping)
                if not data["nome"] or not data["cognome"]:
                    errors.append(f"Riga {i + 2}: nome/cognome mancante")
                    continue
                if not data["data_comunione"]:
                    errors.append(f"Riga {i + 2}: data_comunione mancante o non valida")
                    continue
                db.add(models.Comunione(**data))
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


@router.get("/stats")
def import_stats(db: Session = Depends(get_db)):
    return {
        "battesimi": db.query(models.Battesimo).count(),
        "cresime": db.query(models.Cresima).count(),
        "matrimoni": db.query(models.Matrimonio).count(),
    }
