# PRD: Belair Direct Conversational Insurance Quote App

> **Last updated:** 2026-03-28 — reflects all shipped iterations
> **Branch:** `conv_solutions_dev` → `https://github.com/deeptij2007/conversational_solutions`

---

## Overview

A web application that makes the Belair Direct car insurance quote form (Quebec, 1 car / 1 driver) conversational. A chat assistant and the live form sit side-by-side, always in sync. The client can interact with either panel at any time — the agent observes silently when the client self-fills and only speaks when spoken to.

---

## Goals

| Goal | Status |
|------|--------|
| Form and chat always visible, always in sync | ✅ Shipped |
| Client can fill the form directly without bot interference | ✅ Shipped |
| Client can ask the bot anything about the form | ✅ Shipped |
| Client can ask the bot to fill or guide them | ✅ Shipped |
| Answers persist across refreshes / session restores | ✅ Shipped |
| Back-navigation to change previous answers | ✅ Shipped |
| Agent answers using only Belair-sourced content | ✅ Shipped |
| No hallucination — grounded on `belair_quote_form.json` | ✅ Shipped |

---

## User Stories

| As a… | I want to… | So that… |
|--------|-----------|----------|
| Client | Fill the form directly without the bot asking questions | I can move at my own pace |
| Client | Ask the bot what a field means | I get accurate Belair-sourced explanations |
| Client | Ask the bot to fill a specific field | It guides me on exactly what to enter |
| Client | Ask the bot to guide me through the whole form | I get a fully conversational experience |
| Client | See my chat answers reflected live in the form | I can verify what was saved |
| Client | See my direct form edits acknowledged by the bot when I ask | Both panels stay in sync |
| Client | Go back and change a previous answer | I don't have to restart |
| Client | Refresh the page and continue where I left off | I don't lose progress |
| Client | See the full form at all times, even with a long chat | I always know where I am in the quote |

---

## Architecture Options Considered

### Option A: Single-process, vanilla JS frontend *(initial prototype)*
```
Browser (HTML/JS) ←── WebSocket ──→ FastAPI + LangGraph + SQLite
```
**Verdict:** Built first; replaced — vanilla JS too verbose for reactive bidirectional state.

### Option B: React + Vite + FastAPI *(CHOSEN — current)*
```
React (Vite/Zustand) ←── WebSocket ──→ FastAPI + LangGraph + SQLite
```
**Verdict:** Chosen for clean component model, Zustand as shared state bus, Vite proxy in dev.

### Option C: Next.js + Python microservice
```
Next.js (SSR) ←── REST ──→ FastAPI Agent Service ──→ Redis + Postgres
```
**Verdict:** Over-engineered for this use case.

---

## Current Architecture (Option B)

### Frontend — React 18 + Vite + Zustand

```
src/
├── store/useFormStore.js     ← single Zustand store (shared by both panels)
├── hooks/useWebSocket.js     ← WebSocket lifecycle, message routing
├── constants/schema.js       ← mirrors belair_quote_form.json for rendering
├── components/
│   ├── FormPanel.jsx         ← step cards, field renderers, progress bar
│   ├── ChatPanel.jsx         ← messages, typing indicator, input
│   └── fields/               ← RadioField, TextField, SelectField, DateField
└── App.jsx                   ← session bootstrap, WebSocket init
```

**Bidirectional sync — exact mechanism:**
```
Client fills form field directly
  └─→ setAnswer(id, value, 'user')
        ├─→ Zustand store updated (form re-renders instantly)
        └─→ ws.send({ type: 'form_edit', field_id, value })
              └─→ Backend saves silently — no agent call, no chat bubble
                    └─→ Returns { type: 'state_update', form_state }
                          └─→ Zustand applyFormState() — form stays in sync

Agent fills a field (via update_form_answer tool)
  └─→ ws receives { type: 'message', form_state }
        ├─→ Chat bubble shown
        ├─→ Zustand applyFormState() — form fields update
        └─→ Field gets 1.6 s blue glow animation (agent-updated highlight)
```

**Panel layout — always visible:**
CSS `min-height: 0` on `.app-body`, `.form-panel`, `.chat-panel` ensures both panels stay locked within the viewport and scroll independently, regardless of chat length.

---

### Backend — FastAPI + LangGraph

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/session/new` | Create session, return UUID |
| `GET` | `/api/state/{session_id}` | REST form state snapshot |
| `WS` | `/ws/{session_id}` | Main bidirectional channel |

**WebSocket message contract:**
```
Client → Server
  { type: "message",   content: "..."  }          → agent invoked, responds in chat
  { type: "form_edit", field_id, value }           → saved silently, NO agent call

Server → Client
  { type: "init",         message, form_state }    → greeting on connect
  { type: "message",      message, form_state }    → agent chat response + form sync
  { type: "state_update", form_state }             → silent form sync (no chat bubble)
  { type: "error",        detail }
