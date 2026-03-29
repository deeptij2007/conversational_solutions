"""
LangGraph tools for the Belair quote agent.
All form knowledge comes exclusively from belair_quote_form.json.
State is read/written through FormDatabase — never invented by the agent.
"""
import json
import re
from pathlib import Path
from langchain_core.tools import tool
from db import FormDatabase

# ── Load form schema once at import time ──────────────────────────────────────

_SCHEMA_PATH = Path(__file__).parent.parent.parent / "belair_quote_form.json"
with open(_SCHEMA_PATH, encoding="utf-8") as _f:
    FORM_SCHEMA: dict = json.load(_f)

db = FormDatabase()


def _flatten_questions() -> list[dict]:
    """
    Walk the JSON schema and return every question in display order,
    each enriched with its step number and flat index.
    """
    questions = []
    for step in FORM_SCHEMA["steps"]:
        step_num = step["step"]
        step_title = step.get("title", "")
        step_desc = step.get("description", "")

        if "questions" in step:
            for idx, q in enumerate(step["questions"]):
                questions.append(
                    {**q, "step": step_num, "step_title": step_title,
                     "step_description": step_desc, "field_idx": idx}
                )

        if "sub_steps" in step:
            for sub in step["sub_steps"]:
                if "questions" in sub:
                    for idx, q in enumerate(sub["questions"]):
                        questions.append(
                            {**q, "step": step_num,
                             "sub_step": sub.get("sub_step"),
                             "step_title": sub.get("title", ""),
                             "step_description": sub.get("description", ""),
                             "field_idx": idx}
                        )

    return questions


ALL_QUESTIONS: list[dict] = _flatten_questions()
FIELD_INDEX: dict[str, dict] = {q["id"]: q for q in ALL_QUESTIONS}


# ── Tools ─────────────────────────────────────────────────────────────────────


@tool
def get_current_state(session_id: str) -> str:
    """
    Return a compact snapshot of the current form state:
    - answers: {field_id: value} for all filled fields
    - next_field_id: the next unanswered field, or null if complete
    - answered / total counts

    Args:
        session_id: The session identifier (UUID string).
    """
    db.get_or_create_session(session_id)
    answers = db.get_form_answers(session_id)
    next_q = next((q for q in ALL_QUESTIONS if q["id"] not in answers), None)

    return json.dumps(
        {
            "answers": answers,
            "next_field_id": next_q["id"] if next_q else None,
            "answered": len(answers),
            "total": len(ALL_QUESTIONS),
        },
        ensure_ascii=False,
    )


@tool
def update_form_answer(session_id: str, field_id: str, value: str) -> str:
    """
    Save a client's answer to a form field.
    Call this immediately after the client provides a valid answer.

    Args:
        session_id: The session identifier.
        field_id:   The field ID from the schema (e.g. 'vehicle_year', 'first_name').
        value:      The answer value as a string.

    Returns JSON with:
        - confirmation of what was saved
        - the next question to present to the client
    """
    if field_id not in FIELD_INDEX:
        return json.dumps({"error": f"Unknown field_id '{field_id}'. Check get_form_schema."})

    db.update_answer(session_id, field_id, value)

    # Advance position to the next unanswered question
    answers = db.get_form_answers(session_id)
    next_q = next((q for q in ALL_QUESTIONS if q["id"] not in answers), None)

    if next_q:
        db.update_position(session_id, next_q["step"], next_q["field_idx"])

    return json.dumps(
        {
            "saved": {"field_id": field_id, "value": value},
            "next_question": next_q,
        },
        ensure_ascii=False,
    )


@tool
def navigate_back(session_id: str) -> str:
    """
    Go back to the last answered question so the client can review or change their answer.
    This does NOT delete the answer — the client must explicitly provide a new one to overwrite.

    Args:
        session_id: The session identifier.

    Returns the previous question details and the current saved answer.
    """
    answers = db.get_form_answers(session_id)
    if not answers:
        return json.dumps({"error": "Already at the first question, cannot go further back."})

    # Find the last answered question (in schema order)
    last_answered = None
    for q in reversed(ALL_QUESTIONS):
        if q["id"] in answers:
            last_answered = q
            break

    if not last_answered:
        return json.dumps({"error": "No answered questions found."})

    db.update_position(session_id, last_answered["step"], last_answered["field_idx"])

    return json.dumps(
        {
            "navigated_to": last_answered,
            "current_answer": answers[last_answered["id"]],
            "message": (
                f"Showing: '{last_answered['question']}' "
                f"(current answer: {answers[last_answered['id']]}). "
                "Ask the client if they want to keep it or provide a new answer."
            ),
        },
        ensure_ascii=False,
    )


