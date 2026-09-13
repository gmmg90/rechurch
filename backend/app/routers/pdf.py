import os
from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import or_, extract

from app.database import get_db
from app import models
from app.templates_default import DEFAULT_TEMPLATES

router = APIRouter(prefix="/pdf", tags=["pdf"])

MESI = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
]

MESI_ABBR = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic",
]

BLU = colors.HexColor("#1e3a5f")
GRAY = colors.HexColor("#6b7280")


def _fmt(d) -> str:
    if not d:
        return "—"
    return f"{d.day} {MESI[d.month - 1]} {d.year}"


def _fmt_slash(d) -> str:
    """Formato gg/mm/aaaa per il template matrimonio classico."""
    if not d:
        return ""
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def _fmt_short(d) -> str:
    """Formato gg-mes-aa per la data di rilascio in fondo al certificato."""
    if not d:
        return ""
    return f"{d.day:02d}-{MESI_ABBR[d.month - 1]}-{str(d.year)[-2:]}"


def _styles():
    return {
        "nome": ParagraphStyle("NomeParrocchia", fontSize=15, fontName="Helvetica-Bold",
                               alignment=TA_CENTER, spaceAfter=3, textColor=BLU),
        "sub":  ParagraphStyle("Sub", fontSize=9, fontName="Helvetica",
                               alignment=TA_CENTER, spaceAfter=2, textColor=GRAY),
        "titolo": ParagraphStyle("Titolo", fontSize=13, fontName="Helvetica-Bold",
                                 alignment=TA_CENTER, spaceBefore=18, spaceAfter=12,
                                 textColor=BLU),
        "body":   ParagraphStyle("Body", fontSize=11, fontName="Helvetica",
                                 alignment=TA_JUSTIFY, spaceBefore=5, spaceAfter=5, leading=19),
        "note":   ParagraphStyle("Note", fontSize=10, fontName="Helvetica-Oblique",
                                 alignment=TA_LEFT, spaceBefore=8, textColor=GRAY),
        "small":  ParagraphStyle("Small", fontSize=8, fontName="Helvetica",
                                 alignment=TA_CENTER, textColor=GRAY),
        "sig_l":  ParagraphStyle("SigL", fontSize=10, fontName="Helvetica", alignment=TA_LEFT),
        "sig_r":  ParagraphStyle("SigR", fontSize=10, fontName="Helvetica", alignment=TA_CENTER),
    }


