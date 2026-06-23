from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UtenteResponse"

class UtenteBase(BaseModel):
    nome: str
    cognome: str
    email: str
    ruolo: str = "lettura"

class UtenteCreate(UtenteBase):
    password: str

class UtenteUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    email: Optional[str] = None
    ruolo: Optional[str] = None
    attivo: Optional[bool] = None

class CambiaPasswordRequest(BaseModel):
    password_attuale: str
    nuova_password: str

class UtenteResponse(UtenteBase):
    id: int
    attivo: bool
    ultimo_accesso: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# update forward ref
TokenResponse.model_rebuild()


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


# ─── Rubrica ──────────────────────────────────────────────────────────────────

class FamigliaBase(BaseModel):
    cognome: str
    indirizzo: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    telefono: Optional[str] = None
    note: Optional[str] = None

class FamigliaCreate(FamigliaBase):
    pass

class FamigliaUpdate(BaseModel):
    cognome: Optional[str] = None
    indirizzo: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    telefono: Optional[str] = None
    note: Optional[str] = None

class FamigliaResponse(FamigliaBase):
    id: int
    num_persone: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class PersonaBase(BaseModel):
    nome: str
    cognome: str
    sesso: Optional[str] = None
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    indirizzo: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    famiglia_id: Optional[int] = None
    note: Optional[str] = None

class PersonaCreate(PersonaBase):
    pass

class PersonaUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    sesso: Optional[str] = None
    data_nascita: Optional[date] = None
    luogo_nascita: Optional[str] = None
    indirizzo: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    famiglia_id: Optional[int] = None
    note: Optional[str] = None

class PersonaSacramentoLink(BaseModel):
    tipo: str  # battesimo | cresima | matrimonio
    sacramento_id: int
    ruolo: Optional[str] = None  # sposo | sposa

class PersonaResponse(PersonaBase):
    id: int
    famiglia_cognome: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class PersonaDetail(PersonaResponse):
    battesimo: Optional["BattesimoResponse"] = None
    cresima: Optional["CresimaResponse"] = None
    matrimonio: Optional["MatrimonioResponse"] = None
    ruolo_matrimonio: Optional[str] = None
