# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the FastEmbed ONNX model so it's baked into the image
# (no PyTorch needed — ONNX runtime only, ~100 MB RAM at runtime)
RUN python -c "\
from fastembed import TextEmbedding; \
list(TextEmbedding(model_name='BAAI/bge-small-en-v1.5').embed(['warmup'])); \
print('FastEmbed model cached.')"

# Copy backend
COPY backend/ ./

# Copy form schema (tools.py resolves 3 levels up from /app/agent/ → /)
COPY belair_quote_form.json /belair_quote_form.json

# Copy scraped knowledge base (tools.py resolves to /scraped)
COPY scraped/ /scraped/

# Copy built frontend into backend/static (where FastAPI serves it from)
COPY --from=frontend-build /app/backend/static ./static

# SQLite DB lives on a mounted volume at /data
ENV DB_PATH=/data/belair.db

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
