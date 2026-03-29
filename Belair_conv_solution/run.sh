#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "══════════════════════════════════════════"
echo "  Belair Direct Conversational Quote App  "
echo "══════════════════════════════════════════"

# Check API key (env var takes priority over .env file)
if [ -z "$ANTHROPIC_API_KEY" ] && [ ! -f "$BACKEND_DIR/.env" ]; then
  echo ""
  echo "⚠️  ANTHROPIC_API_KEY not found in environment or $BACKEND_DIR/.env"
  echo "   Export it:  export ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
  exit 1
fi

# Install any missing dependencies into the active Python environment
echo "→ Checking dependencies…"
pip install -q -r "$BACKEND_DIR/requirements.txt"
echo "✓ Dependencies ready."

echo ""
echo "→ Starting server at http://localhost:8000"
echo "  Press Ctrl+C to stop."
echo ""

cd "$BACKEND_DIR"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
