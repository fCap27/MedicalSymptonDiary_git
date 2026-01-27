from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite
DATABASE_URL = "sqlite:///./medicalsymptomdiary.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# sessione db per api

def get_db():
    """Restituisce una sessione DB da usare nelle API."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
