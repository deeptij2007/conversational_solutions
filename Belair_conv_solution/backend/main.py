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
  { "type": "form_edit", "field_id": "...", "value": "..." }   direct field edit (silent)

Server → Client:
  { "type": "init",         "message": {...}, "form_state": {...} }
  { "type": "message",      "message": {...}, "form_state": {...} }
  { "type": "state_update", "form_state": {...} }   ← silent form sync (no chat bubble)
  { "type": "error",        "detail": "..." }

Behaviour contract:
  - form_edit is SILENT: backend saves to DB and returns state_update only.
    The agent is NOT invoked. No chat bubble is shown.
  - message triggers the agent. The agent responds only when the client
    addresses it. It never proactively asks questions when the client
    is self-filling the form.
"""
import json
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

import os
_DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).parent / "belair.db"))
# Dev: Vite serves on :3000 and proxies /api + /ws to here.
# Prod: `npm run build` outputs to backend/static — served below.
_STATIC_DIR = Path(__file__).parent / "static"

db = FormDatabase(_DB_PATH)

# Agreement fields that need agent guidance when checked directly
_AGREEMENT_FIELDS = {"terms_agreement", "contact_permission", "soft_credit_check"}

# Fields that do NOT affect the premium — changing them must not trigger a price refresh
_NON_PREMIUM_FIELDS = {
    "first_name", "last_name", "email", "phone_type", "phone_number", "contact_permission"
}


def _msg_text(msg) -> str:
    """Safely extract plain text from an AIMessage (content may be str or list of blocks)."""
    content = getattr(msg, "content", "") or ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return " ".join(
            b.get("text", "") for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        ).strip()
    return str(content).strip()


def _last_text(messages: list) -> str:
    """Return the last non-empty assistant text from a message list (scans in reverse)."""
    from langchain_core.messages import AIMessage
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            text = _msg_text(msg)
            if text:
                return text
    return ""


# ── Lifespan: own the async SQLite connection for the checkpointer ────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSqliteSaver.from_conn_string(_DB_PATH) as checkpointer:
        app.state.agent_graph = build_graph(checkpointer)
        yield
    # AsyncSqliteSaver closes its connection automatically on context exit


app = FastAPI(title="Belair Direct Quote Assistant", lifespan=lifespan)


# ── REST ──────────────────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    """Return runtime config values the frontend needs (e.g. API keys)."""
    return {"google_maps_key": os.environ.get("GOOGLE_MAPS_KEY", "")}


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
        _init_answers = db.get_form_answers(session_id)
        _init_step    = db.get_position(session_id).get("current_step", 1)
        _init_state   = json.dumps({"current_step": _init_step, "answers": _init_answers})

        if is_new:
            greeting_body = (
                "New session. Greet the client warmly in one sentence, "
                "then immediately ask the first question of Step 1."
            )
        else:
            greeting_body = (
                "The client has returned. Welcome them back in one sentence "
                "(mention how many fields are filled), then ask the next "
                "unanswered question from [FORM_STATE]."
            )

        greeting = f"[SESSION_ID: {session_id}] [FORM_STATE: {_init_state}] {greeting_body}"
        result = await graph.ainvoke({"messages": [HumanMessage(content=greeting)]}, config)
        assistant_text = _last_text(result["messages"])

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
                user_text    = data.get("content", "").strip()
                on_quote_page = bool(data.get("on_quote_page", False))
                if not user_text:
                    continue

                # Inject fresh form state so the agent always sees the latest
                # answers — including any fields the client filled directly in
                # the form between chat messages.
                _answers    = db.get_form_answers(session_id)
                _step       = db.get_position(session_id).get("current_step", 1)
                _state_dict = {"current_step": _step, "answers": _answers}
                if on_quote_page:
                    _state_dict["on_quote_page"] = True
                _state   = json.dumps(_state_dict)
                _content = f"[SESSION_ID: {session_id}] [FORM_STATE: {_state}] {user_text}"

                final_text    = ""
                updated_fields = []
                async for event in graph.astream_events(
                    {"messages": [HumanMessage(content=_content)]},
                    config,
                    version="v2",
                ):
                    kind = event["event"]

                    # Push each filled field to the form panel immediately
                    if kind == "on_tool_end" and event["name"] == "update_form_answer":
                        try:
                            raw = event["data"].get("output", "")
                            # astream_events v2 may return a ToolMessage object
                            if hasattr(raw, "content"):
                                raw = raw.content
                            if isinstance(raw, str):
                                parsed = json.loads(raw)
                                saved = parsed.get("saved", {})
                                if saved.get("field_id"):
                                    updated_fields.append(saved["field_id"])
                                    await websocket.send_json({
                                        "type": "form_update",
                                        "field_id": saved["field_id"],
                                        "value": saved["value"],
                                    })
                        except Exception:
                            pass

                    # Capture the last text response from the LLM
                    elif kind == "on_chat_model_end":
                        output = event["data"].get("output")
                        if output:
                            content = getattr(output, "content", "")
                            if isinstance(content, str) and content.strip():
                                final_text = content
                            elif isinstance(content, list):
                                text = " ".join(
                                    b.get("text", "") for b in content
                                    if isinstance(b, dict) and b.get("type") == "text"
                                ).strip()
                                if text:
                                    final_text = text

                price_relevant_changed = any(
                    f not in _NON_PREMIUM_FIELDS for f in updated_fields
                )
                await websocket.send_json({
                    "type": "message",
                    "message": {"role": "assistant", "content": final_text},
                    "form_state": db.get_full_state(session_id),
                    "price_relevant_changed": price_relevant_changed,
                })

            elif msg_type == "step_advance":
                # Client clicked Continue — update position, then have the agent
                # ask the first unanswered question of the new step.
                step = int(data.get("step", 1))
                db.update_position(session_id, step, 0)

                _adv_answers  = db.get_form_answers(session_id)
                _adv_state    = json.dumps({"current_step": step, "answers": _adv_answers})
                # Compute which fields in this step are still unanswered so the
                # prompt is unambiguous — the agent must never re-ask filled fields.
                if step == 5:
                    # Step 5 = agreements: keep the original guided behaviour
                    _adv_content = (
                        f"[SESSION_ID: {session_id}] [FORM_STATE: {_adv_state}] "
                        f"The client pressed Continue and is now on Step {step}. "
                        f"IMPORTANT: [FORM_STATE].answers is authoritative — DO NOT ask about "
                        f"any field_id already in [FORM_STATE].answers, including agreement fields. "
                        f"Find the first agreement field in Step 5 whose id is NOT in "
                        f"[FORM_STATE].answers and ask only that question. "
                        f"If every agreement is already answered, tell the client to click **Get Your Price**."
                    )
                else:
                    # All other steps: introduce the topic AND immediately ask the first question
                    _adv_content = (
                        f"[SESSION_ID: {session_id}] [FORM_STATE: {_adv_state}] "
                        f"The client pressed Continue and is now on Step {step}. "
                        f"In one short sentence introduce what Step {step} covers, "
                        f"then immediately ask the first unanswered required field of Step {step}. "
                        f"Do NOT ask any field already answered in [FORM_STATE].answers."
                    )

                result = await graph.ainvoke(
                    {"messages": [HumanMessage(content=_adv_content)]}, config
                )
                await websocket.send_json({
                    "type": "message",
                    "message": {"role": "assistant", "content": _last_text(result["messages"])},
                    "form_state": db.get_full_state(session_id),
                })

            elif msg_type == "quote_shown":
                price = int(data.get("price", 0))
                # Send the fixed-format price message directly — no LLM call needed
                await websocket.send_json({
                    "type": "price_confirmed",
                    "message": {
                        "role": "assistant",
                        "content": f"Based on your information, your estimated monthly premium is **${price}/month**.",
                    },
                })

            elif msg_type == "ping":
                continue  # keepalive — no response needed

            elif msg_type == "form_edit":
                field_id = data.get("field_id", "")
                value    = data.get("value", "")
                if not field_id:
                    continue

                db.update_answer(session_id, field_id, value)

                await websocket.send_json({
                    "type": "state_update",
                    "form_state": db.get_full_state(session_id),
                })

                # Agreement checkboxes need agent guidance — they are silent form edits
                # but the bot must acknowledge each one and prompt for the next.
                if field_id in _AGREEMENT_FIELDS and value:
                    _agr_answers = db.get_form_answers(session_id)
                    _agr_state   = json.dumps({"current_step": 5, "answers": _agr_answers})
                    _agr_content = (
                        f"[SESSION_ID: {session_id}] [FORM_STATE: {_agr_state}] "
                        f"The client just checked the '{field_id}' agreement in the form. "
                        f"Acknowledge it briefly, then check [FORM_STATE].answers: "
                        f"if there are unchecked agreements, ask about the next one; "
                        f"if all three are checked, tell them to click **Get Your Price**."
                    )
                    result = await graph.ainvoke(
                        {"messages": [HumanMessage(content=_agr_content)]}, config
                    )
                    await websocket.send_json({
                        "type": "message",
                        "message": {"role": "assistant", "content": _last_text(result["messages"])},
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
