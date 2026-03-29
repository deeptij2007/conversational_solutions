"""
SQLite persistence for form answers and session positions.
LangGraph handles its own conversation history via SqliteSaver.
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path


DB_PATH = Path(__file__).parent / "belair.db"


class FormDatabase:
    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        self._init_db()

    def _conn(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id   TEXT PRIMARY KEY,
                    created_at   TEXT NOT NULL,
                    current_step INTEGER DEFAULT 1,
                    current_field_idx INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS form_answers (
                    session_id TEXT NOT NULL,
                    field_id   TEXT NOT NULL,
                    value      TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (session_id, field_id)
                );
            """)

    # ── Session management ────────────────────────────────────────────────────

    def get_or_create_session(self, session_id: str) -> dict:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO sessions VALUES (?, ?, 1, 0)",
                    (session_id, datetime.now().isoformat()),
                )
                return {"session_id": session_id, "current_step": 1, "current_field_idx": 0}
            return dict(row)

    def session_exists(self, session_id: str) -> bool:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            return row is not None

    # ── Position tracking ─────────────────────────────────────────────────────

    def get_position(self, session_id: str) -> dict:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT current_step, current_field_idx FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            return dict(row) if row else {"current_step": 1, "current_field_idx": 0}

    def update_position(self, session_id: str, step: int, field_idx: int):
        with self._conn() as conn:
            conn.execute(
                "UPDATE sessions SET current_step = ?, current_field_idx = ? WHERE session_id = ?",
                (step, field_idx, session_id),
            )

    # ── Answers ───────────────────────────────────────────────────────────────

    def get_form_answers(self, session_id: str) -> dict:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT field_id, value FROM form_answers WHERE session_id = ?",
                (session_id,),
            ).fetchall()
            return {row["field_id"]: row["value"] for row in rows}

    def update_answer(self, session_id: str, field_id: str, value: str):
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO form_answers (session_id, field_id, value, updated_at)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(session_id, field_id) DO UPDATE SET
                       value = excluded.value,
                       updated_at = excluded.updated_at""",
                (session_id, field_id, value, datetime.now().isoformat()),
            )

    def delete_answer(self, session_id: str, field_id: str):
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM form_answers WHERE session_id = ? AND field_id = ?",
                (session_id, field_id),
            )

    def get_full_state(self, session_id: str) -> dict:
        """Return everything the frontend needs to render the form."""
        answers = self.get_form_answers(session_id)
        position = self.get_position(session_id)
        return {
            "answers": answers,
            "current_step": position["current_step"],
            "current_field_idx": position["current_field_idx"],
        }
