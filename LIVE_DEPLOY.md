# Deploy Delta Meet Live — FREE options (no Railway trial needed)

Railway trial expired? Use one of these **$0** options instead. All provide **HTTPS** (required for camera/mic).

| Option | Cost | Best for | WebSockets | DB persists |
|--------|------|----------|------------|-------------|
| **A. Render** | Free | Easiest, evaluation/demo | Yes | Until redeploy* |
| **B. Fly.io** | Free allowance | Always-on feel | Yes | Yes (volume) |
| **C. Oracle Cloud VPS** | Free forever | Long-term, full control | Yes | Yes |
| D. Railway | ~$5/mo after trial | Easiest if paying | Yes | Yes |

\* Render free has no persistent disk — database re-seeds automatically on each deploy (fine for evaluation).

---

## Option A — Render (recommended FREE)

**Time:** ~10 minutes · **Cost:** $0

### Step 1 — Push code

```bash
cd ~/Documents/Delta
git push origin main
```

### Step 2 — Deploy with Blueprint

1. Go to **[render.com](https://render.com)** → Sign up with GitHub
2. **New +** → **Blueprint**
3. Connect repo `tanmay2765/Delta`
4. Render reads `render.yaml` and creates 2 services
5. When prompted for env vars, set:
   - `VITE_API_URL` → leave blank for now
   - `CORS_ORIGINS` → leave blank for now
6. Click **Apply**

Wait ~5–10 min for both services to build.

### Step 3 — Wire URLs together

1. Open **delta-backend** service → copy URL (e.g. `https://delta-backend-xxxx.onrender.com`)
2. Test: open that URL → `{"message":"Delta Zoom Clone API is running"}`
3. Open **delta-frontend** service → **Environment** → set:
   ```
   VITE_API_URL=https://delta-backend-xxxx.onrender.com
   ```
4. **Manual Deploy** frontend (required — API URL is baked at build time)
5. Copy frontend URL (e.g. `https://delta-frontend-xxxx.onrender.com`)
6. Open **delta-backend** → **Environment** → set:
   ```
   CORS_ORIGINS=https://delta-frontend-xxxx.onrender.com
   ```
7. **Manual Deploy** backend

### Step 4 — Open your app

Visit your **frontend URL**. Dashboard should load with seeded meetings.

> **Note:** Render free tier spins down after ~15 min idle. First visit may take 30–60 seconds to wake up.

---

## Option B — Fly.io (free allowance)

**Time:** ~15 minutes · **Cost:** $0 within free allowance

```bash
# Install CLI
brew install flyctl
fly auth login

# Backend
cd ~/Documents/Delta/backend
fly launch --no-deploy    # name: delta-meet-api, region: bom (Mumbai)
fly secrets set SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
fly volumes create delta_data --region bom --size 1
fly deploy
# Copy URL: https://delta-meet-api.fly.dev

# Frontend (replace with your backend URL)
cd ../frontend
fly launch --no-deploy    # name: delta-meet-web
fly deploy --build-arg VITE_API_URL=https://delta-meet-api.fly.dev

# CORS on backend
cd ../backend
fly secrets set CORS_ORIGINS=https://delta-meet-web.fly.dev
```

---

## Option C — Oracle Cloud Always Free VPS

Truly free forever (ARM VM). Run everything with Docker:

1. Create free VM at [cloud.oracle.com](https://cloud.oracle.com) (Always Free tier, Ubuntu 22.04)
2. SSH in, install Docker
3. Clone repo, set `.env`, run `docker compose up --build -d`
4. Point a domain (or use Cloudflare Tunnel) for HTTPS

See `DEPLOY.md` for Docker Compose env vars.

---

## Option D — Railway (paid)

If you upgrade Railway (~$5/mo), follow the original Railway section in `DEPLOY.md`.

---

## After deploy — verify

1. Open frontend URL → dashboard with meetings
2. **New Meeting** → enable camera → enter
3. Incognito → **Join** with meeting ID
4. Video works between both tabs

Demo login (auto): `demo@delta.com` / `demo123456`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Render slow first load | Free tier cold start — wait 60s, refresh |
| CORS error | `CORS_ORIGINS` must exactly match frontend URL (https, no `/` at end) |
| API 404 from frontend | Redeploy frontend after setting `VITE_API_URL` |
| WebSocket fails | Don't use static-only hosts for backend; Render/Fly web services work |
| DB empty after Render redeploy | Normal on free tier — auto-seeds demo data on startup |
| Camera blocked | Must use HTTPS URL (not http) |

---

## Quick comparison vs Railway

| | Railway (paid) | Render (free) |
|--|--------------|---------------|
| Cost | ~$5/mo | $0 |
| Cold starts | Minimal | ~30–60s after idle |
| Persistent DB | Yes (volume) | No on free (re-seeds) |
| Setup | Dashboard clicks | Blueprint or dashboard |
| Good for evaluation | Yes | **Yes** |

**For your evaluation submission, Render free is enough.**
