from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Date, Time, Boolean
from sqlalchemy.orm import relationship

from .database import Base
from datetime import datetime

# classe utenti

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)


    entries = relationship("SymptomEntry", back_populates="user", cascade="all, delete")
    snapshots = relationship("Snapshot", back_populates="user", cascade="all, delete")

# classe sintomi

class SymptomEntry(Base):
    __tablename__ = "symptom_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Integer, nullable=False)  
    timestamp = Column(DateTime, nullable=False)
    tags = Column(String(255), nullable=True)  

    user = relationship("User", back_populates="entries")


# classe appuntamenti

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    facility = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    time = Column(Time, nullable=False)
    proposed_date = Column(Date, nullable=True)
    proposed_time = Column(Time, nullable=True)
    status = Column(String, nullable=False, default="PENDING")

    pdf_filename = Column(String, nullable=False)
    pdf_base64 = Column(Text, nullable=False)

    user = relationship("User")
