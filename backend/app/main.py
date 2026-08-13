import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, run_migrations
from app.routers import auth, meetings, realtime
from seed import seed_if_empty

Base.metadata.create_all(bind=engine)
run_migrations()
seed_if_empty()

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://192.168.0.102:8081",
]


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return DEFAULT_CORS_ORIGINS


app = FastAPI(
    title="Delta Zoom Clone API",
    description="Backend API for the Delta Zoom web-app clone assignment.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings.router)
app.include_router(realtime.router)
app.include_router(auth.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Delta Zoom Clone API is running"}
