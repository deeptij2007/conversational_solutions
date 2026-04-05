# Belair Direct Conversational Quote Assistant — Technical Summary

## Overview
A car insurance quote web app (Quebec, 1 car / 1 driver) combining a multi-step form with an AI chat assistant. The bot guides the client through every question, syncs with the form in real time, and uses a knowledge base to answer insurance questions.

**Stack:** FastAPI + LangGraph + SQLite (backend) · React + Zustand + Vite (frontend) · Fly.io (deployment)

---

## Project Structure

```
Belair_conv_solution/
├── backend/
│   ├── main.py                     # FastAPI server + WebSocket handler
│   ├── db.py                       # SQLite ORM (sessions + answers)
│   ├── requirements.txt
│   ├── static/                     # Production frontend build (served by FastAPI)
│   └── agent/
│       ├── graph.py                # LangGraph ReAct agent + system prompt
│       └── tools.py                # 6 agent tools
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root: session bootstrap
│   │   ├── store/useFormStore.js   # Zustand store (single source of truth)
│   │   ├── hooks/useWebSocket.js   # WS lifecycle + message routing
│   │   ├── components/
│   │   │   ├── FormPanel.jsx       # 6-step form UI + Continue button
│   │   │   ├── ChatPanel.jsx       # Chat log + input
│   │   │   └── fields/             # RadioField, TextField, SelectField, DateField
│   │   └── constants/schema.js     # Form schema + getActiveStep + getNextFieldId
│   └── vite.config.js              # Builds to ../backend/static
├── belair_quote_form.json          # Master form schema (agent reads this)
├── scraped/                        # Knowledge base (5 markdown files)
│   ├── faq.md
│   ├── user-guide.md
│   ├── blog.md
│   ├── prevention-hub.md
│   └── contact-us.md
├── Dockerfile                      # 2-stage: Node build → Python runtime
├── fly.toml                        # Fly.io config (yyz, 512MB, SQLite volume)
└── run.sh                          # Local dev/prod startup
```

---

## WebSocket Protocol

**Client → Server:**

| Type | Payload | Effect |
|------|---------|--------|
| `message` | `content: string` | Invokes agent, returns chat bubble |
| `form_edit` | `field_id, value` | Silent save to DB, no agent |
| `step_advance` | `step: number` | Agent asks first question of new step |

**Server → Client:**

| Type | Payload | Effect |
|------|---------|--------|
| `init` | `message, form_state` | Initial greeting + form sync |
| `message` | `message, form_state` | Agent chat bubble + full form sync |
| `state_update` | `form_state` | Silent form sync (after form_edit) |
| `form_update` | `field_id, value` | Single field pushed by agent (highlight) |
| `error` | `detail` | Error message |

**Key rule:** Every user message to the agent includes `[SESSION_ID: ...] [FORM_STATE: {...}]` prepended — this is the ground truth of all current answers so the agent never relies on stale memory.

---

## Backend (main.py)

**Endpoints:** `GET /api/session/new` · `GET /api/state/{session_id}` · `WS /ws/{session_id}` · `GET /` (SPA)

**Session lifecycle:**
1. New session created fresh on every page load (no localStorage restore)
2. WS connects → greeting trigger sent to agent → `init` message returned
3. Loop: receive message type → route to handler → respond

**Three handlers:**

- **`message`** — injects fresh FORM_STATE, streams `graph.astream_events()`, captures `form_update` events per tool call, sends final text + full state
- **`step_advance`** — updates DB position, calls `graph.ainvoke()` with explicit "skip already-answered fields" instruction, returns next question
- **`form_edit`** — saves silently, returns `state_update`; if agreement field, also invokes agent to acknowledge and prompt for next

**Helper:** `_last_text(messages)` — scans agent result messages in reverse to find last non-empty AIMessage text (handles string and list content formats from Claude).

---

## Database (db.py)

```sql
sessions     (session_id PK, created_at, current_step, current_field_idx)
form_answers (session_id, field_id, value, updated_at — PK composite)
```

Single SQLite file also used by LangGraph's `AsyncSqliteSaver` for conversation history — keyed by `thread_id = session_id`.

