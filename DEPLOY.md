# Deploy Delta (full stack)

Delta has two parts:

| Part | Tech | Needs |
|------|------|-------|
| Frontend | TanStack Start + Vite | HTTPS in production (camera/mic) |
| Backend | FastAPI + SQLite + WebSockets | Persistent disk, WebSocket support |

## Before you deploy

1. **HTTPS is required** for camera and microphone in browsers (localhost is the only HTTP exception).
2. **Set a fixed `SECRET_KEY`** — without it, every backend restart logs everyone out.
3. **Set `VITE_API_URL` at frontend build time** to your public backend URL (e.g. `https://api.yourdomain.com`).
4. **Set `CORS_ORIGINS`** on the backend to your public frontend URL (e.g. `https://yourdomain.com`).

---

## Option A — Fastest: Docker Compose (VPS or local server)

Good for a single machine with a public IP or domain.

### 1. Create env file

```bash
cd ~/Documents/Delta
cp .env.example .env
```

Edit `.env`:

```env
SECRET_KEY=your-long-random-secret-here
VITE_API_URL=https://api.yourdomain.com
CORS_ORIGINS=https://yourdomain.com
```

For local Docker testing only:

```env
SECRET_KEY=local-dev-secret
VITE_API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:8081
```

### 2. Start everything

```bash
docker compose up --build -d
```

- Frontend: http://localhost:8081
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

### 3. Put Nginx + HTTPS in front (production)

Point your domain to the server, then proxy:

- `yourdomain.com` → frontend `:8081`
- `api.yourdomain.com` → backend `:8000`

Use [Certbot](https://certbot.eff.org/) for free SSL certificates.

---

## Option B — Recommended cloud split

Deploy backend and frontend separately.

### Backend → Railway or Render

Both support WebSockets and persistent volumes (needed for SQLite).

**Railway steps:**

1. Create a project at [railway.app](https://railway.app)
2. Deploy from GitHub repo, root directory: `backend`
3. Add a **Volume** mounted at `/data`
4. Set environment variables:

```env
SECRET_KEY=your-long-random-secret
DATABASE_URL=sqlite:////data/delta.db
CORS_ORIGINS=https://your-frontend.pages.dev
PORT=8000
```

5. Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

6. Copy the public URL (e.g. `https://delta-api.up.railway.app`)

**Render steps:** Same idea — Web Service, root `backend`, add persistent disk, same env vars.

### Frontend → Cloudflare Pages

1. Connect GitHub repo at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Root directory: `frontend`
3. Build command:

```bash
npm ci && NITRO_PRESET=node-server VITE_API_URL=https://your-backend-url npm run build
```

4. Output directory: `.output/public` (if Pages asks for static) **or** use the Node adapter:

For TanStack Start on Cloudflare Workers (default build):

```bash
npm ci && VITE_API_URL=https://your-backend-url npm run build
npx wrangler deploy
```

5. Set `VITE_API_URL` in Cloudflare **build environment variables** to your backend URL.

6. Update backend `CORS_ORIGINS` to your Cloudflare frontend URL.

---

## Option C — Manual deploy (no Docker)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export SECRET_KEY="your-long-random-secret"
export CORS_ORIGINS="https://your-frontend-url.com"
export DATABASE_URL="sqlite:///./delta.db"

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Keep it running with **systemd**, **pm2**, or a process manager.

### Frontend

```bash
cd frontend
npm ci
export VITE_API_URL="https://your-backend-url.com"
NITRO_PRESET=node-server npm run build
node .output/server/index.mjs
```

---

## Production checklist

- [ ] `SECRET_KEY` set and kept stable across restarts
- [ ] Frontend served over **HTTPS**
- [ ] `VITE_API_URL` points to public backend (`https://...`)
- [ ] `CORS_ORIGINS` includes exact frontend origin (no trailing slash)
- [ ] Backend has persistent storage for `delta.db`
- [ ] WebSockets work (`wss://your-backend/.../ws`)
- [ ] Test: sign up → login → create meeting → join → enable camera/mic

## Verify deployment

```bash
# Backend health
curl https://your-backend-url.com/

# Should return: {"message":"Delta Zoom Clone API is running"}
```

Open frontend → Sign up → New Meeting → click **Enable camera & microphone** → Enter Meeting.

---

## What works in production today

| Feature | Status |
|---------|--------|
| Auth (signup/login/profile) | Works |
| Create/join/schedule meetings | Works |
| Real-time sync (WebSocket) | Works |
| Host permissions / waiting room | Works |
| Your own camera preview | Works (HTTPS + user click) |
| Other participants' live video/audio | Works (WebRTC mesh, best with 2–4 participants) |

To add larger meetings (10+ people), integrate an SFU such as Livekit or mediasoup.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Camera/mic blocked | Site must use HTTPS; user must click "Enable camera & microphone" |
| Login works then fails after redeploy | Set `SECRET_KEY` env var |
| API calls fail from frontend | Check `CORS_ORIGINS` and `VITE_API_URL` |
| Profile stuck loading | Backend not reachable or wrong `VITE_API_URL` |
| WebSocket disconnects | Hosting must support WebSockets (not all serverless edge plans do for long-lived connections — use Railway/Render/VPS for backend) |
