"""
FastAPI entry point.

Endpoints:
  GET  /api/session/new          → create a new session ID
  GET  /api/state/{session_id}   → current form state (REST fallback)
  WS   /ws/{session_id}          → bidirectional chat + form sync

WebSocket message protocol
──────────────────────────
Client → Server:
  { "type": "message",   "content": "..." }                    user chat message
  { "type": "form_edit", "field_id": "...", "value": "..." }   direct field edit

Server → Client:
  { "type": "init",    "message": {...}, "form_state": {...} }
  { "type": "message", "message": {...}, "form_state": {...} }
  { "type": "error",   "detail": "..." }
"""
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # loads .env if present; env vars already set take priority

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from agent.graph import build_graph
from db import FormDatabase

_DB_PATH = str(Path(__file__).parent / "belair.db")
# Dev: Vite serves on :3000 and proxies /api + /ws to here.
# Prod: `npm run build` outputs to backend/static — served below.
_STATIC_DIR = Path(__file__).parent / "static"

db = FormDatabase(_DB_PATH)


# ── Lifespan: own the async SQLite connection for the checkpointer ────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSqliteSaver.from_conn_string(_DB_PATH) as checkpointer:
        app.state.agent_graph = build_graph(checkpointer)
        yield
    # AsyncSqliteSaver closes its connection automatically on context exit


app = FastAPI(title="Belair Direct Quote Assistant", lifespan=lifespan)


# ── REST ──────────────────────────────────────────────────────────────────────

@app.get("/api/session/new")
def new_session():
    session_id = str(uuid.uuid4())
    db.get_or_create_session(session_id)
    return {"session_id": session_id}


@app.get("/api/state/{session_id}")
def get_state(session_id: str):
    if not db.session_exists(session_id):
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return JSONResponse(db.get_full_state(session_id))


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    graph = websocket.app.state.agent_graph
    db.get_or_create_session(session_id)
    config = {"configurable": {"thread_id": session_id}}
    is_new = len(db.get_form_answers(session_id)) == 0

    try:
        # ── Initial greeting ──────────────────────────────────────────────────
        greeting = (
            f"[SESSION_ID: {session_id}] "
            + (
                "Hello! I'm starting my Belair Direct car insurance quote."
                if is_new
                else "Hello! I'm returning to continue my quote where I left off."
            )
        )
        result = await graph.ainvoke({"messages": [HumanMessage(content=greeting)]}, config)
        assistant_text = result["messages"][-1].content

        await websocket.send_json({
            "type": "init",
            "message": {"role": "assistant", "content": assistant_text},
            "form_state": db.get_full_state(session_id),
        })

        # ── Main loop ─────────────────────────────────────────────────────────
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                user_text = data.get("content", "").strip()
                if not user_text:
                    continue

                result = await graph.ainvoke(
                    {"messages": [HumanMessage(content=f"[SESSION_ID: {session_id}] {user_text}")]},
                    config,
                )
                assistant_text = result["messages"][-1].content

                await websocket.send_json({
                    "type": "message",
                    "message": {"role": "assistant", "content": assistant_text},
                    "form_state": db.get_full_state(session_id),
                })

            elif msg_type == "form_edit":
                field_id = data.get("field_id", "")
                value = data.get("value", "")
                if not field_id:
                    continue

                db.update_answer(session_id, field_id, value)

                result = await graph.ainvoke(
                    {"messages": [HumanMessage(
                        content=(
                            f"[SESSION_ID: {session_id}] "
                            f"I just updated '{field_id}' directly in the form to '{value}'."
                        )
                    )]},
                    config,
                )
                assistant_text = result["messages"][-1].content

                await websocket.send_json({
                    "type": "message",
                    "message": {"role": "assistant", "content": assistant_text},
                    "form_state": db.get_full_state(session_id),
                })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "detail": str(exc)})
        except Exception:
            pass


# ── Static frontend (production build) ───────────────────────────────────────
# In dev, the Vite dev server (port 3000) proxies /api and /ws to here.
# In prod, `npm run build` writes to backend/static — served here.

if _STATIC_DIR.exists():
    @app.get("/")
    def serve_index():
        return FileResponse(_STATIC_DIR / "index.html")

    app.mount("/", StaticFiles(directory=str(_STATIC_DIR), html=True), name="spa")