---

## LangGraph Agent (graph.py)

- **Model:** `claude-sonnet-4-6`, temperature=0, max_tokens=768
- **Framework:** `create_react_agent` (LangGraph prebuilt ReAct)
- **History trimming:** Last 12 messages, advanced to first HumanMessage (avoids orphaned tool_result errors)

**System prompt behaviour (guided flow):**

1. Check `[FORM_STATE].answers` → find first unanswered required field in current step → ask it
2. Client answers → save with `update_form_answer` → ask next unanswered field
3. All required fields in step done → summarise → "click **Continue** to proceed"
4. On step_advance trigger → skip already-answered (including agreements) → ask first unanswered
5. Interruptions (insurance question / go back / field info) → handle, then resume flow
6. Never ask about a field already in `[FORM_STATE].answers`

---

## Agent Tools (tools.py)

| Tool | Purpose |
|------|---------|
| `get_current_state(session_id)` | `{answers, next_field_id, answered, total}` |
| `update_form_answer(session_id, field_id, value)` | Save + advance position + return next question |
| `navigate_back(session_id)` | Return to last answered field for editing |
| `get_question_info(field_id)` | Tooltip/related_info for a field |
| `check_step_complete(session_id, step)` | Check if all required fields answered |
| `search_belair_docs(query)` | Score + return best live URL per category from scraped/ |

`search_belair_docs` pre-validates all scraped URLs at startup (12 parallel workers) and only returns HTTP 200 confirmed links.

---

## Frontend (React + Zustand)

**Zustand store state:**

```
answers: {field_id: value}   activeStep: 1-6    viewStep: 1-7
activeFieldId: string        highlightedField    isTyping
messages: []                 ws, wsStatus        quotePrice
```

**Key actions:**

- `setAnswer(id, val, 'user')` → updates store + sends `form_edit` to backend
- `setAnswer(id, val, 'agent')` → updates store + highlights field for 1.8s (no WS send)
- `applyFormState(state)` → bulk sync from server (never changes `viewStep`)
- `sendMessage(text)` → adds to chat + sends `message` to backend

**FormPanel:** 6 steps, progress bar, stepper dots, Continue button. On Continue: `setViewStep(next)` + `setTyping(true)` + send `step_advance`. Step 7 = QuoteResult page (random price, coverage breakdown).

**Agreement fields:** Checkbox → `form_edit` → backend detects, invokes agent → bot acknowledges and prompts for next unchecked agreement or "Get Your Price".

---

## Form Schema — 37 Fields across 6 Steps

| Step | Fields |
|------|--------|
| 1 — Vehicle Info | vehicle_year (select), vehicle_make (text), vehicle_model (text) |
| 2 — Vehicle Details | commute_to_work_school, yearly_kilometres, car_condition, anti_theft_system |
| 3 — Driver Info | first_name, last_name, gender_identity, date_of_birth, age_first_licence |
| 4 — Contact Details | email, phone_type, phone_number, postal_code, years_at_address |
| 5 — Discounts & Perks | accidents_tickets, lapse_in_coverage, education_discount, business_use, safe_driving_program, home_insurance_bundle, group_member (optional) |
| 6 — Agreements | terms_agreement, contact_permission, soft_credit_check |

Schema is mirrored in `belair_quote_form.json` (agent reads) and `frontend/src/constants/schema.js` (UI renders).

---

## Deployment

**Dockerfile (2-stage):**
1. `node:20-alpine` → `npm ci && npm run build` → outputs to `../backend/static`
2. `python:3.11-slim` → copy backend + `belair_quote_form.json` at `/` + `scraped/` at `/scraped` + static build → `uvicorn main:app`

**Fly.io:** Region `yyz` (Toronto), 512MB RAM, shared CPU, persistent volume `/data` for SQLite, auto-stop when idle, HTTPS forced, health check on `GET /api/session/new`.

**Local dev:** `./run.sh dev` — FastAPI on `:8000` + Vite on `:3000` (proxies `/api` and `/ws`)

**Local prod:** `./run.sh` — builds frontend to `backend/static`, serves everything from `:8000`
