"""Mood Tracking Backend Service (PostgreSQL + FastAPI).

Features:
- Daily mood logging
- Emotion trend analysis
- Weekly mental health score
- Visualization-ready data
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional
import os
import logging

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, Float, Integer, String, Text, and_, create_engine, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://mindsafe_user:change_me_in_production@localhost:5432/mindsafe_db",
)

app = FastAPI(
    title="MindSafe Mood Tracking Service",
    version="2.0.0",
    description="Daily mood logging, trend analytics, weekly score, and visualization data",
)


class Base(DeclarativeBase):
    pass


class MoodLog(Base):
    __tablename__ = "mood_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    logged_date: Mapped[date] = mapped_column(Date, index=True)
    mood_score: Mapped[int] = mapped_column(Integer)
    mood_label: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    emotion_scores: Mapped[Optional[Dict[str, float]]] = mapped_column(JSONB, nullable=True)
    activities: Mapped[Optional[List[str]]] = mapped_column(JSONB, nullable=True)
    triggers: Mapped[Optional[List[str]]] = mapped_column(JSONB, nullable=True)
    sleep_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exercise_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    time_of_day: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


engine = None
SessionLocal = None
logger = logging.getLogger(__name__)


def get_db() -> Session:
    if SessionLocal is None:
        raise HTTPException(status_code=500, detail="database is not initialized")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    global engine, SessionLocal
    if engine is not None and SessionLocal is not None:
        return

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=5,
        pool_recycle=1800,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@app.on_event("shutdown")
def shutdown_db() -> None:
    global engine
    if engine is not None:
        engine.dispose()
        logger.info("Database engine disposed")


class MoodLogRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    mood_score: int = Field(..., ge=1, le=10)
    mood_label: Optional[str] = Field(default=None, max_length=32)
    notes: Optional[str] = Field(default=None, max_length=5000)
    emotion_scores: Optional[Dict[str, float]] = None
    activities: Optional[List[str]] = None
    triggers: Optional[List[str]] = None
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    exercise_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    time_of_day: Optional[str] = None
    logged_at: Optional[datetime] = None


class MoodLogResponse(BaseModel):
    id: int
    user_id: str
    logged_date: date
    mood_score: int
    mood_label: Optional[str]
    notes: Optional[str]
    emotion_scores: Optional[Dict[str, float]]
    activities: Optional[List[str]] = None
    triggers: Optional[List[str]] = None
    sleep_hours: Optional[float] = None
    exercise_minutes: Optional[int] = None
    time_of_day: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TrendPoint(BaseModel):
    date: date
    avg_mood_score: float
    moving_avg_7d: Optional[float]


class EmotionTrend(BaseModel):
    emotion: str
    avg_score: float


class TrendAnalysisResponse(BaseModel):
    user_id: str
    window_days: int
    trend_direction: str
    slope: float
    points: List[TrendPoint]
    top_emotions: List[EmotionTrend]


class WeeklyScoreResponse(BaseModel):
    user_id: str
    week_start: date
    week_end: date
    entries_count: int
    average_mood: float
    consistency_ratio: float
    stability_score: float
    weekly_mental_health_score: float


class VisualizationResponse(BaseModel):
    user_id: str
    labels: List[str]
    mood_scores: List[float]
    moving_avg_7d: List[Optional[float]]
    weekly_scores: List[Dict[str, object]]
    emotion_series: Dict[str, List[float]]


def moving_average(values: List[float], window: int = 7) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    for i in range(len(values)):
        if i + 1 < window:
            out.append(None)
            continue
        segment = values[i + 1 - window : i + 1]
        out.append(round(float(np.mean(segment)), 3))
    return out


def compute_weekly_score(scores: List[int]) -> Dict[str, float]:
    if not scores:
        return {
            "average_mood": 0.0,
            "consistency_ratio": 0.0,
            "stability_score": 0.0,
            "weekly_mental_health_score": 0.0,
        }

    avg = float(np.mean(scores))
    std = float(np.std(scores))
    # Ratio of logged days in a 7-day window.
    consistency_ratio = min(1.0, len(scores) / 7.0)
    # Lower variance means more stability.
    stability_score = max(0.0, 1.0 - (std / 5.0))

    # Weighted score in range [0, 100].
    weekly_score = (avg / 10.0) * 70.0 + consistency_ratio * 20.0 + stability_score * 10.0

    return {
        "average_mood": round(avg, 3),
        "consistency_ratio": round(consistency_ratio, 3),
        "stability_score": round(stability_score, 3),
        "weekly_mental_health_score": round(max(0.0, min(100.0, weekly_score)), 2),
    }


@app.on_event("startup")
def startup() -> None:
    try:
        init_db()
        Base.metadata.create_all(bind=engine)
        # Backward-compatible migration: allow multiple entries on the same day.
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE mood_logs DROP CONSTRAINT IF EXISTS uq_mood_logs_user_day"))
            # Add new columns if they don't exist
            for col, coltype in [
                ("activities", "JSONB"),
                ("triggers", "JSONB"),
                ("sleep_hours", "DOUBLE PRECISION"),
                ("exercise_minutes", "INTEGER"),
                ("time_of_day", "VARCHAR(16)"),
            ]:
                conn.execute(text(
                    f"ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS {col} {coltype}"
                ))
    except Exception as exc:
        logger.error("failed to initialize database: %s", exc)
        raise


def _to_response(item: MoodLog) -> MoodLogResponse:
    return MoodLogResponse(
        id=item.id,
        user_id=item.user_id,
        logged_date=item.logged_date,
        mood_score=item.mood_score,
        mood_label=item.mood_label,
        notes=item.notes,
        emotion_scores=item.emotion_scores,
        activities=item.activities,
        triggers=item.triggers,
        sleep_hours=item.sleep_hours,
        exercise_minutes=item.exercise_minutes,
        time_of_day=item.time_of_day,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "mood_tracking"}


@app.post("/moods/log", response_model=MoodLogResponse)
def log_daily_mood(payload: MoodLogRequest, db: Session = Depends(get_db)) -> MoodLogResponse:
    logged_date = (payload.logged_at or datetime.now(timezone.utc)).date()

    try:
        item = MoodLog(
            user_id=payload.user_id,
            logged_date=logged_date,
            mood_score=payload.mood_score,
            mood_label=payload.mood_label,
            notes=payload.notes,
            emotion_scores=payload.emotion_scores,
            activities=payload.activities,
            triggers=payload.triggers,
            sleep_hours=payload.sleep_hours,
            exercise_minutes=payload.exercise_minutes,
            time_of_day=payload.time_of_day,
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        return _to_response(item)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"database error: {exc.__class__.__name__}")


@app.get("/moods/{user_id}/logs", response_model=List[MoodLogResponse])
def get_mood_logs(
    user_id: str,
    days: Optional[int] = Query(default=None, ge=1, le=365),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
) -> List[MoodLogResponse]:
    query = db.query(MoodLog).filter(MoodLog.user_id == user_id)

    if days is not None and start_date is None:
        start_date = date.today() - timedelta(days=days - 1)

    if start_date:
        query = query.filter(MoodLog.logged_date >= start_date)
    if end_date:
        query = query.filter(MoodLog.logged_date <= end_date)

    items = query.order_by(MoodLog.logged_date.desc(), MoodLog.id.desc()).limit(limit).all()

    return [_to_response(x) for x in items]


@app.get("/moods/{user_id}/trends", response_model=TrendAnalysisResponse)
def get_emotion_trend_analysis(
    user_id: str,
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
) -> TrendAnalysisResponse:
    start = date.today() - timedelta(days=days - 1)

    rows = (
        db.query(MoodLog.logged_date, func.avg(MoodLog.mood_score).label("avg_mood"))
        .filter(and_(MoodLog.user_id == user_id, MoodLog.logged_date >= start))
        .group_by(MoodLog.logged_date)
        .order_by(MoodLog.logged_date.asc())
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail="no mood data for selected period")

    labels = [r.logged_date for r in rows]
    values = [round(float(r.avg_mood), 3) for r in rows]
    ma7 = moving_average(values, 7)

    if len(values) >= 2:
        x = np.arange(len(values))
        slope = float(np.polyfit(x, np.array(values), 1)[0])
    else:
        slope = 0.0

    if slope > 0.03:
        trend_direction = "improving"
    elif slope < -0.03:
        trend_direction = "declining"
    else:
        trend_direction = "stable"

    emotion_agg: Dict[str, List[float]] = {}
    logs = (
        db.query(MoodLog)
        .filter(and_(MoodLog.user_id == user_id, MoodLog.logged_date >= start))
        .all()
    )
    for log in logs:
        if not log.emotion_scores:
            continue
        for emo, val in log.emotion_scores.items():
            try:
                emotion_agg.setdefault(emo, []).append(float(val))
            except Exception:
                continue

    top_emotions = sorted(
        [
            EmotionTrend(emotion=k, avg_score=round(float(np.mean(v)), 3))
            for k, v in emotion_agg.items()
            if v
        ],
        key=lambda e: e.avg_score,
        reverse=True,
    )[:5]

    return TrendAnalysisResponse(
        user_id=user_id,
        window_days=days,
        trend_direction=trend_direction,
        slope=round(slope, 6),
        points=[
            TrendPoint(date=labels[i], avg_mood_score=values[i], moving_avg_7d=ma7[i])
            for i in range(len(labels))
        ],
        top_emotions=top_emotions,
    )


@app.get("/moods/{user_id}/weekly-score", response_model=WeeklyScoreResponse)
def get_weekly_mental_health_score(
    user_id: str,
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
) -> WeeklyScoreResponse:
    start = week_start or (date.today() - timedelta(days=date.today().weekday()))
    end = start + timedelta(days=6)

    logs = (
        db.query(MoodLog)
        .filter(and_(MoodLog.user_id == user_id, MoodLog.logged_date >= start, MoodLog.logged_date <= end))
        .order_by(MoodLog.logged_date.asc())
        .all()
    )

    scores = [x.mood_score for x in logs]
    calc = compute_weekly_score(scores)

    return WeeklyScoreResponse(
        user_id=user_id,
        week_start=start,
        week_end=end,
        entries_count=len(scores),
        average_mood=calc["average_mood"],
        consistency_ratio=calc["consistency_ratio"],
        stability_score=calc["stability_score"],
        weekly_mental_health_score=calc["weekly_mental_health_score"],
    )


@app.get("/moods/{user_id}/visualization", response_model=VisualizationResponse)
def get_visualization_ready_data(
    user_id: str,
    days: int = Query(90, ge=14, le=365),
    db: Session = Depends(get_db),
) -> VisualizationResponse:
    start = date.today() - timedelta(days=days - 1)
    logs = (
        db.query(MoodLog)
        .filter(and_(MoodLog.user_id == user_id, MoodLog.logged_date >= start))
        .order_by(MoodLog.logged_date.asc())
        .all()
    )

    if not logs:
        raise HTTPException(status_code=404, detail="no mood data for selected period")

    labels = [x.logged_date.isoformat() for x in logs]
    mood_scores = [float(x.mood_score) for x in logs]
    ma7 = moving_average(mood_scores, 7)

    # Weekly buckets for chart cards/progress widgets
    week_map: Dict[str, List[int]] = {}
    for x in logs:
        wk = (x.logged_date - timedelta(days=x.logged_date.weekday())).isoformat()
        week_map.setdefault(wk, []).append(x.mood_score)

    weekly_scores = []
    for wk, vals in sorted(week_map.items()):
        calc = compute_weekly_score(vals)
        weekly_scores.append({
            "week_start": wk,
            "score": calc["weekly_mental_health_score"],
        })

    # Emotion timeseries normalized for charting.
    all_emotions = set()
    for x in logs:
        if x.emotion_scores:
            all_emotions.update(x.emotion_scores.keys())

    emotion_series: Dict[str, List[float]] = {emo: [] for emo in sorted(all_emotions)}
    for x in logs:
        for emo in emotion_series.keys():
            val = 0.0
            if x.emotion_scores and emo in x.emotion_scores:
                try:
                    val = float(x.emotion_scores[emo])
                except Exception:
                    val = 0.0
            emotion_series[emo].append(round(val, 4))

    return VisualizationResponse(
        user_id=user_id,
        labels=labels,
        mood_scores=[round(v, 3) for v in mood_scores],
        moving_avg_7d=ma7,
        weekly_scores=weekly_scores,
        emotion_series=emotion_series,
    )


# ---------------------------------------------------------------------------
# Delete a mood entry
# ---------------------------------------------------------------------------


class MoodUpdateRequest(BaseModel):
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    mood_label: Optional[str] = Field(default=None, max_length=32)
    notes: Optional[str] = Field(default=None, max_length=5000)
    emotion_scores: Optional[Dict[str, float]] = None
    activities: Optional[List[str]] = None
    triggers: Optional[List[str]] = None
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    exercise_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    time_of_day: Optional[str] = None


@app.delete("/moods/{mood_id}")
def delete_mood_entry(mood_id: int, user_id: str = Query(...), db: Session = Depends(get_db)):
    item = db.query(MoodLog).filter(MoodLog.id == mood_id, MoodLog.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="mood entry not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": mood_id}


@app.patch("/moods/{mood_id}", response_model=MoodLogResponse)
def update_mood_entry(
    mood_id: int,
    payload: MoodUpdateRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
) -> MoodLogResponse:
    item = db.query(MoodLog).filter(MoodLog.id == mood_id, MoodLog.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="mood entry not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return _to_response(item)


# ---------------------------------------------------------------------------
# Patterns: day-of-week and time-of-day analysis
# ---------------------------------------------------------------------------


@app.get("/moods/{user_id}/patterns")
def get_mood_patterns(
    user_id: str,
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db),
):
    start = date.today() - timedelta(days=days - 1)
    logs = (
        db.query(MoodLog)
        .filter(and_(MoodLog.user_id == user_id, MoodLog.logged_date >= start))
        .all()
    )
    if not logs:
        raise HTTPException(status_code=404, detail="no mood data for selected period")

    # Day-of-week averages
    dow_map: Dict[int, List[int]] = {}
    tod_map: Dict[str, List[int]] = {}
    activity_map: Dict[str, List[int]] = {}

    for log in logs:
        dow = log.logged_date.weekday()
        dow_map.setdefault(dow, []).append(log.mood_score)

        if log.time_of_day:
            tod_map.setdefault(log.time_of_day, []).append(log.mood_score)

        if log.activities:
            for act in log.activities:
                activity_map.setdefault(act, []).append(log.mood_score)

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_of_week = [
        {"day": day_names[i], "avg_mood": round(float(np.mean(dow_map[i])), 2), "count": len(dow_map[i])}
        for i in range(7)
        if i in dow_map
    ]

    time_of_day = [
        {"time": t, "avg_mood": round(float(np.mean(v)), 2), "count": len(v)}
        for t, v in sorted(tod_map.items())
    ]

    activity_correlation = sorted(
        [
            {"activity": act, "avg_mood": round(float(np.mean(v)), 2), "count": len(v)}
            for act, v in activity_map.items()
            if len(v) >= 2
        ],
        key=lambda x: x["avg_mood"],
        reverse=True,
    )[:10]

    return {
        "user_id": user_id,
        "window_days": days,
        "day_of_week": day_of_week,
        "time_of_day": time_of_day,
        "activity_correlation": activity_correlation,
    }


# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------


@app.get("/moods/{user_id}/streaks")
def get_mood_streaks(user_id: str, db: Session = Depends(get_db)):
    dates = (
        db.query(MoodLog.logged_date)
        .filter(MoodLog.user_id == user_id)
        .distinct()
        .order_by(MoodLog.logged_date.desc())
        .all()
    )
    if not dates:
        return {"user_id": user_id, "current_streak": 0, "longest_streak": 0, "total_entries": 0}

    unique_dates = sorted(set(d[0] for d in dates), reverse=True)
    total = (
        db.query(func.count(MoodLog.id))
        .filter(MoodLog.user_id == user_id)
        .scalar()
    )

    # Current streak (consecutive days ending today or yesterday)
    current_streak = 0
    check_date = date.today()
    if unique_dates[0] < check_date - timedelta(days=1):
        current_streak = 0
    else:
        if unique_dates[0] == check_date - timedelta(days=1):
            check_date = check_date - timedelta(days=1)
        for d in unique_dates:
            if d == check_date:
                current_streak += 1
                check_date -= timedelta(days=1)
            elif d < check_date:
                break

    # Longest streak
    sorted_asc = sorted(unique_dates)
    longest = 1
    current = 1
    for i in range(1, len(sorted_asc)):
        if (sorted_asc[i] - sorted_asc[i - 1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1

    return {
        "user_id": user_id,
        "current_streak": current_streak,
        "longest_streak": longest,
        "total_entries": total,
    }
