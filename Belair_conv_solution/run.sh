#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
NODE_BIN="/home/anirban/miniconda3/envs/chatgpt_app/bin"

echo "══════════════════════════════════════════"
echo "  Belair Direct Conversational Quote App  "
echo "══════════════════════════════════════════"

# Check API key
if [ -z "$ANTHROPIC_API_KEY" ] && [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "⚠️  ANTHROPIC_API_KEY not set. Export it or add to $BACKEND_DIR/.env"
  exit 1
fi

MODE="${1:-prod}"

if [ "$MODE" = "dev" ]; then
  # ── Development: Vite dev server + FastAPI with hot-reload ──────────────────
  echo "→ Dev mode: Vite on :3000, FastAPI on :8000"
  echo "  Open http://localhost:3000"
  echo ""

  pip install -q -r "$BACKEND_DIR/requirements.txt"

  # Start FastAPI in background
  cd "$BACKEND_DIR" && uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
  BACKEND_PID=$!

  # Start Vite dev server (proxies /api and /ws to FastAPI)
  cd "$FRONTEND_DIR"
  PATH="$NODE_BIN:$PATH" npm run dev &
  FRONTEND_PID=$!

  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
  wait

else
  # ── Production: build React, serve everything from FastAPI ──────────────────
  echo "→ Building frontend…"
  cd "$FRONTEND_DIR"
  PATH="$NODE_BIN:$PATH" npm install -q
  PATH="$NODE_BIN:$PATH" npm run build
  echo "✓ Frontend built."

  echo "→ Installing backend dependencies…"
  pip install -q -r "$BACKEND_DIR/requirements.txt"

  echo ""
  echo "→ Starting server at http://localhost:8000"
  echo "  Press Ctrl+C to stop."
  echo ""

  cd "$BACKEND_DIR"
  uvicorn main:app --host 0.0.0.0 --port 8000
fi