@tool
def get_question_info(field_id: str) -> str:
    """
    Return the full details and tooltip/related_info for a specific form field.
    Use this when the client asks what a question means or wants more information.

    Args:
        field_id: The field ID to look up (e.g. 'gender_identity', 'soft_credit_check').
    """
    q = FIELD_INDEX.get(field_id)
    if not q:
        return json.dumps({"error": f"Field '{field_id}' not found in the form schema."})

    return json.dumps(
        {
            "field_id": field_id,
            "question": q["question"],
            "related_info": q.get("related_info", "No additional information available."),
            "field_type": q["field_type"],
            "options": q.get("options", []),
            "step": q["step"],
            "step_title": q.get("step_title", ""),
        },
        ensure_ascii=False,
    )


_SCRAPED_DIR = Path(__file__).parent.parent.parent / "scraped"

_STOP_WORDS = {
    "a","an","the","is","it","in","on","at","to","for","of","and","or","i",
    "my","your","what","how","do","does","can","will","be","are","was","has",
    "have","about","with","this","that","they","we","you","me","if","any",
    "get","its","by","as","so","am","would","could","should","not","no",
}


def _load_sections() -> list[dict]:
    """
    Parse all scraped markdown files into a flat list of scored sections.
    Each section: {title, url, text}
    """
    sections = []

    def _add(title: str, url: str, text: str):
        url = url.strip().rstrip(")").rstrip("'\"")
        if url.startswith("https://www.belairdirect.com"):
            sections.append({"title": title.strip(), "url": url, "text": text.lower()})

    for md_file in sorted(_SCRAPED_DIR.glob("*.md")):
        content = md_file.read_text(encoding="utf-8")

        # ── 1. Sublinks Found block: "- Title: URL"
        sublinks_block = re.search(
            r"## Sublinks Found\n(.*?)(?=\n---|\Z)", content, re.DOTALL
        )
        if sublinks_block:
            for m in re.finditer(r"-\s+(.+?):\s+(https?://\S+)", sublinks_block.group(1)):
                title, url = m.group(1), m.group(2)
                # Search for this URL's section body to attach as context
                body_match = re.search(
                    rf"\*\*URL:\*\*\s*{re.escape(url.strip())}\s*\n(.*?)(?=\n---|\Z)",
                    content, re.DOTALL
                )
                body = body_match.group(1) if body_match else title
                _add(title, url, f"{title} {body}")

        # ── 2. Individually rendered sections (after ---)
        for part in content.split("---"):
            url_m = re.search(r"\*\*(?:Main )?URL:\*\*\s*(https?://\S+)", part)
            title_m = re.search(r"^##\s+(.+)$", part, re.MULTILINE)
            if url_m and title_m:
                _add(title_m.group(1), url_m.group(1), part)

    return sections


@tool
def search_belair_docs(query: str) -> str:
    """
    Search the Belair Direct knowledge base (scraped website content) for pages
    relevant to the client's question. Returns the top 2 most relevant links.

    Use this whenever the client asks a question about car insurance, coverage,
    discounts, claims, payments, the automerit app, or any Belair service.
    Do NOT invent answers — only return the links found here.

    Args:
        query: The client's question or topic (plain text).
    """
    if not _SCRAPED_DIR.exists():
        return json.dumps({"error": "Knowledge base not available."})

    sections = _load_sections()
    if not sections:
        return json.dumps({"results": [], "message": "No documents found."})

    query_words = set(re.findall(r"\w+", query.lower())) - _STOP_WORDS

    scored = []
    seen_urls = set()
    for sec in sections:
        if sec["url"] in seen_urls:
            continue
        score = sum(1 for w in query_words if w in sec["text"])
        if score > 0:
            scored.append((score, sec))

    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    seen = set()
    for _, sec in scored:
        if sec["url"] not in seen:
            results.append({"title": sec["title"], "url": sec["url"]})
            seen.add(sec["url"])
        if len(results) == 2:
            break

    if not results:
        return json.dumps({"results": [], "message": "No relevant links found."})

    return json.dumps({"results": results}, ensure_ascii=False)


@tool
def check_step_complete(session_id: str, step: int) -> str:
    """
    Check whether all questions for a given step have been answered.
    Use this before summarising a step and asking the client to proceed.

    Args:
        session_id: The session identifier.
        step:       Step number (1, 2, 3, or 4).
    """
    answers = db.get_form_answers(session_id)
    step_questions = [q for q in ALL_QUESTIONS if q["step"] == step]
    unanswered = [q for q in step_questions if q["id"] not in answers]

    return json.dumps(
        {
            "step": step,
            "complete": len(unanswered) == 0,
            "answered": len(step_questions) - len(unanswered),
            "total": len(step_questions),
            "unanswered": [{"id": q["id"], "question": q["question"]} for q in unanswered],
        }
    )
