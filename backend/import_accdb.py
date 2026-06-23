"""
Importatore one-shot per il file ARCHIVIO REGINA PACIS.accdb.

Mappatura:
  - Tabella1  -> battesimi  (dove databattes IS NOT NULL)
  - Tabella1  -> comunioni  (dove datacomun IS NOT NULL)
  - Tabella1  -> cresime    (dove datacresi  IS NOT NULL)
  - "Tabella per matrimonio" -> matrimoni

Eseguire da backend/:  python import_accdb.py [percorso_accdb]
Per default cerca ../ARCHIVIO REGINA PACIS.accdb
"""
import os
import sys
from datetime import datetime

import pyodbc

# Carica modelli SQLAlchemy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.database import engine, SessionLocal, Base
from app import models


def get_accdb_path() -> str:
    if len(sys.argv) > 1:
        return sys.argv[1]
    default = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ARCHIVIO REGINA PACIS.accdb")
    )
    return default


def connect_accdb(path: str) -> pyodbc.Connection:
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={path};"
    )
    return pyodbc.connect(conn_str)


def clean_str(value):
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def to_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def fmt_it(value) -> str | None:
    """Formato gg-mm-aaaa per le note."""
    d = to_date(value)
    if d is None:
        return None
    return f"{d.day:02d}-{d.month:02d}-{d.year}"


def build_numero_registro(volume, pagina, numero) -> str | None:
    parts = []
    for label, v in (("vol.", volume), ("pag.", pagina), ("n.", numero)):
        if v is None:
            continue
        try:
            v_int = int(v)
            if v_int == 0:
                continue
            parts.append(f"{label} {v_int}")
        except (TypeError, ValueError):
            continue
    return " ".join(parts) if parts else None


def reset_tables():
    """Drop and recreate solo le tabelle sacramentali, preservando parrocchia_config."""
    print("Ricreo tabelle battesimi/comunioni/cresime/matrimoni...")
    models.Battesimo.__table__.drop(bind=engine, checkfirst=True)
    models.Comunione.__table__.drop(bind=engine, checkfirst=True)
    models.Cresima.__table__.drop(bind=engine, checkfirst=True)
    models.Matrimonio.__table__.drop(bind=engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)


def import_battesimi_cresime(accdb_conn, db_session):
    cur = accdb_conn.cursor()
    cur.execute(
        "SELECT [codice utente], cognome, nome, natoa, datanascita, "
        "databattes, datacomun, datacresi, volume, pagina, numero, note, "
        "padrinomadrinabattesimo, padrinomadrinacresima, padrinomadrinabattesimobis "
        "FROM Tabella1"
    )

    batt_count = 0
    com_count = 0
    cres_count = 0
    skipped = 0

    for row in cur.fetchall():
        (
            codice, cognome, nome, natoa, datanascita,
            databattes, datacomun, datacresi, volume, pagina, numero, note,
            pm_batt, pm_cres, pm_batt_bis,
        ) = row

        nome = clean_str(nome)
        cognome = clean_str(cognome)
        if not nome or not cognome:
            skipped += 1
            continue

        numero_reg = build_numero_registro(volume, pagina, numero)
        note_clean = clean_str(note)

        if databattes is not None:
            data_b = to_date(databattes)
            db_session.add(models.Battesimo(
                nome=nome,
                cognome=cognome,
                data_nascita=to_date(datanascita),
                luogo_nascita=clean_str(natoa),
                data_battesimo=data_b,
                luogo_battesimo=None,
                padre_nome=None,
                madre_nome=None,
                padrino_nome=clean_str(pm_batt),
                madrina_nome=clean_str(pm_batt_bis),
                ministro=None,
                numero_registro=numero_reg,
                anno_registro=data_b.year if data_b else None,
                note=note_clean,
            ))
            batt_count += 1

        if datacomun is not None:
            data_co = to_date(datacomun)
            db_session.add(models.Comunione(
                nome=nome,
                cognome=cognome,
                data_nascita=to_date(datanascita),
                luogo_nascita=clean_str(natoa),
                data_comunione=data_co,
                luogo_comunione=None,
                padre_nome=None,
                madre_nome=None,
                ministro=None,
                numero_registro=numero_reg,
                anno_registro=data_co.year if data_co else None,
                note=note_clean,
            ))
            com_count += 1

        if datacresi is not None:
            data_c = to_date(datacresi)
            db_session.add(models.Cresima(
                nome=nome,
                cognome=cognome,
                data_nascita=to_date(datanascita),
                luogo_nascita=clean_str(natoa),
                data_cresima=data_c,
                luogo_cresima=None,
                padre_nome=None,
                madre_nome=None,
                padrino_nome=clean_str(pm_cres),
                madrina_nome=None,
                ministro=None,
                vescovo=None,
                numero_registro=numero_reg,
                anno_registro=data_c.year if data_c else None,
                note=note_clean,
            ))
            cres_count += 1

    db_session.commit()
    print(f"  Battesimi inseriti: {batt_count}")
    print(f"  Comunioni inserite: {com_count}")
    print(f"  Cresime inserite:   {cres_count}")
    print(f"  Righe scartate (no nome/cognome): {skipped}")


