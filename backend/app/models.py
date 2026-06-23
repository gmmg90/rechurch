from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, Date, DateTime, Text
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
