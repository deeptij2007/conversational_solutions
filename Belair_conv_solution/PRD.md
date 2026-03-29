# PRD: Belair Direct Conversational Insurance Quote App

## Overview
A lightweight web application that transforms the Belair Direct car insurance quote form (Quebec, 1 car / 1 driver) into a conversational experience. A chat assistant and the actual form live side-by-side, always in sync. The assistant strictly follows the Belair form flow and only uses information from `belair_quote_form.json`.

---

## Goals
- Make the quoting process feel guided and human, not bureaucratic
- Never let the client get lost: the form always reflects the current conversation state
- Persist all answers across browser refreshes / session restores
- Client retains full control: they decide when to proceed to the next step
- Agent answers questions using only Belair-provided content (no hallucination)

---

## User Stories
| As a…       | I want to…                                             | So that…                                     |
|-------------|--------------------------------------------------------|----------------------------------------------|
| Client      | Chat naturally instead of reading a long form          | I understand what's being asked of me        |
| Client      | See my answers reflected live in the form panel        | I can verify what I've entered               |
| Client      | Go back and change a previous answer                   | I don't have to restart from scratch         |
| Client      | Ask what a question means                              | I get accurate Belair-sourced explanations   |
| Client      | Decide when to move to the next step                   | I feel in control of the process             |
| Client      | Refresh the page and continue where I left off         | I don't lose my progress                     |

---

## Architecture Options

### Option A: Single-process, vanilla frontend (CHOSEN)
```
Browser (HTML/JS)  ←── WebSocket ──→  FastAPI + LangGraph (Python)
                                             │
                                       SQLite (sessions + answers)
                                       LangGraph SqliteSaver (conversation memory)
```
**Pros:** No build step, single process, easy to run, truly lightweight
**Cons:** Vanilla JS is more verbose than React for complex UIs

### Option B: React frontend + FastAPI backend
```
React (Vite) ←── REST + WebSocket ──→ FastAPI + LangGraph
                                             │
                                         PostgreSQL / SQLite
```
**Pros:** Better component model, easier state management
**Cons:** Requires Node.js, build step, more moving parts

### Option C: Full-stack Next.js + Python microservice
```
Next.js (SSR) ←── REST ──→ FastAPI Agent Service ──→ Redis (state) + PG (history)
```
**Pros:** Best scalability, SSR for SEO
**Cons:** Heavyweight, over-engineered for this use case

---

## Chosen Architecture (Option A) — Design Details

### Frontend (Single HTML file)
- Pure HTML + vanilla JS (ES modules) + CSS Grid layout
- No build step — served directly by FastAPI as a static file
- WebSocket client for real-time bidirectional sync
- Session ID stored in `localStorage` for persistence across refreshes

### Backend (FastAPI)
- `GET /api/session/new` — create a new session
- `GET /api/state/{session_id}` — get current form state (REST fallback)
- `WS /ws/{session_id}` — main communication channel

### Agent (LangGraph ReAct)
```
Human message
      │
      ▼
 ┌─────────────┐      tool calls      ┌─────────────┐
 │  agent_node │ ─────────────────►  │  tool_node  │
 │  (Claude)   │ ◄─────────────────  │             │
 └─────────────┘    tool results     └─────────────┘
      │
      ▼ (no more tool calls)
 Assistant response → WebSocket → Browser
```

**Agent tools:**
| Tool | Purpose |
|------|---------|
| `get_form_schema` | Load full form definition from JSON |
| `get_current_state` | Read current answers + position from DB |
| `update_form_answer` | Save an answer, advance position |
| `navigate_back` | Return to previous question |
| `get_question_info` | Fetch tooltip/related_info for a field |
| `check_step_complete` | Verify all step fields are answered |

### Persistence
- **LangGraph SqliteSaver** → stores full conversation message history per `thread_id` (session_id)
- **SQLite `form_answers` table** → stores field-level answers accessible to both agent tools and REST API
- **`localStorage`** → stores `session_id` in browser, enables session restore on refresh

---

## Agentic Design Principles Applied
1. **Grounded responses only** — agent reads form JSON via tool, never from training data
2. **Human-in-the-loop** — step transitions require explicit client consent
3. **Tool-based state mutation** — agent never writes state directly; uses tools
4. **Persistent memory** — LangGraph checkpointer preserves full conversation context
5. **Focused scope** — system prompt enforces topic boundary (insurance quote only)
6. **Graceful back-navigation** — agent re-presents previous question with current answer shown
7. **Bidirectional sync** — direct form edits notify the agent; agent updates reflect in form

---

## Form Flow (strict order from belair_quote_form.json)
```
Step 1: Vehicle Info        → Year → Make → Model
Step 2: Vehicle Details     → Commute? → Yearly km → Condition → Anti-theft?
Step 3: Driver Info         → First name → Last name → Gender → DOB → Age at first licence
Step 4: Quote + Confirm     → 4.1 Coverage display
                            → 4.2 Accidents/tickets → Lapse → Education → Credit check → Email
                            → 4.3 Business use → Safe driving program
                            → 4.4 Home bundle
                            → 4.5 Next step (Continue)
```

---

## Non-Goals
- No actual policy binding or payment processing
- No multi-car / multi-driver flows
- No provinces other than Quebec
- Agent will not answer general insurance questions outside the Belair quote flow

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| LLM | Anthropic Claude claude-sonnet-4-6 |
| Agent framework | LangGraph (ReAct pattern) |
| Backend | FastAPI + uvicorn |
| Persistence | SQLite (form state) + LangGraph SqliteSaver (conversation) |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Communication | WebSocket (bidirectional real-time sync) |