```

**Silent form edit rule:**
`form_edit` saves to SQLite and returns `state_update` only. The agent is never invoked. When the client next speaks to the agent, it calls `get_current_state` to catch up.

---

### Agent — LangGraph ReAct (reactive-only)

```
Client message (type: "message")
        │
        ▼
  ┌─────────────┐   tool calls   ┌────────────┐
  │ agent_node  │ ─────────────► │ tool_node  │
  │  (Claude)   │ ◄───────────── │            │
  └─────────────┘  tool results  └────────────┘
        │
        ▼ (done)
  Response → WebSocket → Chat bubble + form_state update
```

**Agent tools (5 — down from 6):**
| Tool | Purpose |
|------|---------|
| `get_current_state` | Compact snapshot: `{answers, next_field_id, answered, total}` |
| `update_form_answer` | Save one field answer, advance position |
| `navigate_back` | Go to last answered field for correction |
| `get_question_info` | Fetch tooltip/related_info for a specific field |
| `check_step_complete` | Verify all fields in a step are filled |

> `get_form_schema` was removed — schema is embedded as a compact text table in the system prompt, saving ~1,300 tokens per invocation.

---

## Agentic Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Reactive, not proactive** | Agent speaks only when the client addresses it. Silent when client self-fills. |
| **Grounded only** | All field explanations come from `get_question_info` (sourced from `belair_quote_form.json`). No paraphrasing from training data. |
| **Human-in-the-loop** | When guiding mode is requested: agent asks one question at a time, confirms step summary, waits for explicit consent before advancing. |
| **Tool-based mutation** | Agent never writes state directly — always via `update_form_answer`. |
| **Persistent memory** | `AsyncSqliteSaver` checkpointer preserves full conversation per `thread_id` = `session_id`. |
| **Bounded context** | `pre_model_hook` trims history to last 12 messages before each LLM call. |
| **Lean tool outputs** | `get_current_state` returns only `{answers, next_field_id, answered, total}` — not full question objects. |
| **Focused scope** | System prompt enforces topic boundary: declines all non-quote questions. |
| **Back-navigation** | `navigate_back` surfaces last saved answer; client decides to keep or replace. |

---

## Token Efficiency (post-optimisation)

| Source | Before | After |
|--------|--------|-------|
| Form schema per turn | ~1,500 tokens (tool call) | ~200 tokens (in system prompt) |
| `get_current_state` response | ~600 tokens (full objects) | ~80 tokens (flat dict) |
| Conversation history | Unbounded growth | Capped at last 12 messages |
| Max output tokens | 1,024 | 512 |
| **Net reduction** | | **~65% fewer input tokens/turn** |

---

## Persistence

| Store | What | Technology |
|-------|------|-----------|
| Form answers | `{field_id: value}` per session | SQLite (`form_answers` table) |
| Conversation history | Full message log per session | LangGraph `AsyncSqliteSaver` |
| Session identity | UUID across refreshes | `localStorage` |

---

## Form Flow (`belair_quote_form.json` — single source of truth)

```
Step 1 — Vehicle Info
  vehicle_year · vehicle_make · vehicle_model

Step 2 — Vehicle Details
  commute_to_work_school · yearly_kilometres · car_condition · anti_theft_system

Step 3 — Driver Info
  first_name · last_name · gender_identity · date_of_birth · age_first_licence

Step 4 — Quote & Confirmation
  accidents_tickets · lapse_in_coverage · education_discount · soft_credit_check
  email · business_use · safe_driving_program · home_insurance_bundle
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| LLM | Claude claude-sonnet-4-6 | temperature 0, max_tokens 512 |
| Agent framework | LangGraph 0.5.x (ReAct) | `create_react_agent` + `pre_model_hook` |
| Conversation memory | `AsyncSqliteSaver` | async-safe, per thread_id |
| Backend | FastAPI + uvicorn | lifespan manages checkpointer |
| Form state DB | SQLite + SQLAlchemy-style raw queries | `FormDatabase` class |
| Frontend | React 18 + Vite | proxy to FastAPI in dev |
| State management | Zustand | single store, both panels subscribe |
| Communication | WebSocket | bidirectional, 4 message types |
| Node.js | conda env (`chatgpt_app`) | `PATH` set in `run.sh` |

---

## Running the App

```bash
# Production (build React → serve from FastAPI on :8000)
./run.sh

# Development (Vite on :3000 with HMR, FastAPI on :8000)
./run.sh dev
```

`ANTHROPIC_API_KEY` must be exported in the shell (or in `backend/.env`).

---

## Non-Goals

- No actual policy binding or payment processing
- No multi-car / multi-driver flows
- No provinces other than Quebec
- No general insurance advice — agent declines off-topic questions
- No RAG over policy documents (future phase)