def import_matrimoni(accdb_conn, db_session):
    cur = accdb_conn.cursor()
    cur.execute(
        "SELECT [codice coppia], cognomeU, nomeU, cognomeD, nomeD, numero, data, "
        "natoaU, nataaD, datanascitaU, datanascitaD, "
        "testimone1, testimone2, testimone3, testimone4, note "
        "FROM [Tabella per matrimonio]"
    )

    inserted = 0
    skipped = 0

    for row in cur.fetchall():
        (
            codice, cognomeU, nomeU, cognomeD, nomeD, numero, data,
            natoaU, nataaD, datanascitaU, datanascitaD,
            test1, test2, test3, test4, note,
        ) = row

        nomeU = clean_str(nomeU)
        cognomeU = clean_str(cognomeU)
        nomeD = clean_str(nomeD)
        cognomeD = clean_str(cognomeD)
        data_m = to_date(data)

        if not (nomeU and cognomeU and nomeD and cognomeD and data_m):
            skipped += 1
            continue

        db_session.add(models.Matrimonio(
            sposo_nome=nomeU,
            sposo_cognome=cognomeU,
            sposo_luogo_nascita=clean_str(natoaU),
            sposo_data_nascita=to_date(datanascitaU),
            sposa_nome=nomeD,
            sposa_cognome=cognomeD,
            sposa_luogo_nascita=clean_str(nataaD),
            sposa_data_nascita=to_date(datanascitaD),
            data_matrimonio=data_m,
            luogo_matrimonio=None,
            testimone1_nome=clean_str(test1),
            testimone2_nome=clean_str(test2),
            testimone3_nome=clean_str(test3),
            testimone4_nome=clean_str(test4),
            ministro=None,
            numero_registro=clean_str(numero),
            anno_registro=data_m.year,
            note=clean_str(note),
        ))
        inserted += 1

    db_session.commit()
    print(f"  Matrimoni inseriti: {inserted}")
    print(f"  Righe scartate:     {skipped}")


def main():
    path = get_accdb_path()
    if not os.path.exists(path):
        print(f"ERRORE: file non trovato: {path}")
        sys.exit(1)

    print(f"Sorgente: {path}")
    print(f"Destinazione: {engine.url}")
    print()

    reset_tables()

    accdb = connect_accdb(path)
    db = SessionLocal()
    try:
        print("\n[Tabella1 -> battesimi + cresime]")
        import_battesimi_cresime(accdb, db)
        print("\n[Tabella per matrimonio -> matrimoni]")
        import_matrimoni(accdb, db)
    finally:
        db.close()
        accdb.close()

    print("\nImportazione completata.")


if __name__ == "__main__":
    main()
