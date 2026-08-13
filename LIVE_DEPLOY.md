# Deploy Delta Meet Live (Railway — recommended)

This gets you a **public HTTPS URL** for both frontend and backend. Camera/mic work because the site is served over HTTPS.

**Time:** ~15 minutes  
**Cost:** Railway free trial / ~$5/mo after trial

---

## What you do (3 steps)

### Step 1 — Push code to GitHub

If you haven't pushed the latest code yet, run in Terminal:

```bash
cd ~/Documents/Delta
git add -A
git commit -m "Production deploy: Docker, host controls, Zoom UI"
git push origin main
```

Repo: https://github.com/tanmay2765/Delta

---

### Step 2 — Deploy backend on Railway

1. Go to **[railway.app](https://railway.app)** → Sign in with GitHub
2. **New Project** → **Deploy from GitHub repo** → select `tanmay2765/Delta`
3. Railway creates one service. Click it → **Settings**:
   - **Root Directory:** leave empty (repo root)
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Watch Paths:** `backend/**`
4. **Variables** tab — add:

   | Variable | Value |
   |----------|-------|
   | `SECRET_KEY` | Run: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
   | `DATABASE_URL` | `sqlite:////data/delta.db` |
   | `CORS_ORIGINS` | *(leave empty for now — set after Step 3)* |

5. **Volumes** tab → **Add Volume**:
   - Mount path: `/data`
6. **Settings** → **Networking** → **Generate Domain**
7. Copy your backend URL, e.g. `https://delta-backend-production-xxxx.up.railway.app`
8. Test: open `https://YOUR-BACKEND-URL/` — should show `{"message":"Delta Zoom Clone API is running"}`

---

### Step 3 — Deploy frontend on Railway

1. In the same Railway project → **+ New** → **GitHub Repo** → same `Delta` repo
2. **Settings** for the new service:
   - **Dockerfile Path:** `frontend/Dockerfile`
   - **Watch Paths:** `frontend/**`
3. **Variables** tab:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your backend URL from Step 2 (no trailing slash) |
   | `PORT` | `8081` |

4. **Networking** → **Generate Domain** → copy frontend URL, e.g. `https://delta-frontend-production-xxxx.up.railway.app`

5. Go back to **backend service** → **Variables** → set:

   ```
   CORS_ORIGINS=https://YOUR-FRONTEND-URL.up.railway.app
   ```

6. **Redeploy backend** (Deployments → Redeploy) so CORS picks up the frontend URL.

7. Open **frontend URL** in browser → dashboard should load with seeded meetings.

---

## Verify it works

1. Open your **frontend URL**
2. Dashboard shows meetings + activity chart
3. **New Meeting** → enable camera/mic → **Enter Meeting**
4. Open incognito → **Join** with meeting ID
5. Both participants see video (WebRTC)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Frontend loads but API fails | Check `VITE_API_URL` matches backend domain exactly; redeploy frontend after changing it |
| CORS error in browser console | Set `CORS_ORIGINS` on backend to exact frontend URL (https, no trailing slash); redeploy backend |
| Camera/mic blocked | Site must be HTTPS (Railway provides this automatically) |
| Login lost after redeploy | `SECRET_KEY` must stay the same — don't regenerate it |
| WebSocket fails | Use Railway (supports WebSockets). Don't use static-only hosts for backend |
| Empty database | Backend auto-seeds on first start. Check backend logs for errors |

---

## Alternative: Docker on a VPS

If you have a DigitalOcean/Linode VPS with Docker:

```bash
cd ~/Documents/Delta
cp .env.example .env
# Edit .env: SECRET_KEY, VITE_API_URL=https://api.yourdomain.com, CORS_ORIGINS=https://yourdomain.com
docker compose up --build -d
```

Put Nginx + Certbot in front for HTTPS.

---

## After deploy — share these URLs

- **App (share with users):** `https://YOUR-FRONTEND-URL.up.railway.app`
- **API docs:** `https://YOUR-BACKEND-URL.up.railway.app/docs`
- **Demo login:** `demo@delta.com` / `demo123456` (auto-login on first visit)
