from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.templates_default import DEFAULT_TEMPLATES, PLACEHOLDERS

router = APIRouter(prefix="/report-templates", tags=["report-templates"])

VALID_TIPI = ("battesimi", "comunioni", "cresime", "matrimoni")


def _get_or_create(db: Session, tipo: str) -> models.ReportTemplate:
    """Carica il template dal DB, o lo crea con i default se assente."""
    if tipo not in VALID_TIPI:
        raise HTTPException(400, f"Tipo non valido. Validi: {', '.join(VALID_TIPI)}")
    obj = db.query(models.ReportTemplate).filter(models.ReportTemplate.tipo == tipo).first()
    if not obj:
        defaults = DEFAULT_TEMPLATES[tipo]
        obj = models.ReportTemplate(
            tipo=tipo,
            titolo=defaults["titolo"],
            intro=defaults["intro"],
            body=defaults["body"],
            chiusura=defaults["chiusura"],
            firma_label=defaults["firma_label"],
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


@router.get("")
@router.get("/")
def list_templates(db: Session = Depends(get_db)):
    """Restituisce tutti i template (inizializzandoli se assenti)."""
    return [_get_or_create(db, t) for t in VALID_TIPI]


@router.get("/{tipo}", response_model=schemas.ReportTemplateResponse)
def get_template(tipo: str, db: Session = Depends(get_db)):
    return _get_or_create(db, tipo)


@router.put("/{tipo}", response_model=schemas.ReportTemplateResponse)
def update_template(tipo: str, data: schemas.ReportTemplateUpdate, db: Session = Depends(get_db)):
    obj = _get_or_create(db, tipo)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{tipo}/reset", response_model=schemas.ReportTemplateResponse)
def reset_template(tipo: str, db: Session = Depends(get_db)):
    """Ripristina il template ai valori di default."""
    if tipo not in VALID_TIPI:
        raise HTTPException(400, "Tipo non valido")
    obj = db.query(models.ReportTemplate).filter(models.ReportTemplate.tipo == tipo).first()
    defaults = DEFAULT_TEMPLATES[tipo]
    if obj:
        obj.titolo = defaults["titolo"]
        obj.intro = defaults["intro"]
        obj.body = defaults["body"]
        obj.chiusura = defaults["chiusura"]
        obj.firma_label = defaults["firma_label"]
    else:
        obj = models.ReportTemplate(tipo=tipo, **defaults)
        db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{tipo}/placeholders")
def get_placeholders(tipo: str):
    """Elenco segnaposti disponibili per il tipo, con etichette leggibili."""
    if tipo not in VALID_TIPI:
        raise HTTPException(400, "Tipo non valido")
    return {
        "tipo": tipo,
        "placeholders": [{"key": k, "label": l} for k, l in PLACEHOLDERS[tipo]],
    }