def _build_pdf(title: str, body_parts: list[str], config: models.ParrocchiaConfig,
               firma_label: str = "Il Parroco") -> BytesIO:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
    )
    s = _styles()
    story = []

    # ── Intestazione ──────────────────────────────────────────────────────────
    logo_ok = config.logo_path and os.path.exists(config.logo_path)
    header_text = []
    header_text.append(Paragraph(config.nome or "Parrocchia", s["nome"]))
    if config.diocesi:
        header_text.append(Paragraph(f"Diocesi di {config.diocesi}", s["sub"]))
    if config.indirizzo:
        header_text.append(Paragraph(config.indirizzo, s["sub"]))
    if config.citta:
        cap = f"{config.cap} " if config.cap else ""
        prov = f" ({config.provincia})" if config.provincia else ""
        header_text.append(Paragraph(f"{cap}{config.citta}{prov}", s["sub"]))
    if config.telefono or config.email:
        contacts = " | ".join(filter(None, [config.telefono, config.email]))
        header_text.append(Paragraph(contacts, s["sub"]))

    if logo_ok:
        img = Image(config.logo_path, width=2.2 * cm, height=2.2 * cm)
        tbl = Table([[img, header_text]], colWidths=[2.8 * cm, None])
        tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",  (1, 0), (1, 0),  "CENTER"),
        ]))
        story.append(tbl)
    else:
        story.extend(header_text)

    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=2, color=BLU))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BLU, spaceAfter=4))

    # ── Titolo ────────────────────────────────────────────────────────────────
    story.append(Paragraph(title, s["titolo"]))
    story.append(Spacer(1, 0.4 * cm))

    # ── Corpo ─────────────────────────────────────────────────────────────────
    for part in body_parts:
        story.append(Paragraph(part, s["body"]))

    story.append(Spacer(1, 1.5 * cm))

    # ── Firma ─────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    story.append(Spacer(1, 0.3 * cm))

    city = config.citta or "___________"
    oggi = _fmt(date.today())

    sig_rows = [
        [Paragraph(f"{city}, {oggi}", s["sig_l"]),
         Paragraph(firma_label, s["sig_r"])],
        ["",
         Paragraph("_______________________", s["sig_r"])],
    ]
    if config.parroco:
        sig_rows.append(["", Paragraph(f"<b>{config.parroco}</b>", s["sig_r"])])

    sig = Table(sig_rows, colWidths=["60%", "40%"])
    sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig)
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        "Documento rilasciato ad uso ecclesiastico/civile — non valido senza timbro e firma originale.",
        s["small"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf


def _get_config(db: Session) -> models.ParrocchiaConfig:
    config = db.query(models.ParrocchiaConfig).first()
    if not config:
        config = models.ParrocchiaConfig(id=1, nome="Parrocchia")
    return config


def _get_template(db: Session, tipo: str) -> dict:
    """Carica il template per il tipo, usando i default se non esiste nel DB."""
    obj = db.query(models.ReportTemplate).filter(models.ReportTemplate.tipo == tipo).first()
    if obj:
        return {
            "titolo": obj.titolo or DEFAULT_TEMPLATES[tipo]["titolo"],
            "intro": obj.intro or "",
            "body": obj.body or "",
            "chiusura": obj.chiusura or "",
            "firma_label": obj.firma_label or DEFAULT_TEMPLATES[tipo]["firma_label"],
        }
    return dict(DEFAULT_TEMPLATES[tipo])


class _SafeDict(dict):
    """Dict che ritorna '_______' per chiavi mancanti (segnaposto vuoto)."""
    def __missing__(self, key):
        return "_______"


def _build_context(record, config: models.ParrocchiaConfig, tipo: str) -> dict:
    """Costruisce il dizionario dei segnaposti per il rendering del template."""
    ctx = {
        "parrocchia_nome": config.nome or "_______",
        "parrocchia_citta": config.citta or "_______",
        "parroco": config.parroco or "_______",
        "oggi": _fmt(date.today()),
    }
    # Estrae tutti i campi del record, formattando le date
    for col in record.__table__.columns:
        name = col.name
        val = getattr(record, name, None)
        if val is None or val == "":
            ctx[name] = "_______"
        elif isinstance(val, date):
            ctx[name] = _fmt(val)
        else:
            ctx[name] = str(val)
    return ctx


def _render_template_pdf(record, config: models.ParrocchiaConfig, tipo: str) -> BytesIO:
    """Renderizza un certificato semplice (battesimo/comunione/cresima) leggendo
    il template dal DB e sostituendo i segnaposti."""
    tpl = _get_template(db_session_unused := None, tipo) if False else None  # noqa
    # Non posso passare db_session da qui: lo prendo dal record
    from sqlalchemy.orm import object_session
    db_session = object_session(record)
    if db_session is None:
        tpl = dict(DEFAULT_TEMPLATES[tipo])
    else:
        tpl = _get_template(db_session, tipo)

    ctx = _SafeDict(_build_context(record, config, tipo))

    titolo = tpl["titolo"].format_map(ctx) if tpl["titolo"] else DEFAULT_TEMPLATES[tipo]["titolo"]
    intro_text = tpl["intro"].format_map(ctx) if tpl["intro"] else ""
    body_text = tpl["body"].format_map(ctx) if tpl["body"] else ""
    chiusura_text = tpl["chiusura"].format_map(ctx) if tpl["chiusura"] else ""

    # Costruzione delle parti del body (split per paragrafo)
    body_parts = []
    if intro_text:
        body_parts.append(intro_text)
    for para in body_text.split("\n\n"):
        para = para.strip()
        if para:
            body_parts.append(para)
    if chiusura_text:
        body_parts.append(chiusura_text)

    return _build_pdf(titolo, body_parts, config, firma_label=tpl["firma_label"])


def _pdf_response(pdf: BytesIO, fname: str, inline: bool) -> StreamingResponse:
    """Restituisce il PDF inline (visualizza in browser) o attachment (scarica)."""
    disposition = "inline" if inline else "attachment"
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{fname}"'},
    )


