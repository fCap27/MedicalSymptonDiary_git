from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date as dt_date, time as dt_time

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from typing import List
from app.admin_deps import require_admin
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from io import BytesIO

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

WORKING_HOURS = [
    dt_time(8, 0), dt_time(9, 0), dt_time(10, 0), dt_time(11, 0),
    dt_time(12, 0), dt_time(13, 0), dt_time(14, 0), dt_time(15, 0),
    dt_time(16, 0), dt_time(17, 0),
]

# Disponibilità orari struttura
@router.get("/availability")
def Disponibilità_appuntamenti(
    facility: str = Query(...),
    date: dt_date = Query(...),
    db: Session = Depends(get_db),
):
    appointments = db.query(models.Appointment).filter(
        models.Appointment.facility == facility,
        models.Appointment.date == date
    ).all()

    booked_times = [a.time.strftime("%H:%M") for a in appointments]
    return booked_times



# Utente, prenota visita
@router.post("", response_model=schemas.AppointmentOut)
def Prenota_visita(
    data: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # orari occupati
    existing = db.query(models.Appointment).filter(
        models.Appointment.facility == data.facility,
        models.Appointment.date == data.date,
        models.Appointment.time == data.time
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Orario già prenotato per questa struttura"
        )

    appointment = models.Appointment(
        user_id=current_user.id,
        facility=data.facility,
        date=data.date,
        time=data.time,
        status="PENDING",
        pdf_filename=data.pdf_filename,
        pdf_base64=data.pdf_base64
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment

# Utente, mie visite
@router.get("", response_model=List[schemas.AppointmentOut])
def Miei_appuntamenti(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = db.query(models.Appointment).filter(
        models.Appointment.user_id == current_user.id
    ).order_by(models.Appointment.date.desc(), models.Appointment.time.desc()).all()
    return items

# admin cambio stato || accetta o rifiuta 

@router.put("/{appointment_id}/status", response_model=schemas.AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    data: schemas.AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")

    new_status = data.status.strip().upper()
    if new_status not in ("CONFIRMED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Status non valido")

    appt.status = new_status
    db.commit()
    db.refresh(appt)
    return appt

# admin visualizza tutti gli appuntamenti

@router.get("/admin/all", response_model=List[schemas.AppointmentAdminOut])
def admin_list_all_appointments(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    items = (
            db.query(models.Appointment, models.User.email)
            .join(models.User, models.User.id == models.Appointment.user_id)
            .order_by(models.Appointment.date.desc(), models.Appointment.time.desc())
            .all()
        )

    return [
        {
            "id": appt.id,
            "facility": appt.facility,
            "date": appt.date,
            "time": appt.time,
            "pdf_filename": appt.pdf_filename,
            "status": appt.status,
            "user_id": appt.user_id,
            "user_email": email,
        }
        for appt, email in items
    ]

# Admin propone nuove tempistiche || pulsante di proposta

@router.put("/{appointment_id}/propose", response_model=schemas.AppointmentOut)
def propose_new_slot(
    appointment_id: int,
    data: schemas.AppointmentProposeUpdate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")

    # Imposta proposta e stato
    appt.proposed_date = data.proposed_date
    appt.proposed_time = data.proposed_time
    appt.status = "PROPOSED"

    db.commit()
    db.refresh(appt)
    return appt

# visite utente con status = proposed || Accetta

@router.put("/{appointment_id}/accept", response_model=schemas.AppointmentOut)
def accept_proposal(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")

    if appt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    if appt.status != "PROPOSED" or not appt.proposed_date or not appt.proposed_time:
        raise HTTPException(status_code=400, detail="Nessuna proposta da accettare")

    # proposta nuova data/orario e conferma
    appt.date = appt.proposed_date
    appt.time = appt.proposed_time
    appt.proposed_date = None
    appt.proposed_time = None
    appt.status = "CONFIRMED"

    db.commit()
    db.refresh(appt)
    return appt

# visite utente con status = proposed || Rifiuta

@router.put("/{appointment_id}/reject", response_model=schemas.AppointmentOut)
def reject_proposal(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")

    if appt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    if appt.status != "PROPOSED":
        raise HTTPException(status_code=400, detail="Nessuna proposta da rifiutare")

    # Rifiuto
    appt.proposed_date = None
    appt.proposed_time = None
    appt.status = "REJECTED"

    db.commit()
    db.refresh(appt)
    return appt

    import base64
from fastapi.responses import Response

# creazione pdf per visite, visuale admin

@router.get("/{appointment_id}/pdf")
def admin_download_diary_pdf(
    appointment_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")

    user = db.query(models.User).filter(models.User.id == appt.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # Recupera TUTTI i sintomi dell’utente
    entries = (
        db.query(models.SymptomEntry)
        .filter(models.SymptomEntry.user_id == user.id)
        .order_by(models.SymptomEntry.timestamp.asc())
        .all()
    )

    if not entries:
        raise HTTPException(status_code=404, detail="Nessun sintomo registrato")

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, "Diario Sintomi")
    y -= 30

    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, y, f"Utente: {user.email}")
    y -= 30

    for e in entries:
        if y < 80:
            pdf.showPage()
            y = height - 50
            pdf.setFont("Helvetica", 10)

        pdf.drawString(50, y, f"- {e.timestamp.strftime('%d/%m/%Y %H:%M')} | {e.title} (Sev. {e.severity}/10)")
        y -= 15
        if e.description:
            pdf.drawString(60, y, e.description[:120])
            y -= 15

    pdf.save()
    buffer.seek(0)

    filename = f"{user.email}_DiarioSintomi.pdf"

    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


