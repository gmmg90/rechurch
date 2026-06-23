from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, Date, DateTime, Text, ForeignKey, Numeric
from sqlalchemy.sql import func
from app.database import Base


class Utente(Base):
    __tablename__ = "utenti"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    cognome = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(500), nullable=False)
    ruolo = Column(String(50), nullable=False, default="lettura")  # admin/segreteria/economo/lettura
    attivo = Column(Boolean, default=True, nullable=False)
    ultimo_accesso = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ParrocchiaConfig(Base):
    __tablename__ = "parrocchia_config"

    id = Column(Integer, primary_key=True, default=1)
    nome = Column(String(200), nullable=False, default="Parrocchia")
    diocesi = Column(String(200), nullable=True)
    indirizzo = Column(String(300), nullable=True)
    cap = Column(String(10), nullable=True)
    citta = Column(String(100), nullable=True)
    provincia = Column(String(50), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    parroco = Column(String(200), nullable=True)
    logo_path = Column(String(500), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Battesimo(Base):
    __tablename__ = "battesimi"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    cognome = Column(String(100), nullable=False)
    data_nascita = Column(Date, nullable=True)
    luogo_nascita = Column(String(200), nullable=True)
    data_battesimo = Column(Date, nullable=False)
    luogo_battesimo = Column(String(200), nullable=False)
    padre_nome = Column(String(200), nullable=True)
    madre_nome = Column(String(200), nullable=True)
    padrino_nome = Column(String(200), nullable=True)
    madrina_nome = Column(String(200), nullable=True)
    ministro = Column(String(200), nullable=False)
    numero_registro = Column(String(50), nullable=True)
    anno_registro = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Cresima(Base):
    __tablename__ = "cresime"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    cognome = Column(String(100), nullable=False)
    data_nascita = Column(Date, nullable=True)
    luogo_nascita = Column(String(200), nullable=True)
    data_cresima = Column(Date, nullable=False)
    luogo_cresima = Column(String(200), nullable=False)
    padre_nome = Column(String(200), nullable=True)
    madre_nome = Column(String(200), nullable=True)
    padrino_nome = Column(String(200), nullable=True)
    madrina_nome = Column(String(200), nullable=True)
    ministro = Column(String(200), nullable=False)
    vescovo = Column(String(200), nullable=True)
    numero_registro = Column(String(50), nullable=True)
    anno_registro = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Matrimonio(Base):
    __tablename__ = "matrimoni"

    id = Column(Integer, primary_key=True, index=True)
    sposo_nome = Column(String(100), nullable=False)
    sposo_cognome = Column(String(100), nullable=False)
    sposa_nome = Column(String(100), nullable=False)
    sposa_cognome = Column(String(100), nullable=False)
    data_matrimonio = Column(Date, nullable=False)
    luogo_matrimonio = Column(String(200), nullable=False)
    testimone1_nome = Column(String(200), nullable=True)
    testimone2_nome = Column(String(200), nullable=True)
    ministro = Column(String(200), nullable=False)
    numero_registro = Column(String(50), nullable=True)
    anno_registro = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Famiglia(Base):
    __tablename__ = "famiglie"
    id = Column(Integer, primary_key=True, index=True)
    cognome = Column(String(100), nullable=False)
    indirizzo = Column(String(300), nullable=True)
    cap = Column(String(10), nullable=True)
    citta = Column(String(100), nullable=True)
    telefono = Column(String(50), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Persona(Base):
    __tablename__ = "persone"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    cognome = Column(String(100), nullable=False)
    sesso = Column(String(1), nullable=True)  # M/F
    data_nascita = Column(Date, nullable=True)
    luogo_nascita = Column(String(200), nullable=True)
    indirizzo = Column(String(300), nullable=True)
    cap = Column(String(10), nullable=True)
    citta = Column(String(100), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    famiglia_id = Column(Integer, ForeignKey("famiglie.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PersonaSacramento(Base):
    __tablename__ = "persona_sacramenti"
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("persone.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(20), nullable=False)  # battesimo | cresima | matrimonio
    sacramento_id = Column(Integer, nullable=False)
    ruolo = Column(String(20), nullable=True)  # sposo | sposa (only for matrimonio)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CategoriaContabile(Base):
    __tablename__ = "categorie_contabili"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    tipo = Column(String(10), nullable=False)  # 'entrata' | 'uscita'
    colore = Column(String(7), nullable=True)  # hex color e.g. '#3b82f6'
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Fornitore(Base):
    __tablename__ = "fornitori"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False)
    partita_iva = Column(String(20), nullable=True)
    indirizzo = Column(String(300), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MovimentoContabile(Base):
    __tablename__ = "movimenti_contabili"
    id = Column(Integer, primary_key=True, index=True)
    data = Column(Date, nullable=False)
    tipo = Column(String(10), nullable=False)  # 'entrata' | 'uscita'
    importo = Column(Numeric(12, 2), nullable=False)
    descrizione = Column(String(500), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorie_contabili.id"), nullable=True)
    fornitore_id = Column(Integer, ForeignKey("fornitori.id"), nullable=True)
    numero_documento = Column(String(50), nullable=True)
    metodo_pagamento = Column(String(50), nullable=True)  # contanti | bonifico | carta | assegno
    note = Column(Text, nullable=True)
    allegato_path = Column(String(500), nullable=True)
    allegato_nome = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CategoriaEvento(Base):
    __tablename__ = "categorie_eventi"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    colore = Column(String(7), nullable=False, default="#6366f1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Evento(Base):
    __tablename__ = "eventi"
    id = Column(Integer, primary_key=True, index=True)
    titolo = Column(String(200), nullable=False)
    descrizione = Column(Text, nullable=True)
    data_inizio = Column(DateTime(timezone=True), nullable=False)
    data_fine = Column(DateTime(timezone=True), nullable=True)
    tutto_il_giorno = Column(Boolean, default=False, nullable=False)
    luogo = Column(String(300), nullable=True)
    categoria_id = Column(Integer, ForeignKey("categorie_eventi.id"), nullable=True)
    ricorrenza = Column(String(20), nullable=True)  # None | 'giornaliera' | 'settimanale' | 'mensile' | 'annuale'
    ricorrenza_fine = Column(Date, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