# ── Battesimo ─────────────────────────────────────────────────────────────────

@router.get("/battesimo/{id}")
def pdf_battesimo(
    id: int,
    inline: bool = Query(False, description="Se true, visualizza nel browser; altrimenti scarica"),
    db: Session = Depends(get_db),
):
    r = db.query(models.Battesimo).filter(models.Battesimo.id == id).first()
    if not r:
        raise HTTPException(404, "Battesimo non trovato")
    cfg = _get_config(db)

    pdf = _render_template_pdf(r, cfg, "battesimi")
    fname = f"battesimo_{r.cognome}_{r.nome}_{id}.pdf"
    return _pdf_response(pdf, fname, inline)


# ── Comunione ─────────────────────────────────────────────────────────────────

@router.get("/comunione/{id}")
def pdf_comunione(
    id: int,
    inline: bool = Query(False),
    db: Session = Depends(get_db),
):
    r = db.query(models.Comunione).filter(models.Comunione.id == id).first()
    if not r:
        raise HTTPException(404, "Comunione non trovata")
    cfg = _get_config(db)

    pdf = _render_template_pdf(r, cfg, "comunioni")
    fname = f"comunione_{r.cognome}_{r.nome}_{id}.pdf"
    return _pdf_response(pdf, fname, inline)


# ── Cresima ───────────────────────────────────────────────────────────────────

@router.get("/cresima/{id}")
def pdf_cresima(
    id: int,
    inline: bool = Query(False),
    db: Session = Depends(get_db),
):
    r = db.query(models.Cresima).filter(models.Cresima.id == id).first()
    if not r:
        raise HTTPException(404, "Cresima non trovata")
    cfg = _get_config(db)

    pdf = _render_template_pdf(r, cfg, "cresime")
    fname = f"cresima_{r.cognome}_{r.nome}_{id}.pdf"
    return _pdf_response(pdf, fname, inline)


# ── Matrimonio ────────────────────────────────────────────────────────────────

