from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


# ─── ReportTemplate ───────────────────────────────────────────────────────────

class ReportTemplateUpdate(BaseModel):
    titolo: Optional[str] = None
    intro: Optional[str] = None
    body: Optional[str] = None
    chiusura: Optional[str] = None
    firma_label: Optional[str] = None


class ReportTemplateResponse(BaseModel):
    tipo: str
    titolo: Optional[str] = None
    intro: Optional[str] = None
    body: Optional[str] = None
    chiusura: Optional[str] = None
    firma_label: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── ParrocchiaConfig ─────────────────────────────────────────────────────────

class ParrocchiaConfigUpdate(BaseModel):
    nome: Optional[str] = None
    diocesi: Optional[str] = None
    indirizzo: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    provincia: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    parroco: Optional[str] = None


class ParrocchiaConfigResponse(BaseModel):
    id: int
    nome: str
    diocesi: Optional[str] = None
    indirizzo: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    provincia: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    parroco: Optional[str] = None
    logo_path: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Battesimo ────────────────────────────────────────────────────────────────

class BattesimoBase(BaseModel):
    nome: str
    cognome: str
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_battesimo: date
    luogo_battesimo: Optional[str] = None
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    padrino_nome: Optional[str] = None
    madrina_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class BattesimoCreate(BattesimoBase):
    pass


class BattesimoUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_battesimo: Optional[date] = None
    luogo_battesimo: Optional[str] = None
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    padrino_nome: Optional[str] = None
    madrina_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class BattesimoResponse(BattesimoBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Cresima ──────────────────────────────────────────────────────────────────

class CresimaBase(BaseModel):
    nome: str
    cognome: str
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_cresima: date
    luogo_cresima: Optional[str] = None
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    padrino_nome: Optional[str] = None
    madrina_nome: Optional[str] = None
    ministro: Optional[str] = None
    vescovo: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class CresimaCreate(CresimaBase):
    pass


class CresimaUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_cresima: Optional[date] = None
    luogo_cresima: Optional[str] = None
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    padrino_nome: Optional[str] = None
    madrina_nome: Optional[str] = None
    ministro: Optional[str] = None
    vescovo: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class CresimaResponse(CresimaBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Comunione ────────────────────────────────────────────────────────────────

class ComunioneBase(BaseModel):
    nome: str
    cognome: str
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_comunione: date
    luogo_comunione: Optional[str] = None
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class ComunioneCreate(ComunioneBase):
    pass


class ComunioneUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_comunione: Optional[date] = None
    luogo_comunione: Optional[str] = None
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class ComunioneResponse(ComunioneBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Matrimonio ───────────────────────────────────────────────────────────────

class MatrimonioBase(BaseModel):
    sposo_nome: str
    sposo_cognome: str
    sposo_luogo_nascita: Optional[str] = None
    sposo_data_nascita: Optional[date] = None
    sposa_nome: str
    sposa_cognome: str
    sposa_luogo_nascita: Optional[str] = None
    sposa_data_nascita: Optional[date] = None
    data_matrimonio: date
    luogo_matrimonio: Optional[str] = None
    testimone1_nome: Optional[str] = None
    testimone2_nome: Optional[str] = None
    testimone3_nome: Optional[str] = None
    testimone4_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class MatrimonioCreate(MatrimonioBase):
    pass


class MatrimonioUpdate(BaseModel):
    sposo_nome: Optional[str] = None
    sposo_cognome: Optional[str] = None
    sposo_luogo_nascita: Optional[str] = None
    sposo_data_nascita: Optional[date] = None
    sposa_nome: Optional[str] = None
    sposa_cognome: Optional[str] = None
    sposa_luogo_nascita: Optional[str] = None
    sposa_data_nascita: Optional[date] = None
    data_matrimonio: Optional[date] = None
    luogo_matrimonio: Optional[str] = None
    testimone1_nome: Optional[str] = None
    testimone2_nome: Optional[str] = None
    testimone3_nome: Optional[str] = None
    testimone4_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class MatrimonioResponse(MatrimonioBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
