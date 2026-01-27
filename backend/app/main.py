from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth_routes, patients_routes, entries_routes, appointments_routes

# Crea le tabelle allo start
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Medical Symptom Diary API",
    version="1.0.0",
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://medicalsymptomdiary.eu",
        "http://medicalsymptomdiary.eu",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(patients_routes.router)
app.include_router(entries_routes.router)
app.include_router(appointments_routes.router)


@app.get("/")
def read_root():
    return {"message": "Medical Symptom Diary API running"}
