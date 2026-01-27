from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from app.admin_deps import require_admin

router = APIRouter(prefix="/api/entries", tags=["entries"])

# utente, inserisce sintomo

@router.post("", response_model=schemas.SymptomEntryOut)
def Inserisci_Sintomo(
    entry_in: schemas.SymptomEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = models.SymptomEntry(
        user_id=current_user.id,
        title=entry_in.title,
        description=entry_in.description,
        severity=entry_in.severity,
        timestamp=entry_in.timestamp,
        tags=entry_in.tags,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

# Utente, visualizza i suoi sinotmi

@router.get("", response_model=List[schemas.SymptomEntryOut])
def I_Miei_Sintomi(
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.SymptomEntry).filter(models.SymptomEntry.user_id == current_user.id)

    if from_date:
        q = q.filter(models.SymptomEntry.timestamp >= from_date)
    if to_date:
        q = q.filter(models.SymptomEntry.timestamp <= to_date)
    if tag:
        like = f"%{tag}%"
        q = q.filter(models.SymptomEntry.tags.ilike(like))

    entries = q.order_by(models.SymptomEntry.timestamp.desc()).all()
    return entries

# Utente, modifica sintomo

@router.put("/{entry_id}", response_model=schemas.SymptomEntryOut)
def Aggiorna_Sintomo(
    entry_id: int,
    entry_in: schemas.SymptomEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = (
        db.query(models.SymptomEntry)
        .filter(models.SymptomEntry.id == entry_id, models.SymptomEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Sintomo non trovato")

    if entry_in.title is not None:
        entry.title = entry_in.title
    if entry_in.description is not None:
        entry.description = entry_in.description
    if entry_in.severity is not None:
        entry.severity = entry_in.severity
    if entry_in.timestamp is not None:
        entry.timestamp = entry_in.timestamp
    if entry_in.tags is not None:
        entry.tags = entry_in.tags

    db.commit()
    db.refresh(entry)
    return entry

# utente, elimina sintomo

@router.delete("/{entry_id}")
def Elimina_sintomo(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = (
        db.query(models.SymptomEntry)
        .filter(models.SymptomEntry.id == entry_id, models.SymptomEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Sintomo non trovato")

    db.delete(entry)
    db.commit()
    return {"status": "deleted"}

# admin, visualizza tutti i sintomi registrati

@router.get("/admin/all", response_model=List[schemas.EntryAdminOut])
def admin_list_all_entries(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    items = (
        db.query(models.SymptomEntry, models.User.email)
        .join(models.User, models.User.id == models.SymptomEntry.user_id)
        .order_by(models.SymptomEntry.timestamp.desc())
        .all()
    )

    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "severity": e.severity,
            "timestamp": e.timestamp,
            "tags": e.tags,
            "user_id": e.user_id,
            "user_email": email,
        }
        for e, email in items
    ]



