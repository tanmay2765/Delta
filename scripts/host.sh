#!/usr/bin/env bash
# Quick local HTTPS preview via Cloudflare Tunnel (temporary URLs, good for demos)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v cloudflared >/dev/null; then
  echo "Install cloudflared: brew install cloudflared"
  exit 1
fi

echo "Start backend and frontend first, then run tunnels manually:"
echo ""
echo "  Terminal 1: cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "  Terminal 2: cd frontend && npm run dev"
echo "  Terminal 3: cloudflared tunnel --url http://localhost:8000"
echo "  Terminal 4: cloudflared tunnel --url http://localhost:8081"
echo ""
echo "For permanent hosting, follow LIVE_DEPLOY.md (Railway)."
