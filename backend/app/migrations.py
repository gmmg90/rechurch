"""Migrazioni leggere dello schema.

L'app crea le tabelle con ``Base.metadata.create_all``, che però non aggiunge le
colonne nuove alle tabelle già esistenti. Con più parrocchie, ognuna col proprio
database creato in momenti diversi, serve un passo idempotente che allinei ogni
DB al modello all'avvio: qui aggiungiamo le colonne mancanti (solo colonne
nullable o con default, quindi senza rischi per i dati esistenti) e i relativi
indici.

Funziona sia con SQLite sia con Postgres.
"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import Base

log = logging.getLogger("rechurch.migrations")


def _default_sql(col) -> str:
    """Clausola DEFAULT per colonne NOT NULL con default Python semplice."""
    default = getattr(col.default, "arg", None)
    if default is None or callable(default):
        return ""
    if isinstance(default, bool):
        # TRUE/FALSE valgono sia per Postgres sia per SQLite (>= 3.23)
        return f" DEFAULT {'TRUE' if default else 'FALSE'}"
    if isinstance(default, (int, float)):
        return f" DEFAULT {default}"
    return " DEFAULT '" + str(default).replace("'", "''") + "'"


def aggiungi_colonne_mancanti(engine: Engine) -> list[str]:
    """Aggiunge alle tabelle esistenti le colonne definite nei modelli ma assenti
    nel database. Restituisce l'elenco delle colonne aggiunte."""
    insp = inspect(engine)
    tabelle_db = set(insp.get_table_names())
    aggiunte: list[str] = []

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in tabelle_db:
                continue  # la crea create_all
            esistenti = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in esistenti:
                    continue
                default = _default_sql(col)
                if not col.nullable and not default:
                    log.warning(
                        "Colonna %s.%s NOT NULL senza default: va migrata a mano",
                        table.name, col.name,
                    )
                    continue
                tipo = col.type.compile(dialect=engine.dialect)
                null = "" if col.nullable else " NOT NULL"
                conn.execute(text(
                    f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {tipo}{default}{null}'
                ))
                if col.index:
                    conn.execute(text(
                        f'CREATE INDEX IF NOT EXISTS "ix_{table.name}_{col.name}" '
                        f'ON "{table.name}" ("{col.name}")'
                    ))
                aggiunte.append(f"{table.name}.{col.name}")

    for a in aggiunte:
        print(f"[migrazioni] Aggiunta colonna {a}")
    return aggiunte
