"""
Importatore per l'archivio Access di Regina Pacis (ARCHIVIO REGINA PACIS.accdb).

Legge il file con mdbtools (mdb-export, gia' presente nell'immagine Docker),
quindi funziona su Linux senza driver Microsoft.

Mappatura:
  Tabella1                -> persone (anagrafica: residenza, professione)
                             + battesimi  (databattes)
                             + comunioni  (datacomun)
                             + cresime    (datacresi)
  "Tabella per matrimonio" -> matrimoni (+ collegamento a sposo/sposa in anagrafica
                             quando Tabella1.datamatri e nome/cognome coincidono)

Incrementale: ogni record creato viene annotato nella tabella
`import_access_map` (tabella Access, codice, tipo -> id ReChurch).
Reimportando un file piu' recente si aggiungono solo le righe nuove e i
sacramenti nuovi di persone gia' importate. I record gia' importati NON vengono
sovrascritti: dopo l'import il registro "vero" e' ReChurch, e le correzioni
fatte nel programma restano. Le differenze trovate vengono solo segnalate.

Uso (dentro il container della parrocchia, da /app/backend):
  python import_accdb.py /tmp/archivio.accdb            # prova: non salva nulla
  python import_accdb.py /tmp/archivio.accdb --salva    # importa davvero
"""
import argparse
import csv
import io
import os
import subprocess
import sys
from datetime import date

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.database import engine, SessionLocal, Base  # noqa: E402
from app import models  # noqa: E402

T_PERSONE = "Tabella1"
T_MATRIMONI = "Tabella per matrimonio"
T_PROFESSIONI = "anagrafica professioni"

MAP_DDL = """
CREATE TABLE IF NOT EXISTS import_access_map (
    tabella   VARCHAR(100) NOT NULL,
    codice    VARCHAR(50)  NOT NULL,
    tipo      VARCHAR(20)  NOT NULL,
    record_id INTEGER      NOT NULL,
    importato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tabella, codice, tipo)
)
"""


# ---------------------------------------------------------------- lettura
def leggi_tabella(path: str, tabella: str) -> list[dict]:
    out = subprocess.run(
        ["mdb-export", "-D", "%Y-%m-%d", "-T", "%Y-%m-%d", path, tabella],
        check=True, capture_output=True,
    ).stdout.decode("utf-8")
    return list(csv.DictReader(io.StringIO(out)))


def s(v):
    if v is None:
        return None
    v = " ".join(str(v).split())  # spazi doppi/iniziali/finali
    return v or None


def d(v):
    v = s(v)
    if not v:
        return None
    try:
        return date.fromisoformat(v[:10])
    except ValueError:
        return None


def codice(v):
    v = s(v)
    if v is None:
        return None
    try:
        f = float(v)
        return str(int(f)) if f == int(f) else v
    except ValueError:
        return v


def n_int(v):
    try:
        i = int(float(v))
        return i or None
    except (TypeError, ValueError):
        return None


def numero_registro(volume, pagina, numero):
    parti = [f"{lab} {n}" for lab, n in (("vol.", n_int(volume)), ("pag.", n_int(pagina)), ("n.", n_int(numero))) if n]
    return " ".join(parti) or None


def chiave(nome, cognome):
    return ((cognome or "").upper(), (nome or "").upper())


