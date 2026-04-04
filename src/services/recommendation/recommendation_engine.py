"""
Hybrid Recommendation Engine

Combines a rule‑based filter with a lightweight ML ranker so
recommendations are accurate from day‑1 (rules) and improve over
time as user feedback accumulates (ML).

Architecture
────────────
1. **Rule filter** – narrows the full strategy library to candidates
   that match the detected emotion + intensity band.
2. **Diversity sampler** – ensures at least one strategy from each
   relevant category so the user sees varied options.
3. **ML ranker** – a small scikit‑learn model that re‑ranks candidates
   using features like emotion, intensity, time‑of‑day, session turn
   count, and past feedback.  Falls back gracefully to the rule engine
   when there is no trained model or not enough feedback yet.
4. **Feedback loop** – records thumbs‑up / thumbs‑down per strategy
   and retrains the ranker periodically in‑process.
"""

from __future__ import annotations

import logging
import math
import random
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np

from strategy_library import (
    STRATEGY_LIBRARY,
    CopingStrategy,
    IntensityBand,
    StrategyCategory,
    get_strategies_for_emotion,
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────
#  Feature helpers
# ────────────────────────────────────────────────────────
EMOTION_INDEX = {
    "sadness": 0, "anxiety": 1, "stress": 2, "anger": 3,
    "happiness": 4, "neutral": 5, "fear": 6, "disgust": 7,
    "surprise": 8, "trust": 9, "anticipation": 10,
}
CATEGORY_INDEX = {c.value: i for i, c in enumerate(StrategyCategory)}
NUM_EMOTIONS = len(EMOTION_INDEX)
NUM_CATEGORIES = len(CATEGORY_INDEX)
FEATURE_DIM = NUM_EMOTIONS + NUM_CATEGORIES + 4  # + intensity, hour_sin, hour_cos, difficulty


def _intensity_band(intensity: float) -> IntensityBand:
    if intensity < 0.4:
        return IntensityBand.LOW
    if intensity < 0.7:
        return IntensityBand.MODERATE
    return IntensityBand.HIGH


def _build_feature_vector(
    emotion: str,
    intensity: float,
    category: StrategyCategory,
    difficulty: int,
    hour: int | None = None,
) -> np.ndarray:
    """Create a fixed‑size feature vector for the ML ranker."""
    vec = np.zeros(FEATURE_DIM, dtype=np.float32)

    # one‑hot emotion
    eidx = EMOTION_INDEX.get(emotion, NUM_EMOTIONS - 1)
    vec[eidx] = 1.0

    # one‑hot category
    cidx = CATEGORY_INDEX.get(category.value if isinstance(category, StrategyCategory) else category, 0)
    vec[NUM_EMOTIONS + cidx] = 1.0

    # continuous features
    base = NUM_EMOTIONS + NUM_CATEGORIES
    vec[base] = intensity
    if hour is not None:
        vec[base + 1] = math.sin(2 * math.pi * hour / 24)
        vec[base + 2] = math.cos(2 * math.pi * hour / 24)
    vec[base + 3] = difficulty / 3.0  # normalised 0–1

    return vec


# ────────────────────────────────────────────────────────
#  Feedback storage  (in‑memory; production would use DB)
# ────────────────────────────────────────────────────────
@dataclass
class FeedbackRecord:
    emotion: str
    intensity: float
    strategy_id: str
    category: str
    difficulty: int
    helpful: bool  # True = thumbs‑up
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    hour: int = field(default_factory=lambda: datetime.now(timezone.utc).hour)


class FeedbackStore:
    """Thread‑safe in‑memory feedback ledger."""

    def __init__(self) -> None:
        self._records: List[FeedbackRecord] = []
        self._lock = threading.Lock()
        # quick per‑strategy hit rate (positive / total)
        self._hits: Dict[str, int] = defaultdict(int)
        self._totals: Dict[str, int] = defaultdict(int)

    def add(self, record: FeedbackRecord) -> None:
        with self._lock:
            self._records.append(record)
            self._totals[record.strategy_id] += 1
            if record.helpful:
                self._hits[record.strategy_id] += 1

    def hit_rate(self, strategy_id: str) -> float | None:
        total = self._totals.get(strategy_id, 0)
        if total == 0:
            return None
        return self._hits[strategy_id] / total

    def as_training_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """Return (X, y) arrays ready for scikit‑learn."""
        with self._lock:
            records = list(self._records)

        strategy_lookup = {s.id: s for s in STRATEGY_LIBRARY}
        X_rows, y_rows = [], []
        for r in records:
            strat = strategy_lookup.get(r.strategy_id)
            if strat is None:
                continue
            vec = _build_feature_vector(
                r.emotion, r.intensity, strat.category, strat.difficulty, r.hour
            )
            X_rows.append(vec)
            y_rows.append(1.0 if r.helpful else 0.0)

        if not X_rows:
            return np.empty((0, FEATURE_DIM)), np.empty(0)

        return np.array(X_rows), np.array(y_rows)

    @property
    def size(self) -> int:
        return len(self._records)


# ────────────────────────────────────────────────────────
#  ML Ranker  (SGDClassifier – lightweight, online‑trainable)
# ────────────────────────────────────────────────────────
class MLRanker:
    """Wraps a small sklearn model that learns to rank strategies."""

    MIN_SAMPLES = 20  # don't train until we have enough signal

    def __init__(self) -> None:
        self._model = None
        self._trained = False
        self._lock = threading.Lock()

    @property
    def is_ready(self) -> bool:
        return self._trained

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        if len(X) < self.MIN_SAMPLES:
            return
        from sklearn.linear_model import SGDClassifier
        clf = SGDClassifier(loss="log_loss", max_iter=200, random_state=42, class_weight="balanced")
        clf.fit(X, y)
        with self._lock:
            self._model = clf
            self._trained = True
        logger.info("ML ranker trained on %d samples", len(X))

    def predict_scores(self, candidates: List[np.ndarray]) -> List[float]:
        """Return probability‑of‑helpful for each candidate vector."""
        with self._lock:
            if not self._trained or self._model is None:
                return [0.5] * len(candidates)
            X = np.array(candidates)
            try:
                probs = self._model.predict_proba(X)[:, 1]
                return probs.tolist()
            except Exception:
                return [0.5] * len(candidates)


# ────────────────────────────────────────────────────────
#  Main Recommendation Engine
# ────────────────────────────────────────────────────────
class RecommendationEngine:
    """
    Hybrid rule + ML recommender.

    Usage:
        engine = RecommendationEngine()
        recs = engine.recommend("anxiety", 0.75, top_k=5)
        engine.record_feedback("anxiety", 0.75, "breathing_478", True)
    """

    RETRAIN_INTERVAL = 50  # retrain after every N new feedback records

    def __init__(self) -> None:
        self.feedback = FeedbackStore()
        self.ranker = MLRanker()
        self._feedback_since_train = 0

    # ── public API ──────────────────────────────────────

    def recommend(
        self,
        emotion: str,
        intensity: float = 0.5,
        top_k: int = 5,
        excluded_ids: Optional[List[str]] = None,
        preferred_categories: Optional[List[str]] = None,
        context: Optional[Dict] = None,
    ) -> List[Dict]:
        """
        Return top‑k strategy recommendations.

        Parameters
        ----------
        emotion : detected primary emotion
        intensity : 0‑1 float
        top_k : how many to return
        excluded_ids : strategies already shown this session
        preferred_categories : user preferences (boost score)
        context : extra signals like {"session_turns": 3}
        """
        emotion = (emotion or "neutral").lower()
        intensity = max(0.0, min(1.0, intensity))
        excluded = set(excluded_ids or [])
        context = context or {}

        # Step 1 – rule filter
        candidates = self._rule_filter(emotion, intensity, excluded)

        if not candidates:
            # broaden search: try neighbouring emotions
            for fallback_emotion in self._fallback_emotions(emotion):
                candidates = self._rule_filter(fallback_emotion, intensity, excluded)
                if candidates:
                    break

        if not candidates:
            return []

        # Step 2 – score each candidate
        hour = datetime.now(timezone.utc).hour
        scored: List[Tuple[float, CopingStrategy]] = []

        # ML scores (if ranker is ready)
        feature_vecs = [
            _build_feature_vector(emotion, intensity, c.category, c.difficulty, hour)
            for c in candidates
        ]
        ml_scores = self.ranker.predict_scores(feature_vecs)

        for i, strat in enumerate(candidates):
            score = self._composite_score(
                strat, emotion, intensity, ml_scores[i],
                preferred_categories, context,
            )
            scored.append((score, strat))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Step 3 – ensure category diversity in top‑k
        result = self._diverse_select(scored, top_k)

        return [self._format_recommendation(s, sc, emotion, intensity) for sc, s in result]

    def record_feedback(
        self,
        emotion: str,
        intensity: float,
        strategy_id: str,
        helpful: bool,
    ) -> None:
        """Record a thumbs‑up / thumbs‑down and maybe retrain."""
        strat = next((s for s in STRATEGY_LIBRARY if s.id == strategy_id), None)
        if strat is None:
            return

        self.feedback.add(FeedbackRecord(
            emotion=emotion,
            intensity=intensity,
            strategy_id=strategy_id,
            category=strat.category.value,
            difficulty=strat.difficulty,
            helpful=helpful,
        ))

        self._feedback_since_train += 1
        if self._feedback_since_train >= self.RETRAIN_INTERVAL:
            self._retrain()
            self._feedback_since_train = 0

    def get_stats(self) -> Dict:
        return {
            "total_strategies": len(STRATEGY_LIBRARY),
            "feedback_count": self.feedback.size,
            "ml_ranker_active": self.ranker.is_ready,
            "supported_emotions": sorted(EMOTION_INDEX.keys()),
            "categories": [c.value for c in StrategyCategory],
        }

    # ── internal ────────────────────────────────────────

    def _rule_filter(
        self, emotion: str, intensity: float, excluded: set
    ) -> List[CopingStrategy]:
        """Return strategies matching emotion and intensity band."""
        all_for_emotion = get_strategies_for_emotion(emotion)
        return [
            s for s in all_for_emotion
            if s.id not in excluded
            and s.min_intensity <= intensity <= s.max_intensity
        ]

    @staticmethod
    def _fallback_emotions(emotion: str) -> List[str]:
        """Nearby emotions to widen candidate pool."""
        fallbacks = {
            "sadness": ["stress", "anxiety"],
            "anxiety": ["stress", "sadness"],
            "stress": ["anxiety", "sadness"],
            "anger": ["stress", "anxiety"],
            "happiness": ["neutral"],
            "neutral": ["happiness", "stress"],
            "fear": ["anxiety", "stress"],
            "disgust": ["anger"],
            "surprise": ["anxiety"],
            "trust": ["happiness"],
            "anticipation": ["anxiety", "happiness"],
        }
        return fallbacks.get(emotion, ["stress"])

    def _composite_score(
        self,
        strat: CopingStrategy,
        emotion: str,
        intensity: float,
        ml_score: float,
        preferred_categories: Optional[List[str]],
        context: Dict,
    ) -> float:
        """Blend rule‑based base score with ML prediction."""
        # Rule‑based component (0‑1)
        rule_score = strat.effectiveness_base

        # Intensity‑fit bonus: reward strategies whose sweet‑spot matches
        mid = (strat.min_intensity + strat.max_intensity) / 2
        range_half = (strat.max_intensity - strat.min_intensity) / 2 + 0.01
        fit = 1.0 - abs(intensity - mid) / range_half
        fit = max(0.0, min(1.0, fit))
        rule_score += 0.1 * fit

        # Feedback hit‑rate bonus
        hr = self.feedback.hit_rate(strat.id)
        if hr is not None:
            rule_score += 0.15 * hr

        # Preference boost
        if preferred_categories and strat.category.value in preferred_categories:
            rule_score += 0.1

        # High‑intensity → prefer quick + easy strategies
        if intensity > 0.7:
            if strat.duration_minutes <= 3 and strat.difficulty == 1:
                rule_score += 0.08

        # Session‑depth: later turns → suggest deeper strategies
        turns = context.get("session_turns", 0)
        if turns > 5 and strat.difficulty >= 2:
            rule_score += 0.05

        # Blend: when ML ranker has data, let it contribute 40 %
        if self.ranker.is_ready:
            score = 0.6 * rule_score + 0.4 * ml_score
        else:
            score = rule_score

        # Small random jitter to avoid identical orderings every request
        score += random.uniform(0, 0.03)

        return score

    @staticmethod
    def _diverse_select(
        scored: List[Tuple[float, CopingStrategy]], top_k: int
    ) -> List[Tuple[float, CopingStrategy]]:
        """Pick top‑k ensuring no more than 2 from the same category."""
        selected: List[Tuple[float, CopingStrategy]] = []
        cat_count: Dict[str, int] = defaultdict(int)

        for score, strat in scored:
            cat = strat.category.value
            if cat_count[cat] >= 2:
                continue
            selected.append((score, strat))
            cat_count[cat] += 1
            if len(selected) >= top_k:
                break

        return selected

    def _format_recommendation(
        self, strat: CopingStrategy, score: float,
        emotion: str, intensity: float,
    ) -> Dict:
        band = _intensity_band(intensity)
        return {
            "strategy_id": strat.id,
            "title": strat.title,
            "description": strat.description,
            "category": strat.category.value,
            "duration_minutes": strat.duration_minutes,
            "difficulty": strat.difficulty,
            "evidence_tags": strat.evidence_tags,
            "relevance_score": round(score, 3),
            "match_reason": f"Recommended for {emotion} at {band.value} intensity",
        }

    def _retrain(self) -> None:
        """Retrain ML ranker in a background thread."""
        X, y = self.feedback.as_training_data()
        if len(X) < MLRanker.MIN_SAMPLES:
            return

        def _train():
            try:
                self.ranker.train(X, y)
            except Exception as e:
                logger.error("ML ranker training failed: %s", e)

        threading.Thread(target=_train, daemon=True).start()
