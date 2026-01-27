from datetime import datetime
from datetime import date, time
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# Login 

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=4, max_length=200)


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_admin: bool


    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Nuovo sintomo

class SymptomEntryBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: int = Field(ge=1, le=10)
    timestamp: datetime
    tags: Optional[str] = None 


class SymptomEntryCreate(SymptomEntryBase):
    pass


class SymptomEntryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[int] = Field(default=None, ge=1, le=10)
    timestamp: Optional[datetime] = None
    tags: Optional[str] = None


class SymptomEntryOut(SymptomEntryBase):
    id: int

    class Config:
        orm_mode = True


# Appuntamenti || appuntamenti admin

class AppointmentCreate(BaseModel):
    facility: str
    date: date
    time: time
    pdf_filename: str
    pdf_base64: str

class AppointmentOut(BaseModel):
    id: int
    facility: str
    date: date
    time: time
    proposed_date: Optional[date] = None
    proposed_time: Optional[time] = None
    status: str
    pdf_filename: str

    class Config:
        orm_mode = True

from typing import Optional

class AppointmentStatusUpdate(BaseModel):
    status: str  

class AppointmentAdminOut(BaseModel):
    id: int
    facility: str
    date: date
    time: time
    pdf_filename: str
    status: str
    user_id: int
    user_email: str

    class Config:
        orm_mode = True

class AppointmentProposeUpdate(BaseModel):
    proposed_date: date
    proposed_time: time 

# sintomi admin

class EntryAdminOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    severity: int
    timestamp: datetime
    tags: Optional[str] = None
    user_id: int
    user_email: str


    class Config:
        orm_mode = True


