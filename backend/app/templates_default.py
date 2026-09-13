"""
Template di default per i certificati. Ogni sezione è una stringa Python con
segnaposti tipo {nome}, {cognome}, etc. I segnaposti sono risolti al momento
della generazione del PDF; segnaposti mancanti o vuoti vengono sostituiti con
"_______" (o lasciati vuoti se la frase intera dipende da quel valore).

I tag HTML supportati (gestiti da ReportLab Paragraph):
  <b>…</b>  grassetto
  <i>…</i>  corsivo
  <br/>     interruzione di riga

Usare \n\n nel body per separare i paragrafi.
"""

DEFAULT_TEMPLATES = {
    "battesimi": {
        "titolo": "CERTIFICATO DI BATTESIMO",
        "intro": "Il sottoscritto Parroco della <b>{parrocchia_nome}</b> in <b>{parrocchia_citta}</b> certifica che:",
        "body": (
            "<b>{nome} {cognome}</b>, nato/a il <b>{data_nascita}</b> a <b>{luogo_nascita}</b>, "
            "figlio/a di <b>{padre_nome}</b> e di <b>{madre_nome}</b>,\n\n"
            "è stato/a <b>BATTEZZATO/A</b> il giorno <b>{data_battesimo}</b> "
            "presso <b>{luogo_battesimo}</b>.\n\n"
            "Padrino: <b>{padrino_nome}</b> — Madrina: <b>{madrina_nome}</b>.\n\n"
            "Il sacramento è stato amministrato da <b>{ministro}</b>.\n\n"
            "Il presente atto è trascritto nel <b>Registro dei Battesimi</b> "
            "al n. <b>{numero_registro}</b> dell'anno <b>{anno_registro}</b>."
        ),
        "chiusura": "",
        "firma_label": "Il Parroco",
    },
    "comunioni": {
        "titolo": "CERTIFICATO DI PRIMA COMUNIONE",
        "intro": "Il sottoscritto Parroco della <b>{parrocchia_nome}</b> in <b>{parrocchia_citta}</b> certifica che:",
        "body": (
            "<b>{nome} {cognome}</b>, nato/a il <b>{data_nascita}</b> a <b>{luogo_nascita}</b>, "
            "figlio/a di <b>{padre_nome}</b> e di <b>{madre_nome}</b>,\n\n"
            "ha ricevuto la <b>PRIMA COMUNIONE</b> il giorno <b>{data_comunione}</b> "
            "presso <b>{luogo_comunione}</b>.\n\n"
            "Il sacramento è stato amministrato da <b>{ministro}</b>.\n\n"
            "Il presente atto è trascritto nel <b>Registro delle Prime Comunioni</b> "
            "al n. <b>{numero_registro}</b> dell'anno <b>{anno_registro}</b>."
        ),
        "chiusura": "",
        "firma_label": "Il Parroco",
    },
    "cresime": {
        "titolo": "CERTIFICATO DI CRESIMA",
        "intro": "Il sottoscritto Parroco della <b>{parrocchia_nome}</b> in <b>{parrocchia_citta}</b> certifica che:",
        "body": (
            "<b>{nome} {cognome}</b>, nato/a il <b>{data_nascita}</b> a <b>{luogo_nascita}</b>, "
            "figlio/a di <b>{padre_nome}</b> e di <b>{madre_nome}</b>,\n\n"
            "ha ricevuto il sacramento della <b>CRESIMA</b> il giorno <b>{data_cresima}</b> "
            "presso <b>{luogo_cresima}</b>.\n\n"
            "Il sacramento è stato conferito da S.E. il Vescovo <b>{vescovo}</b>.\n\n"
            "Padrino/Madrina: <b>{padrino_nome}</b>.\n\n"
            "Il presente atto è trascritto nel <b>Registro delle Cresime</b> "
            "al n. <b>{numero_registro}</b> dell'anno <b>{anno_registro}</b>."
        ),
        "chiusura": "",
        "firma_label": "Il Parroco",
    },
    "matrimoni": {
        "titolo": "CERTIFICATO DI MATRIMONIO",
        "intro": "Il sottoscritto {parroco}",
        "body": (
            "risultare dai registri degli atti di <b>MATRIMONIO</b> di questa Parrocchia, "
            "al numero d'ordine <b>{numero_registro}</b> che in data <b>{data_matrimonio}</b> "
            "contrassero matrimonio religioso"
        ),
        "chiusura": "Si rilascia il presente in carta libera per",
        "firma_label": "IL PARROCO",
    },
}


