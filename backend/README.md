# Delta Backend

Python + FastAPI backend for the Delta Zoom web-app clone.

## Requirements

- Python 3.11+ recommended

## Setup

From the `backend` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run FastAPI

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

## Reset database (remove all data)

```bash
python reset_db.py
```

## Authentication

- `POST /api/auth/signup` — create account
- `POST /api/auth/login` — get JWT token
- `GET /api/auth/me` — current user (requires `Authorization: Bearer <token>`)

## Meeting endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings/instant` | Create an instant meeting |
| POST | `/api/meetings/schedule` | Schedule a future meeting |
| GET | `/api/meetings/upcoming` | List upcoming scheduled meetings |
| GET | `/api/meetings/recent` | List recent meetings |
| GET | `/api/meetings/{meeting_id}` | Get meeting details |
| POST | `/api/meetings/{meeting_id}/join` | Join a meeting |
| POST | `/api/meetings/{meeting_id}/end` | End a meeting |
| GET | `/api/meetings/invite/{invite_code}` | Resolve invite code |

## Database

SQLite file: `backend/delta.db` — tables created on startup.

## CORS

Enabled for `http://localhost:3000`.