# ---------------------------------------------------------------- import
class Importatore:
    def __init__(self, db, path):
        self.db = db
        self.path = path
        self.mappa = {}
        self.stat = {}
        self.avvisi = []

    def conta(self, k, n=1):
        self.stat[k] = self.stat.get(k, 0) + n

    def carica_mappa(self):
        self.db.execute(text(MAP_DDL))
        for tab, cod, tipo, rid in self.db.execute(
            text("SELECT tabella, codice, tipo, record_id FROM import_access_map")
        ):
            self.mappa[(tab, cod, tipo)] = rid

    def gia(self, tab, cod, tipo):
        return self.mappa.get((tab, cod, tipo))

    def segna(self, tab, cod, tipo, rid):
        self.db.execute(
            text("INSERT INTO import_access_map (tabella, codice, tipo, record_id) VALUES (:t,:c,:k,:r)"),
            {"t": tab, "c": cod, "k": tipo, "r": rid},
        )
        self.mappa[(tab, cod, tipo)] = rid

    def crea(self, obj, tab, cod, tipo):
        self.db.add(obj)
        self.db.flush()
        self.segna(tab, cod, tipo, obj.id)
        self.conta(f"{tipo}: nuovi")
        return obj.id

    def collega(self, persona_id, tipo, sac_id, ruolo=None):
        esiste = self.db.query(models.PersonaSacramento).filter_by(
            persona_id=persona_id, tipo=tipo).first()
        if esiste:
            return
        self.db.add(models.PersonaSacramento(
            persona_id=persona_id, tipo=tipo, sacramento_id=sac_id, ruolo=ruolo))
        self.conta(f"collegamenti {tipo}")

    def run(self):
        self.carica_mappa()
        professioni = {s(r["codice mestiere"]): s(r["professione"])
                       for r in leggi_tabella(self.path, T_PROFESSIONI)}
        persone = leggi_tabella(self.path, T_PERSONE)
        matrimoni = leggi_tabella(self.path, T_MATRIMONI)

        # persone per data di matrimonio, per collegare sposo/sposa
        per_matrimonio = {}

        for r in persone:
            cod = codice(r["codice utente"])
            nome, cognome = s(r["nome"]), s(r["cognome"])
            if cod is None or not nome or not cognome:
                self.conta("persone scartate (senza nome/cognome)")
                continue
            nascita, luogo_nascita = d(r["datanascita"]), s(r["natoa"])
            nreg = numero_registro(r["volume"], r["pagina"], r["numero"])
            note = s(r["note"])

            pid = self.gia(T_PERSONE, cod, "persona")
            if pid is None:
                prof = professioni.get(s(r["codice mestiere"]))
                note_p = "\n".join(x for x in (f"Professione: {prof}" if prof else None, note) if x) or None
                pid = self.crea(models.Persona(
                    nome=nome, cognome=cognome, data_nascita=nascita,
                    luogo_nascita=luogo_nascita, citta=s(r["residenza"]), note=note_p,
                ), T_PERSONE, cod, "persona")
            else:
                p = self.db.get(models.Persona, pid)
                if p and (p.nome != nome or p.cognome != cognome or p.data_nascita != nascita):
                    self.conta("persone gia' importate ma diverse nel file (non toccate)")
                    if len(self.avvisi) < 30:
                        self.avvisi.append(f"codice {cod}: ReChurch '{p.cognome} {p.nome}' vs file '{cognome} {nome}'")
                else:
                    self.conta("persona: gia' presenti")

            base = dict(nome=nome, cognome=cognome, data_nascita=nascita,
                        luogo_nascita=luogo_nascita, numero_registro=nreg, note=note)

            if d(r["databattes"]):
                dt = d(r["databattes"])
                sid = self.gia(T_PERSONE, cod, "battesimo")
                if sid is None:
                    sid = self.crea(models.Battesimo(
                        **base, data_battesimo=dt, luogo_battesimo="", ministro="",
                        padrino_nome=s(r["padrinomadrinabattesimo"]),
                        madrina_nome=s(r["padrinomadrinabattesimobis"]),
                        anno_registro=dt.year,
                    ), T_PERSONE, cod, "battesimo")
                else:
                    self.conta("battesimo: gia' presenti")
                self.collega(pid, "battesimo", sid)

            if d(r["datacomun"]):
                dt = d(r["datacomun"])
                if self.gia(T_PERSONE, cod, "comunione") is None:
                    self.crea(models.Comunione(
                        **base, data_comunione=dt, luogo_comunione=None, ministro=None,
                        anno_registro=dt.year,
                    ), T_PERSONE, cod, "comunione")
                else:
                    self.conta("comunione: gia' presenti")

            if d(r["datacresi"]):
                dt = d(r["datacresi"])
                sid = self.gia(T_PERSONE, cod, "cresima")
                if sid is None:
                    sid = self.crea(models.Cresima(
                        **base, data_cresima=dt, luogo_cresima="", ministro="",
                        padrino_nome=s(r["padrinomadrinacresima"]),
                        anno_registro=dt.year,
                    ), T_PERSONE, cod, "cresima")
                else:
                    self.conta("cresima: gia' presenti")
                self.collega(pid, "cresima", sid)

            if d(r["datamatri"]):
                per_matrimonio.setdefault((d(r["datamatri"]),) + chiave(nome, cognome), []).append(pid)

        for r in matrimoni:
            cod = codice(r["codice coppia"])
            nU, cU, nD, cD = s(r["nomeU"]), s(r["cognomeU"]), s(r["nomeD"]), s(r["cognomeD"])
            dt = d(r["data"])
            if cod is None or not (nU and cU and nD and cD and dt):
                self.conta("matrimoni scartati (dati mancanti)")
                continue
            mid = self.gia(T_MATRIMONI, cod, "matrimonio")
            if mid is None:
                mid = self.crea(models.Matrimonio(
                    sposo_nome=nU, sposo_cognome=cU, sposo_luogo_nascita=s(r["natoaU"]),
                    sposo_data_nascita=d(r["datanascitaU"]),
                    sposa_nome=nD, sposa_cognome=cD, sposa_luogo_nascita=s(r["nataaD"]),
                    sposa_data_nascita=d(r["datanascitaD"]),
                    data_matrimonio=dt, luogo_matrimonio="", ministro="",
                    testimone1_nome=s(r["testimone1"]), testimone2_nome=s(r["testimone2"]),
                    testimone3_nome=s(r["testimone3"]), testimone4_nome=s(r["testimone4"]),
                    numero_registro=s(r["numero"]), anno_registro=dt.year, note=s(r["note"]),
                ), T_MATRIMONI, cod, "matrimonio")
            else:
                self.conta("matrimonio: gia' presenti")
            for (n, c, ruolo) in ((nU, cU, "sposo"), (nD, cD, "sposa")):
                pids = per_matrimonio.get((dt,) + chiave(n, c), [])
                if len(pids) == 1:
                    self.collega(pids[0], "matrimonio", mid, ruolo)
                elif len(pids) > 1:
                    self.conta("sposi non collegati (omonimi)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("accdb")
    ap.add_argument("--salva", action="store_true", help="scrive davvero (senza: solo prova)")
    a = ap.parse_args()
    if not os.path.exists(a.accdb):
        sys.exit(f"File non trovato: {a.accdb}")

    print(f"Sorgente:     {a.accdb}")
    print(f"Destinazione: {engine.url}")
    print("Modalita':    " + ("IMPORTAZIONE" if a.salva else "PROVA (nessuna modifica)"))
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        imp = Importatore(db, a.accdb)
        imp.run()
        if a.salva:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print()
    for k in sorted(imp.stat):
        print(f"  {k:<58} {imp.stat[k]:>6}")
    for w in imp.avvisi:
        print("  ! " + w)
    print("\nFatto." if a.salva else "\nProva finita: nessun dato salvato.")


if __name__ == "__main__":
    main()
