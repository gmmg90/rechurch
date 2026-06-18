from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


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
