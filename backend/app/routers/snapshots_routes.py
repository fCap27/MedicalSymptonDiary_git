from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


def build_summary_from_entries(entries: List[models.SymptomEntry]) -> str:
    """Crea un testo di riepilogo"""
    if not entries:
        return "Nessun sintomo registrato"

    severities = [e.severity for e in entries]
    avg = sum(severities) / len(severities)

    # ordine per data, calcolo un range giorni approssimato
    entries_sorted = sorted(entries, key=lambda e: e.timestamp)
    days_range = max(
        1,
        round(
            (entries_sorted[-1].timestamp - entries_sorted[0].timestamp).total_seconds()
            / (60 * 60 * 24)
        ),
    )

    summary = (
        f"Negli ultimi {days_range} giorni sono stati registrati {len(entries)} sintomi "
        f"con severità media {avg:.1f}/10. "
        "La valutazione definitiva spetta al medico curante."
    )
    return summary


@router.post("", response_model=schemas.SnapshotOut)
def Genera_Diario(
    _: schemas.SnapshotCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Crea uno snapshot usando tutti i sintomi dell'utente corrente"""
    entries = (
        db.query(models.SymptomEntry)
        .filter(models.SymptomEntry.user_id == current_user.id)
        .all()
    )

    summary_text = build_summary_from_entries(entries)

    snap = models.Snapshot(user_id=current_user.id, summary_text=summary_text)
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


@router.get("", response_model=List[schemas.SnapshotOut])
def Il_Mio_Diario(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ritorna tutti gli snapshot dell'utente, dal più recente al più vecchio"""
    snaps = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.user_id == current_user.id)
        .order_by(models.Snapshot.created_at.desc())
        .all()
    )
    return snaps
