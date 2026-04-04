"""
MindSafe Coping Strategy Recommendation Service

FastAPI microservice that provides personalised coping strategy
recommendations using a hybrid rule‑based + ML ranking system.

Port: 8005
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from recommendation_engine import RecommendationEngine
from strategy_library import (
    StrategyCategory,
    get_all_emotions,
    get_all_strategy_ids,
    get_strategies_for_emotion,
    get_strategy,
)

# ── Logging ──
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ──
app = FastAPI(
    title="MindSafe Recommendation Service",
    description="AI coping‑strategy recommendation engine (hybrid rule + ML)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Engine singleton ──
engine = RecommendationEngine()


# ════════════════════ Pydantic Models ════════════════════

class RecommendRequest(BaseModel):
    emotion: str = Field(..., description="Detected primary emotion", examples=["anxiety"])
    intensity: float = Field(0.5, ge=0.0, le=1.0, description="Emotional intensity 0‑1")
    top_k: int = Field(5, ge=1, le=20, description="Number of recommendations")
    excluded_ids: Optional[List[str]] = Field(None, description="Strategy IDs already shown this session")
    preferred_categories: Optional[List[str]] = Field(None, description="User's preferred strategy categories")
    context: Optional[Dict] = Field(None, description="Extra context, e.g. {\"session_turns\": 3}")


class RecommendResponse(BaseModel):
    emotion: str
    intensity: float
    intensity_band: str
    recommendations: List[Dict]
    engine_mode: str  # "rule" or "hybrid"
    timestamp: str


class FeedbackRequest(BaseModel):
    emotion: str
    intensity: float = Field(0.5, ge=0.0, le=1.0)
    strategy_id: str
    helpful: bool = Field(..., description="True = thumbs up, False = thumbs down")


class StrategyDetail(BaseModel):
    id: str
    title: str
    description: str
    category: str
    emotions: List[str]
    min_intensity: float
    max_intensity: float
    duration_minutes: int
    difficulty: int
    evidence_tags: List[str]


# ════════════════════ Endpoints ════════════════════

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "recommendation",
        "version": "1.0.0",
        "ml_ranker_active": engine.ranker.is_ready,
        "feedback_count": engine.feedback.size,
        "total_strategies": len(get_all_strategy_ids()),
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


@app.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest):
    """
    Get personalised coping strategy recommendations.

    The engine filters strategies by emotion + intensity, scores them
    using a composite rule + ML rank, and returns diverse results.
    """
    recs = engine.recommend(
        emotion=req.emotion,
        intensity=req.intensity,
        top_k=req.top_k,
        excluded_ids=req.excluded_ids,
        preferred_categories=req.preferred_categories,
        context=req.context,
    )

    band = "low" if req.intensity < 0.4 else ("moderate" if req.intensity < 0.7 else "high")
    return RecommendResponse(
        emotion=req.emotion,
        intensity=req.intensity,
        intensity_band=band,
        recommendations=recs,
        engine_mode="hybrid" if engine.ranker.is_ready else "rule",
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )


@app.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Record user feedback (helpful / not helpful) for a strategy."""
    if req.strategy_id not in {s for s in get_all_strategy_ids()}:
        raise HTTPException(status_code=404, detail=f"Unknown strategy: {req.strategy_id}")

    engine.record_feedback(
        emotion=req.emotion,
        intensity=req.intensity,
        strategy_id=req.strategy_id,
        helpful=req.helpful,
    )
    return {
        "status": "recorded",
        "strategy_id": req.strategy_id,
        "helpful": req.helpful,
        "total_feedback": engine.feedback.size,
    }


@app.get("/strategies", response_model=List[StrategyDetail])
async def list_strategies(
    emotion: Optional[str] = Query(None, description="Filter by emotion"),
    category: Optional[str] = Query(None, description="Filter by category"),
):
    """Browse the complete strategy library."""
    if emotion:
        strategies = get_strategies_for_emotion(emotion.lower())
    else:
        from strategy_library import STRATEGY_LIBRARY
        strategies = STRATEGY_LIBRARY

    if category:
        strategies = [s for s in strategies if s.category.value == category.lower()]

    return [
        StrategyDetail(
            id=s.id,
            title=s.title,
            description=s.description,
            category=s.category.value,
            emotions=s.emotions,
            min_intensity=s.min_intensity,
            max_intensity=s.max_intensity,
            duration_minutes=s.duration_minutes,
            difficulty=s.difficulty,
            evidence_tags=s.evidence_tags,
        )
        for s in strategies
    ]


@app.get("/strategies/{strategy_id}", response_model=StrategyDetail)
async def get_strategy_detail(strategy_id: str):
    """Get details for a single strategy."""
    strat = get_strategy(strategy_id)
    if strat is None:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    return StrategyDetail(
        id=strat.id,
        title=strat.title,
        description=strat.description,
        category=strat.category.value,
        emotions=strat.emotions,
        min_intensity=strat.min_intensity,
        max_intensity=strat.max_intensity,
        duration_minutes=strat.duration_minutes,
        difficulty=strat.difficulty,
        evidence_tags=strat.evidence_tags,
    )


@app.get("/emotions")
async def list_emotions():
    """List all emotions the system can recommend for."""
    return {"emotions": get_all_emotions()}


@app.get("/categories")
async def list_categories():
    """List all strategy categories."""
    return {"categories": [c.value for c in StrategyCategory]}


@app.get("/stats")
async def get_stats():
    """Engine statistics and diagnostics."""
    return engine.get_stats()


# ════════════════════ Run ════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8005"))
    uvicorn.run(app, host="0.0.0.0", port=port)
