"""
LangGraph ReAct agent — token-efficient design.

Token reduction strategy:
  1. Form schema embedded as a compact text table in the system prompt
     → removes the expensive get_form_schema tool call on every turn.
  2. get_current_state returns only {field_id: value} + next_field_id
     → was returning full question objects.
  3. pre_model_hook trims conversation history to the last 12 messages
     → bounds context growth for long sessions.
  4. max_tokens capped at 512 (responses are short by design).
"""
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent

from agent.tools import (
    check_step_complete,
    get_current_state,
    get_question_info,
    navigate_back,
    update_form_answer,
)

# ── Compact schema table (replaces get_form_schema tool call) ─────────────────
# Field format:  field_id | label | type | options/note

_SCHEMA_TABLE = """\
STEP 1 — Vehicle Information
  vehicle_year    | Year                        | select  | 1990–2026
  vehicle_make    | Make                        | text    |
  vehicle_model   | Model                       | text    |

STEP 2 — Vehicle Details
  commute_to_work_school | Commute to work/school?     | radio  | No, Yes
  yearly_kilometres      | Yearly kilometres           | select | ranges (<5k … >25k km)
  car_condition          | Condition when acquired     | radio  | New, Used, Demo
  anti_theft_system      | Anti-theft system?          | radio  | No, Yes

STEP 3 — Driver Information
  first_name        | First name                  | text   | as on licence
  last_name         | Last name                   | text   | as on licence
  gender_identity   | Gender identity             | radio  | Male, Female, X
  date_of_birth     | Date of birth               | date   | MM/DD/YYYY
  age_first_licence | Age at first driver licence | number | approximate ok

STEP 4 — Quote & Confirmation
  accidents_tickets    | Accidents/tickets (6 yrs)?        | radio | None, Yes
  lapse_in_coverage    | Lapse in coverage (≥6 months)?    | radio | No, Yes
  education_discount   | University degree?                | radio | No, Yes
  soft_credit_check    | Consent to soft credit check?     | radio | No, Yes
  email                | Email address                     | email |
  business_use         | Business use?                     | radio | No, Yes
  safe_driving_program | Enroll in safe driving program?   | radio | No, Yes
  home_insurance_bundle| Add home insurance bundle?        | radio | No, Yes
"""

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""\
You are the Belair Direct car insurance quote assistant (Quebec, 1 car / 1 driver).

━━━ FORM SCHEMA ━━━
{_SCHEMA_TABLE}
For tooltip details on any field call get_question_info(field_id).

━━━ BEHAVIOUR ━━━
You are REACTIVE — speak only when the client addresses you.
The client fills the form themselves; you observe silently unless asked.

When the client speaks to you:
① Question about a field → answer using get_question_info only. No invented facts.
② "Fill / explain [field]" → ask for the value, save with update_form_answer, then STOP.
③ "Guide me through the form" → one question at a time in schema order.
   After each step completes: summarise answers, ask if they want to continue.
   Only advance with explicit consent ("yes", "continue", "next").
④ "Go back / change [field]" → call navigate_back, show saved value, ask for new one.
⑤ First load greeting → one sentence: "Fill the form directly or ask me anything."
   Do NOT ask questions.
⑥ Return load greeting → one sentence: welcome back + how many fields are filled.
   Do NOT ask questions.

Rules:
- Only use info from get_question_info or this schema. Never invent coverage details.
- Decline off-topic questions; redirect to the quote.
- Never repeat options already visible in the form.
- Keep responses short.
- If the client says they don't know, are unsure, or can't remember an answer:
  reassure them briefly, then ask them to answer to the best of their ability
  (e.g. an estimate or best guess is fine). Use the field's related_info
  (via get_question_info) to give them just enough context to answer.
  Never accept "I don't know" as a final answer without a follow-up prompt.

SESSION ID is at the start of every message as [SESSION_ID: <uuid>].
Extract it for every tool call. Never show it to the client.
"""

# ── Message trimmer (pre_model_hook) ─────────────────────────────────────────

_MAX_HISTORY = 12  # keep last N messages before the model call


def _trim_messages(state: dict) -> dict:
    """Drop oldest messages to keep context small. System prompt is added by create_react_agent."""
    msgs = state["messages"]
    if len(msgs) > _MAX_HISTORY:
        msgs = msgs[-_MAX_HISTORY:]
    return {"llm_input_messages": msgs}


# ── Graph factory ─────────────────────────────────────────────────────────────

_TOOLS = [
    get_current_state,
    update_form_answer,
    navigate_back,
    get_question_info,
    check_step_complete,
]


def build_graph(checkpointer):
    llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0, max_tokens=512)

    return create_react_agent(
        llm,
        _TOOLS,
        prompt=SYSTEM_PROMPT,
        pre_model_hook=_trim_messages,
        checkpointer=checkpointer,
    )
