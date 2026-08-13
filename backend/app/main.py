from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, run_migrations
from app.routers import auth, meetings, realtime

Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(
    title="Delta Zoom Clone API",
    description="Backend API for the Delta Zoom web-app clone assignment.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8081",
        "http://192.168.0.102:8081",
    ],
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