def _build_pdf_matrimonio(r: models.Matrimonio, config: models.ParrocchiaConfig, tpl: dict | None = None) -> BytesIO:
    """Template classico per il certificato di matrimonio (stile registro parrocchiale)."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )

    styles = {
        "header_it": ParagraphStyle(
            "HeaderIt", fontSize=14, fontName="Times-Italic",
            alignment=TA_CENTER, leading=18, spaceAfter=2,
        ),
        "parrocchia": ParagraphStyle(
            "Parrocchia", fontSize=16, fontName="Times-Italic",
            alignment=TA_CENTER, leading=20, spaceAfter=6, spaceBefore=6,
        ),
        "title": ParagraphStyle(
            "Title", fontSize=18, fontName="Helvetica-Bold",
            alignment=TA_CENTER, leading=22, spaceAfter=6, spaceBefore=6,
        ),
        "parroco": ParagraphStyle(
            "Parroco", fontSize=12, fontName="Times-Italic",
            alignment=TA_CENTER, leading=18, spaceBefore=12, spaceAfter=4,
        ),
        "certifica": ParagraphStyle(
            "Certifica", fontSize=14, fontName="Helvetica-Bold",
            alignment=TA_CENTER, leading=18, spaceAfter=14,
        ),
        "body_it": ParagraphStyle(
            "BodyIt", fontSize=11, fontName="Times-Italic",
            alignment=TA_LEFT, leading=22, spaceAfter=4,
        ),
        "carta": ParagraphStyle(
            "Carta", fontSize=11, fontName="Times-Italic",
            alignment=TA_CENTER, leading=18, spaceBefore=30, spaceAfter=40,
        ),
        "firma_left": ParagraphStyle(
            "FirmaLeft", fontSize=11, fontName="Times-Italic",
            alignment=TA_LEFT, leading=14,
        ),
        "firma_right": ParagraphStyle(
            "FirmaRight", fontSize=11, fontName="Times-Italic",
            alignment=TA_CENTER, leading=14,
        ),
    }

    story = []

    # Usa il template fornito o quello di default
    if tpl is None:
        tpl = dict(DEFAULT_TEMPLATES["matrimoni"])

    ctx = _SafeDict({
        **{c.name: (_fmt_slash(getattr(r, c.name)) if isinstance(getattr(r, c.name, None), date)
                    else (str(getattr(r, c.name)) if getattr(r, c.name, None) is not None else "_______"))
           for c in r.__table__.columns},
        "parrocchia_nome": config.nome or "_______",
        "parrocchia_citta": config.citta or "_______",
        "parroco": config.parroco or "Parroco",
        "oggi": _fmt(date.today()),
    })

    # ── Intestazione: Diocesi e Comune ────────────────────────────────────────
    diocesi = f"Diocesi di {config.diocesi}" if config.diocesi else ""
    comune = f"Comune di {config.citta}" if config.citta else ""
    if diocesi or comune:
        head_tbl = Table(
            [[Paragraph(diocesi, styles["header_it"]), Paragraph(comune, styles["header_it"])]],
            colWidths=["50%", "50%"],
        )
        head_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        story.append(head_tbl)
        story.append(Spacer(1, 0.2 * cm))

    # Parrocchia
    story.append(Paragraph(f"Parrocchia {config.nome or ''}", styles["parrocchia"]))
    story.append(Spacer(1, 0.1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.black))

    # Titolo
    story.append(Spacer(1, 0.3 * cm))
    titolo_txt = (tpl.get("titolo") or "CERTIFICATO DI MATRIMONIO").format_map(ctx)
    story.append(Paragraph(titolo_txt, styles["title"]))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.black))
    story.append(Spacer(1, 0.4 * cm))

    # Parroco
    intro_txt = (tpl.get("intro") or "Il sottoscritto {parroco}").format_map(ctx)
    story.append(Paragraph(intro_txt, styles["parroco"]))
    story.append(Paragraph("CERTIFICA", styles["certifica"]))

    # Corpo: template con segnaposti
    body_txt = (tpl.get("body") or "").format_map(ctx)
    for para in body_txt.split("\n\n"):
        para = para.strip()
        if para:
            story.append(Paragraph(para, styles["body_it"]))

    # Sposi: tabellina a colonne
    sposo_natoa = r.sposo_luogo_nascita or "____________"
    sposo_nato_il = _fmt_slash(r.sposo_data_nascita) or "____________"
    sposa_nataa = r.sposa_luogo_nascita or "____________"
    sposa_nata_il = _fmt_slash(r.sposa_data_nascita) or "____________"

    persone_data = [
        [
            Paragraph("il Sig.", styles["body_it"]),
            Paragraph(f"<b>{(r.sposo_cognome or '').upper()}</b>", styles["body_it"]),
            Paragraph(f"<b>{(r.sposo_nome or '').upper()}</b>", styles["body_it"]),
        ],
        [
            Paragraph("nato a", styles["body_it"]),
            Paragraph(f"<b>{sposo_natoa.upper()}</b>", styles["body_it"]),
            Paragraph(f"il &nbsp;&nbsp;<b>{sposo_nato_il}</b>", styles["body_it"]),
        ],
        [
            Paragraph("e la Sig.ra", styles["body_it"]),
            Paragraph(f"<b>{(r.sposa_cognome or '').upper()}</b>", styles["body_it"]),
            Paragraph(f"<b>{(r.sposa_nome or '').upper()}</b>", styles["body_it"]),
        ],
        [
            Paragraph("nata a", styles["body_it"]),
            Paragraph(f"<b>{sposa_nataa.upper()}</b>", styles["body_it"]),
            Paragraph(f"il &nbsp;&nbsp;<b>{sposa_nata_il}</b>", styles["body_it"]),
        ],
    ]
    persone_tbl = Table(persone_data, colWidths=["18%", "42%", "40%"])
    persone_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(persone_tbl)
    story.append(Spacer(1, 0.4 * cm))

    # Testimoni
    testimoni = list(filter(None, [
        r.testimone1_nome, r.testimone2_nome, r.testimone3_nome, r.testimone4_nome,
    ]))
    if testimoni:
        first = testimoni[0]
        rest = testimoni[1:]
        rows = [[
            Paragraph("essendo testimoni:", styles["body_it"]),
            Paragraph(f"<b>{first.upper()}</b>", styles["body_it"]),
        ]]
        for t in rest:
            rows.append([
                Paragraph("", styles["body_it"]),
                Paragraph(f"<b>{t.upper()}</b>", styles["body_it"]),
            ])
        test_tbl = Table(rows, colWidths=["30%", "70%"])
        test_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(test_tbl)

    # Frase di chiusura
    chiusura_txt = (tpl.get("chiusura") or "Si rilascia il presente in carta libera per").format_map(ctx)
    if chiusura_txt:
        story.append(Paragraph(chiusura_txt, styles["carta"]))

    # Firma: città lì data + label firma personalizzabile
    citta = config.citta or "___________"
    oggi_short = _fmt_short(date.today())
    firma_label = tpl.get("firma_label") or "IL PARROCO"
    firma_tbl = Table(
        [[
            Paragraph(f"{citta}, lì {oggi_short}", styles["firma_left"]),
            Paragraph(f"<b>{firma_label}</b>", styles["firma_right"]),
        ]],
        colWidths=["60%", "40%"],
    )
    firma_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(firma_tbl)

    doc.build(story)
    buf.seek(0)
    return buf


@router.get("/matrimonio/{id}")
def pdf_matrimonio(
    id: int,
    inline: bool = Query(False),
    db: Session = Depends(get_db),
):
    r = db.query(models.Matrimonio).filter(models.Matrimonio.id == id).first()
    if not r:
        raise HTTPException(404, "Matrimonio non trovato")
    cfg = _get_config(db)

    tpl = _get_template(db, "matrimoni")
    pdf = _build_pdf_matrimonio(r, cfg, tpl)
    fname = f"matrimonio_{r.sposo_cognome}_{r.sposa_cognome}_{id}.pdf"
    return _pdf_response(pdf, fname, inline)


# ── Anteprima template (record di esempio) ───────────────────────────────────

@router.get("/preview/{tipo}")
def pdf_preview_template(
    tipo: str,
    inline: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Genera un'anteprima del template con un record d'esempio (per il report builder)."""
    if tipo not in ("battesimi", "comunioni", "cresime", "matrimoni"):
        raise HTTPException(400, "Tipo non valido")
    cfg = _get_config(db)
    today = date.today()

    if tipo == "battesimi":
        sample = models.Battesimo(
            id=0, nome="Mario", cognome="Rossi",
            data_nascita=date(2020, 5, 10), luogo_nascita="Gela",
            data_battesimo=date(2020, 9, 15), luogo_battesimo="Parrocchia Regina Pacis",
            padre_nome="Giuseppe Rossi", madre_nome="Anna Bianchi",
            padrino_nome="Luigi Verdi", madrina_nome="Maria Neri",
            ministro="Don Carlo Esposito",
            numero_registro="12", anno_registro=2020, note="",
        )
        pdf = _render_template_pdf_with_session(sample, cfg, tipo, db)
    elif tipo == "comunioni":
        sample = models.Comunione(
            id=0, nome="Anna", cognome="Bianchi",
            data_nascita=date(2014, 3, 22), luogo_nascita="Gela",
            data_comunione=date(2023, 5, 30), luogo_comunione="Parrocchia Regina Pacis",
            padre_nome="Paolo Bianchi", madre_nome="Giulia Romano",
            ministro="Don Carlo Esposito",
            numero_registro="7", anno_registro=2023, note="",
        )
        pdf = _render_template_pdf_with_session(sample, cfg, tipo, db)
    elif tipo == "cresime":
        sample = models.Cresima(
            id=0, nome="Anna", cognome="Bianchi",
            data_nascita=date(2008, 3, 22), luogo_nascita="Gela",
            data_cresima=date(2020, 5, 30), luogo_cresima="Parrocchia Regina Pacis",
            padre_nome="Paolo Bianchi", madre_nome="Giulia Romano",
            padrino_nome="Marco Greco", madrina_nome="Sara Conti",
            ministro="Don Carlo Esposito", vescovo="Mons. Antonio Galli",
            numero_registro="5", anno_registro=2020, note="",
        )
        pdf = _render_template_pdf_with_session(sample, cfg, tipo, db)
    else:  # matrimoni
        sample = models.Matrimonio(
            id=0,
            sposo_nome="Mario", sposo_cognome="Rossi",
            sposo_luogo_nascita="Gela", sposo_data_nascita=date(1990, 5, 10),
            sposa_nome="Anna", sposa_cognome="Bianchi",
            sposa_luogo_nascita="Vittoria", sposa_data_nascita=date(1992, 8, 22),
            data_matrimonio=date(2022, 6, 18), luogo_matrimonio="Parrocchia Regina Pacis",
            testimone1_nome="Luigi Verdi", testimone2_nome="Maria Neri",
            testimone3_nome=None, testimone4_nome=None,
            ministro="Don Carlo Esposito",
            numero_registro="3/2022", anno_registro=2022, note="",
        )
        tpl = _get_template(db, "matrimoni")
        pdf = _build_pdf_matrimonio(sample, cfg, tpl)

    fname = f"anteprima_{tipo}.pdf"
    return _pdf_response(pdf, fname, inline)


