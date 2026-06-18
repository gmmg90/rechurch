import os
from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.database import get_db
from app import models

router = APIRouter(prefix="/pdf", tags=["pdf"])

MESI = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
]

BLU = colors.HexColor("#1e3a5f")
GRAY = colors.HexColor("#6b7280")


def _fmt(d) -> str:
    if not d:
        return "—"
    return f"{d.day} {MESI[d.month - 1]} {d.year}"


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


def _build_pdf(title: str, body_parts: list[str], config: models.ParrocchiaConfig) -> BytesIO:
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
         Paragraph("Il Parroco", s["sig_r"])],
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


# ── Battesimo ─────────────────────────────────────────────────────────────────

@router.get("/battesimo/{id}")
def pdf_battesimo(id: int, db: Session = Depends(get_db)):
    r = db.query(models.Battesimo).filter(models.Battesimo.id == id).first()
    if not r:
        raise HTTPException(404, "Battesimo non trovato")
    cfg = _get_config(db)

    body = []
    intro = f"Il sottoscritto Parroco della {cfg.nome or 'Parrocchia'}"
    if cfg.citta:
        intro += f" in <b>{cfg.citta}</b>"
    intro += " certifica che:"
    body.append(intro)

    soggetto = f"<b>{r.nome} {r.cognome}</b>"
    if r.data_nascita:
        soggetto += f", nato/a il <b>{_fmt(r.data_nascita)}</b>"
    if r.luogo_nascita:
        soggetto += f" a <b>{r.luogo_nascita}</b>"
    genitori = list(filter(None, [r.padre_nome, r.madre_nome]))
    if genitori:
        soggetto += ", figlio/a di " + " e di ".join(f"<b>{g}</b>" for g in genitori)
    soggetto += ","
    body.append(soggetto)

    rito = f"è stato/a <b>BATTEZZATO/A</b> il giorno <b>{_fmt(r.data_battesimo)}</b>"
    if r.luogo_battesimo:
        rito += f" presso <b>{r.luogo_battesimo}</b>"
    rito += "."
    body.append(rito)

    padrini = list(filter(None, [
        f"Padrino: <b>{r.padrino_nome}</b>" if r.padrino_nome else None,
        f"Madrina: <b>{r.madrina_nome}</b>" if r.madrina_nome else None,
    ]))
    if padrini:
        body.append(" — ".join(padrini) + ".")

    if r.ministro:
        body.append(f"Il sacramento è stato amministrato da <b>{r.ministro}</b>.")

    if r.numero_registro or r.anno_registro:
        reg = "Il presente atto è trascritto nel <b>Registro dei Battesimi</b>"
        if r.numero_registro:
            reg += f" al n. <b>{r.numero_registro}</b>"
        if r.anno_registro:
            reg += f" dell'anno <b>{r.anno_registro}</b>"
        reg += "."
        body.append(reg)

    if r.note:
        body.append(f"Note: {r.note}")

    pdf = _build_pdf("CERTIFICATO DI BATTESIMO", body, cfg)
    fname = f"battesimo_{r.cognome}_{r.nome}_{id}.pdf"
    return StreamingResponse(pdf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ── Cresima ───────────────────────────────────────────────────────────────────

@router.get("/cresima/{id}")
def pdf_cresima(id: int, db: Session = Depends(get_db)):
    r = db.query(models.Cresima).filter(models.Cresima.id == id).first()
    if not r:
        raise HTTPException(404, "Cresima non trovata")
    cfg = _get_config(db)

    body = []
    intro = f"Il sottoscritto Parroco della {cfg.nome or 'Parrocchia'}"
    if cfg.citta:
        intro += f" in <b>{cfg.citta}</b>"
    intro += " certifica che:"
    body.append(intro)

    soggetto = f"<b>{r.nome} {r.cognome}</b>"
    if r.data_nascita:
        soggetto += f", nato/a il <b>{_fmt(r.data_nascita)}</b>"
    if r.luogo_nascita:
        soggetto += f" a <b>{r.luogo_nascita}</b>"
    genitori = list(filter(None, [r.padre_nome, r.madre_nome]))
    if genitori:
        soggetto += ", figlio/a di " + " e di ".join(f"<b>{g}</b>" for g in genitori)
    soggetto += ","
    body.append(soggetto)

    rito = f"ha ricevuto il sacramento della <b>CRESIMA</b> il giorno <b>{_fmt(r.data_cresima)}</b>"
    if r.luogo_cresima:
        rito += f" presso <b>{r.luogo_cresima}</b>"
    rito += "."
    body.append(rito)

    if r.vescovo:
        body.append(f"Il sacramento è stato conferito da S.E. il Vescovo <b>{r.vescovo}</b>.")
    elif r.ministro:
        body.append(f"Il sacramento è stato conferito da <b>{r.ministro}</b>.")

    padrini = list(filter(None, [
        f"Padrino: <b>{r.padrino_nome}</b>" if r.padrino_nome else None,
        f"Madrina: <b>{r.madrina_nome}</b>" if r.madrina_nome else None,
    ]))
    if padrini:
        body.append(" — ".join(padrini) + ".")

    if r.numero_registro or r.anno_registro:
        reg = "Il presente atto è trascritto nel <b>Registro delle Cresime</b>"
        if r.numero_registro:
            reg += f" al n. <b>{r.numero_registro}</b>"
        if r.anno_registro:
            reg += f" dell'anno <b>{r.anno_registro}</b>"
        reg += "."
        body.append(reg)

    if r.note:
        body.append(f"Note: {r.note}")

    pdf = _build_pdf("CERTIFICATO DI CRESIMA", body, cfg)
    fname = f"cresima_{r.cognome}_{r.nome}_{id}.pdf"
    return StreamingResponse(pdf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ── Matrimonio ────────────────────────────────────────────────────────────────

@router.get("/matrimonio/{id}")
def pdf_matrimonio(id: int, db: Session = Depends(get_db)):
    r = db.query(models.Matrimonio).filter(models.Matrimonio.id == id).first()
    if not r:
        raise HTTPException(404, "Matrimonio non trovato")
    cfg = _get_config(db)

    body = []
    intro = f"Il sottoscritto Parroco della {cfg.nome or 'Parrocchia'}"
    if cfg.citta:
        intro += f" in <b>{cfg.citta}</b>"
    intro += " certifica che:"
    body.append(intro)

    rito = (
        f"<b>{r.sposo_nome} {r.sposo_cognome}</b> e "
        f"<b>{r.sposa_nome} {r.sposa_cognome}</b> "
        f"hanno celebrato il sacramento del <b>MATRIMONIO</b> "
        f"il giorno <b>{_fmt(r.data_matrimonio)}</b>"
    )
    if r.luogo_matrimonio:
        rito += f" presso <b>{r.luogo_matrimonio}</b>"
    rito += "."
    body.append(rito)

    testimoni = list(filter(None, [r.testimone1_nome, r.testimone2_nome]))
    if testimoni:
        body.append("Testimoni: " + " e ".join(f"<b>{t}</b>" for t in testimoni) + ".")

    if r.ministro:
        body.append(f"Il sacramento è stato celebrato da <b>{r.ministro}</b>.")

    if r.numero_registro or r.anno_registro:
        reg = "Il presente atto è trascritto nel <b>Registro dei Matrimoni</b>"
        if r.numero_registro:
            reg += f" al n. <b>{r.numero_registro}</b>"
        if r.anno_registro:
            reg += f" dell'anno <b>{r.anno_registro}</b>"
        reg += "."
        body.append(reg)

    if r.note:
        body.append(f"Note: {r.note}")

    pdf = _build_pdf("CERTIFICATO DI MATRIMONIO", body, cfg)
    fname = f"matrimonio_{r.sposo_cognome}_{r.sposa_cognome}_{id}.pdf"
    return StreamingResponse(pdf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})