# Elenco segnaposti disponibili per tipo (per la UI)
PLACEHOLDERS = {
    "battesimi": [
        ("nome", "Nome"),
        ("cognome", "Cognome"),
        ("data_nascita", "Data di nascita"),
        ("luogo_nascita", "Luogo di nascita"),
        ("data_battesimo", "Data del battesimo"),
        ("luogo_battesimo", "Luogo del battesimo"),
        ("padre_nome", "Nome padre"),
        ("madre_nome", "Nome madre"),
        ("padrino_nome", "Padrino"),
        ("madrina_nome", "Madrina"),
        ("ministro", "Ministro"),
        ("numero_registro", "N° registro"),
        ("anno_registro", "Anno registro"),
        ("note", "Note"),
        ("parrocchia_nome", "Nome parrocchia"),
        ("parrocchia_citta", "Città parrocchia"),
        ("parroco", "Parroco"),
        ("oggi", "Data corrente"),
    ],
    "comunioni": [
        ("nome", "Nome"),
        ("cognome", "Cognome"),
        ("data_nascita", "Data di nascita"),
        ("luogo_nascita", "Luogo di nascita"),
        ("data_comunione", "Data della comunione"),
        ("luogo_comunione", "Luogo della comunione"),
        ("padre_nome", "Nome padre"),
        ("madre_nome", "Nome madre"),
        ("ministro", "Ministro"),
        ("numero_registro", "N° registro"),
        ("anno_registro", "Anno registro"),
        ("note", "Note"),
        ("parrocchia_nome", "Nome parrocchia"),
        ("parrocchia_citta", "Città parrocchia"),
        ("parroco", "Parroco"),
        ("oggi", "Data corrente"),
    ],
    "cresime": [
        ("nome", "Nome"),
        ("cognome", "Cognome"),
        ("data_nascita", "Data di nascita"),
        ("luogo_nascita", "Luogo di nascita"),
        ("data_cresima", "Data della cresima"),
        ("luogo_cresima", "Luogo della cresima"),
        ("padre_nome", "Nome padre"),
        ("madre_nome", "Nome madre"),
        ("padrino_nome", "Padrino/Madrina"),
        ("ministro", "Ministro"),
        ("vescovo", "Vescovo"),
        ("numero_registro", "N° registro"),
        ("anno_registro", "Anno registro"),
        ("note", "Note"),
        ("parrocchia_nome", "Nome parrocchia"),
        ("parrocchia_citta", "Città parrocchia"),
        ("parroco", "Parroco"),
        ("oggi", "Data corrente"),
    ],
    "matrimoni": [
        ("sposo_nome", "Nome sposo"),
        ("sposo_cognome", "Cognome sposo"),
        ("sposo_luogo_nascita", "Luogo nascita sposo"),
        ("sposo_data_nascita", "Data nascita sposo"),
        ("sposa_nome", "Nome sposa"),
        ("sposa_cognome", "Cognome sposa"),
        ("sposa_luogo_nascita", "Luogo nascita sposa"),
        ("sposa_data_nascita", "Data nascita sposa"),
        ("data_matrimonio", "Data matrimonio"),
        ("luogo_matrimonio", "Luogo matrimonio"),
        ("testimone1_nome", "Testimone 1"),
        ("testimone2_nome", "Testimone 2"),
        ("testimone3_nome", "Testimone 3"),
        ("testimone4_nome", "Testimone 4"),
        ("ministro", "Ministro"),
        ("numero_registro", "N° registro"),
        ("anno_registro", "Anno registro"),
        ("note", "Note"),
        ("parrocchia_nome", "Nome parrocchia"),
        ("parrocchia_citta", "Città parrocchia"),
        ("parroco", "Parroco"),
        ("oggi", "Data corrente"),
    ],
}