def _render_template_pdf_with_session(record, config, tipo, db):
    """Versione di _render_template_pdf che riceve la session esplicitamente
    (per i record non-detached come quelli di esempio)."""
    tpl = _get_template(db, tipo)
    ctx = _SafeDict(_build_context(record, config, tipo))

    titolo = tpl["titolo"].format_map(ctx) if tpl["titolo"] else DEFAULT_TEMPLATES[tipo]["titolo"]
    intro_text = tpl["intro"].format_map(ctx) if tpl["intro"] else ""
    body_text = tpl["body"].format_map(ctx) if tpl["body"] else ""
    chiusura_text = tpl["chiusura"].format_map(ctx) if tpl["chiusura"] else ""

    body_parts = []
    if intro_text:
        body_parts.append(intro_text)
    for para in body_text.split("\n\n"):
        para = para.strip()
        if para:
            body_parts.append(para)
    if chiusura_text:
        body_parts.append(chiusura_text)

    return _build_pdf(titolo, body_parts, config, firma_label=tpl["firma_label"])


# ── Stampa elenco filtrato ────────────────────────────────────────────────────

def _fmt_d(d) -> str:
    return f"{d.day:02d}-{d.month:02d}-{d.year}" if d else ""


# Configurazione per ogni tipo: (model, titolo_pdf, data_col, [(header, lambda r → str), ...])
_ELENCO_CONFIG = {
    "battesimi": {
        "model_attr": "Battesimo",
        "data_col_attr": "data_battesimo",
        "luogo_col_attr": "luogo_battesimo",
        "ministro_col_attr": "ministro",
        "title": "Elenco Battesimi",
        "search_fields": ["nome", "cognome", "ministro", "luogo_battesimo"],
        "columns": [
            ("Cognome", lambda r: r.cognome),
            ("Nome", lambda r: r.nome),
            ("Data battesimo", lambda r: _fmt_d(r.data_battesimo)),
            ("Luogo", lambda r: r.luogo_battesimo or "—"),
            ("Ministro", lambda r: r.ministro or "—"),
            ("N. Reg.", lambda r: r.numero_registro or "—"),
        ],
    },
    "comunioni": {
        "model_attr": "Comunione",
        "data_col_attr": "data_comunione",
        "luogo_col_attr": "luogo_comunione",
        "ministro_col_attr": "ministro",
        "title": "Elenco Prime Comunioni",
        "search_fields": ["nome", "cognome", "ministro", "luogo_comunione"],
        "columns": [
            ("Cognome", lambda r: r.cognome),
            ("Nome", lambda r: r.nome),
            ("Data comunione", lambda r: _fmt_d(r.data_comunione)),
            ("Luogo", lambda r: r.luogo_comunione or "—"),
            ("Ministro", lambda r: r.ministro or "—"),
            ("N. Reg.", lambda r: r.numero_registro or "—"),
        ],
    },
    "cresime": {
        "model_attr": "Cresima",
        "data_col_attr": "data_cresima",
        "luogo_col_attr": "luogo_cresima",
        "ministro_col_attr": "ministro",
        "title": "Elenco Cresime",
        "search_fields": ["nome", "cognome", "ministro", "luogo_cresima"],
        "columns": [
            ("Cognome", lambda r: r.cognome),
            ("Nome", lambda r: r.nome),
            ("Data cresima", lambda r: _fmt_d(r.data_cresima)),
            ("Luogo", lambda r: r.luogo_cresima or "—"),
            ("Vescovo", lambda r: r.vescovo or "—"),
            ("N. Reg.", lambda r: r.numero_registro or "—"),
        ],
    },
    "matrimoni": {
        "model_attr": "Matrimonio",
        "data_col_attr": "data_matrimonio",
        "luogo_col_attr": "luogo_matrimonio",
        "ministro_col_attr": "ministro",
        "title": "Elenco Matrimoni",
        "search_fields": ["sposo_nome", "sposo_cognome", "sposa_nome", "sposa_cognome", "ministro", "luogo_matrimonio"],
        "columns": [
            ("Sposo", lambda r: f"{r.sposo_cognome} {r.sposo_nome}"),
            ("Sposa", lambda r: f"{r.sposa_cognome} {r.sposa_nome}"),
            ("Data", lambda r: _fmt_d(r.data_matrimonio)),
            ("Luogo", lambda r: r.luogo_matrimonio or "—"),
            ("N. Reg.", lambda r: r.numero_registro or "—"),
        ],
    },
}


