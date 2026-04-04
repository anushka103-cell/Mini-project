"""
MindSafe Memory Store — Long-Term Per-User Memory (Redis-backed)

Stores and retrieves:
  • Session summaries (what was discussed, key themes)
  • User preferences (what techniques worked / didn't)
  • Recurring emotional patterns

All data is keyed by user_id so different users stay isolated.
Falls back gracefully to an in-memory dict if Redis is unreachable.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/1")
MEMORY_TTL_SECONDS = int(os.getenv("MEMORY_TTL_SECONDS", str(60 * 60 * 24 * 30)))  # 30 days
MAX_SUMMARIES_PER_USER = 20


class MemoryStore:
    """Long-term per-user memory backed by Redis (DB 1)."""

    def __init__(self):
        self._redis = None
        self._fallback: Dict[str, dict] = {}  # user_id -> data
        self._connect()

    # ────────────────────────────────────────
    def _connect(self):
        try:
            import redis
            self._redis = redis.from_url(REDIS_URL, decode_responses=True)
            self._redis.ping()
            logger.info("MemoryStore connected to Redis at %s", REDIS_URL)
        except Exception as e:
            logger.warning("Redis unavailable, using in-memory fallback: %s", e)
            self._redis = None

    # ────────────────────────────────────────
    #  Keys
    # ────────────────────────────────────────
    @staticmethod
    def _key(user_id: str, namespace: str) -> str:
        return f"mindsafe:memory:{user_id}:{namespace}"

    # ────────────────────────────────────────
    #  Session summaries
    # ────────────────────────────────────────
    def save_session_summary(
        self,
        user_id: str,
        session_id: str,
        summary: str,
        emotions: List[str],
        strategies_used: List[str],
    ) -> None:
        """Persist a session summary for long-term recall."""
        entry = {
            "session_id": session_id,
            "summary": summary,
            "emotions": emotions,
            "strategies_used": strategies_used,
            "timestamp": int(time.time()),
        }

        key = self._key(user_id, "summaries")
        if self._redis:
            try:
                self._redis.lpush(key, json.dumps(entry))
                self._redis.ltrim(key, 0, MAX_SUMMARIES_PER_USER - 1)
                self._redis.expire(key, MEMORY_TTL_SECONDS)
                return
            except Exception as e:
                logger.warning("Redis save failed: %s", e)

        # Fallback
        bucket = self._fallback.setdefault(user_id, {"summaries": [], "preferences": {}})
        bucket["summaries"].insert(0, entry)
        bucket["summaries"] = bucket["summaries"][:MAX_SUMMARIES_PER_USER]

    def get_session_summaries(self, user_id: str, limit: int = 5) -> List[dict]:
        """Retrieve recent session summaries for context."""
        key = self._key(user_id, "summaries")
        if self._redis:
            try:
                raw = self._redis.lrange(key, 0, limit - 1)
                return [json.loads(r) for r in raw]
            except Exception as e:
                logger.warning("Redis read failed: %s", e)

        bucket = self._fallback.get(user_id, {})
        return bucket.get("summaries", [])[:limit]

    # ────────────────────────────────────────
    #  User preferences (what worked / didn't)
    # ────────────────────────────────────────
    def record_preference(
        self,
        user_id: str,
        technique_id: str,
        helpful: bool,
    ) -> None:
        """Track whether a technique was helpful for this user."""
        key = self._key(user_id, "preferences")
        field = technique_id
        if self._redis:
            try:
                current = self._redis.hget(key, field)
                score = int(current) if current else 0
                score += 1 if helpful else -1
                self._redis.hset(key, field, str(score))
                self._redis.expire(key, MEMORY_TTL_SECONDS)
                return
            except Exception as e:
                logger.warning("Redis preference save failed: %s", e)

        bucket = self._fallback.setdefault(user_id, {"summaries": [], "preferences": {}})
        prefs = bucket["preferences"]
        prefs[technique_id] = prefs.get(technique_id, 0) + (1 if helpful else -1)

    def get_preferences(self, user_id: str) -> Dict[str, int]:
        """Return {technique_id: score} for this user."""
        key = self._key(user_id, "preferences")
        if self._redis:
            try:
                raw = self._redis.hgetall(key)
                return {k: int(v) for k, v in raw.items()}
            except Exception as e:
                logger.warning("Redis preference read failed: %s", e)

        bucket = self._fallback.get(user_id, {})
        return bucket.get("preferences", {})

    # ────────────────────────────────────────
    #  Build context string for LLM prompt
    # ────────────────────────────────────────
    def build_memory_context(self, user_id: str) -> str:
        """
        Return a concise text block summarising what we know about this
        user, suitable for injection into an LLM system prompt.
        """
        parts: list[str] = []

        # Recent session summaries
        summaries = self.get_session_summaries(user_id, limit=3)
        if summaries:
            parts.append("Previous sessions:")
            for s in summaries:
                emotions_str = ", ".join(s.get("emotions", []))
                parts.append(f"- {s['summary']} (emotions: {emotions_str})")

        # Preferred / unhelpful techniques
        prefs = self.get_preferences(user_id)
        if prefs:
            liked = [k for k, v in prefs.items() if v > 0]
            disliked = [k for k, v in prefs.items() if v < 0]
            if liked:
                parts.append(f"Techniques this user found helpful: {', '.join(liked)}")
            if disliked:
                parts.append(f"Techniques this user didn't find helpful: {', '.join(disliked)}")

        return "\n".join(parts) if parts else ""
