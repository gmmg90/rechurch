from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


# ─── Battesimo ────────────────────────────────────────────────────────────────

class BattesimoBase(BaseModel):
    nome: str
    cognome: str
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    data_battesimo: date
    luogo_battesimo: str
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    padrino_nome: Optional[str] = None
    madrina_nome: Optional[str] = None
    ministro: str
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
    luogo_cresima: str
    padre_nome: Optional[str] = None
    madre_nome: Optional[str] = None
    padrino_nome: Optional[str] = None
    madrina_nome: Optional[str] = None
    ministro: str
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


# ─── Matrimonio ───────────────────────────────────────────────────────────────

class MatrimonioBase(BaseModel):
    sposo_nome: str
    sposo_cognome: str
    sposa_nome: str
    sposa_cognome: str
    data_matrimonio: date
    luogo_matrimonio: str
    testimone1_nome: Optional[str] = None
    testimone2_nome: Optional[str] = None
    ministro: str
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class MatrimonioCreate(MatrimonioBase):
    pass


class MatrimonioUpdate(BaseModel):
    sposo_nome: Optional[str] = None
    sposo_cognome: Optional[str] = None
    sposa_nome: Optional[str] = None
    sposa_cognome: Optional[str] = None
    data_matrimonio: Optional[date] = None
    luogo_matrimonio: Optional[str] = None
    testimone1_nome: Optional[str] = None
    testimone2_nome: Optional[str] = None
    ministro: Optional[str] = None
    numero_registro: Optional[str] = None
    anno_registro: Optional[int] = None
    note: Optional[str] = None


class MatrimonioResponse(MatrimonioBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
