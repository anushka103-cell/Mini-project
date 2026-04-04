"""Integration tests for mood logging behavior.

These tests expect the mood_analytics service to be running locally.
Run with:
  python -m pytest test_mood_logging_integration.py -v
"""

from __future__ import annotations

from datetime import datetime, timezone
import os
import uuid

import requests


MOOD_BASE_URL = os.getenv("MOOD_ANALYTICS_URL", "http://localhost:8002")


def _post_mood(user_id: str, score: int, label: str, note: str) -> dict:
    payload = {
        "user_id": user_id,
        "mood_score": score,
        "mood_label": label,
        "notes": note,
        "logged_at": datetime.now(timezone.utc).isoformat(),
    }
    response = requests.post(
        f"{MOOD_BASE_URL}/moods/log",
        json=payload,
        timeout=10,
    )
    assert response.status_code == 200, response.text
    return response.json()


def _get_logs(user_id: str, days: int = 1) -> list[dict]:
    response = requests.get(
        f"{MOOD_BASE_URL}/moods/{user_id}/logs",
        params={"days": days},
        timeout=10,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_same_day_logs_are_appended_not_overwritten() -> None:
    user_id = f"test-user-{uuid.uuid4()}"

    first = _post_mood(user_id, 3, "Sad", "first same-day")
    second = _post_mood(user_id, 8, "Happy", "second same-day")

    logs = _get_logs(user_id, days=1)
    notes = [entry.get("notes") for entry in logs]

    assert first["id"] != second["id"]
    assert len(logs) >= 2
    assert "first same-day" in notes
    assert "second same-day" in notes


def test_logs_are_returned_newest_first() -> None:
    user_id = f"test-user-{uuid.uuid4()}"

    _post_mood(user_id, 4, "Calm", "old entry")
    _post_mood(user_id, 9, "Happy", "new entry")

    logs = _get_logs(user_id, days=1)

    assert len(logs) >= 2
    assert logs[0]["id"] > logs[1]["id"]