def _build_pdf_elenco(items, tipo: str, search: str, anno: int | None, config: models.ParrocchiaConfig) -> BytesIO:
    cfg_t = _ELENCO_CONFIG[tipo]
    columns = cfg_t["columns"]
    title = cfg_t["title"]

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )

    s = _styles()
    story = []

    # Intestazione: parrocchia
    parr = config.nome or "Parrocchia"
    story.append(Paragraph(parr, s["nome"]))
    if config.citta:
        story.append(Paragraph(config.citta, s["sub"]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=BLU))

    # Titolo + filtri
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(title, s["titolo"]))

    filtri_parts = []
    if search:
        filtri_parts.append(f"Ricerca: <b>{search}</b>")
    if anno:
        filtri_parts.append(f"Anno: <b>{anno}</b>")
    filtri_parts.append(f"Totale: <b>{len(items)}</b> record")
    story.append(Paragraph(" — ".join(filtri_parts), ParagraphStyle(
        "Filtri", fontSize=9, fontName="Helvetica-Oblique",
        alignment=TA_CENTER, textColor=GRAY, spaceAfter=10,
    )))

    # Tabella
    if not items:
        story.append(Paragraph("Nessun record corrispondente ai filtri.",
                               ParagraphStyle("Empty", fontSize=11, alignment=TA_CENTER,
                                              textColor=GRAY, spaceBefore=20)))
    else:
        header = [c[0] for c in columns]
        rows = [header]
        for r in items:
            rows.append([c[1](r) for c in columns])

        tbl = Table(rows, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BLU),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ("LINEBELOW", (0, 0), (-1, 0), 1, BLU),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(tbl)

    # Footer
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        f"Documento generato il {_fmt(date.today())}",
        ParagraphStyle("Footer", fontSize=8, fontName="Helvetica-Oblique",
                       alignment=TA_RIGHT, textColor=GRAY),
    ))

    doc.build(story)
    buf.seek(0)
    return buf


@router.get("/elenco/{tipo}")
def pdf_elenco(
    tipo: str,
    search: str = Query("", description="Ricerca testuale"),
    anno: int | None = Query(None, description="Filtra per anno"),
    inline: bool = Query(False),
    db: Session = Depends(get_db),
):
    if tipo not in _ELENCO_CONFIG:
        raise HTTPException(400, "Tipo non valido")

    cfg_t = _ELENCO_CONFIG[tipo]
    Model = getattr(models, cfg_t["model_attr"])
    data_col = getattr(Model, cfg_t["data_col_attr"])

    q = db.query(Model)
    if search:
        term = f"%{search}%"
        conditions = [getattr(Model, f).ilike(term) for f in cfg_t["search_fields"]]
        q = q.filter(or_(*conditions))
    if anno:
        q = q.filter(extract("year", data_col) == anno)

    items = q.order_by(data_col.desc()).all()

    config = _get_config(db)
    pdf = _build_pdf_elenco(items, tipo, search, anno, config)
    fname = f"elenco_{tipo}.pdf"
    return _pdf_response(pdf, fname, inline)
