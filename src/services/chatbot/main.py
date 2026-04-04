"""
FastAPI Chatbot Backend Service

Mental health support chatbot with emotion detection,
crisis escalation, and empathetic response generation.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import requests
import logging
from datetime import datetime, timezone
import os
import sys

# Load .env from project root (three levels up from chatbot/)
from dotenv import load_dotenv
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
load_dotenv(os.path.join(_project_root, ".env"))

# Add current directory to path for local imports
sys.path.insert(0, os.path.dirname(__file__))

try:
    from crisis_detector import CrisisDetector, CrisisLevel
    from response_generator import ResponseGenerator
    from conversation_manager import ConversationManager
    from intent_detector import IntentDetector
    from system_prompt import strategies_for, CRISIS_HELPLINES
    from knowledge_base import KnowledgeBase
    from memory_store import MemoryStore
except ImportError:
    from .crisis_detector import CrisisDetector, CrisisLevel
    from .response_generator import ResponseGenerator
    from .conversation_manager import ConversationManager
    from .intent_detector import IntentDetector
    from .system_prompt import strategies_for, CRISIS_HELPLINES
    from .knowledge_base import KnowledgeBase
    from .memory_store import MemoryStore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger('huggingface_hub.utils._http').setLevel(logging.ERROR)

# Initialize FastAPI app
app = FastAPI(
    title="MindSafe Chatbot Service",
    description="Mental health support chatbot with emotion detection",
    version="1.0.0"
)

# Configuration
EMOTION_SERVICE_URL = os.getenv("EMOTION_SERVICE_URL", "http://localhost:8001")
EMOTION_SERVICE_TIMEOUT_SECONDS = float(os.getenv("EMOTION_SERVICE_TIMEOUT_SECONDS", "4.0"))
USE_EXTERNAL_EMOTION_SERVICE = os.getenv("USE_EXTERNAL_EMOTION_SERVICE", "false").lower() == "true"
USE_NLP_CRISIS_CLASSIFIER = os.getenv("USE_NLP_CRISIS_CLASSIFIER", "true").lower() == "true"
RECOMMENDATION_SERVICE_URL = os.getenv("RECOMMENDATION_SERVICE_URL", "http://localhost:8005")
RECOMMENDATION_TIMEOUT_SECONDS = float(os.getenv("RECOMMENDATION_TIMEOUT_SECONDS", "3.0"))
MAX_CONVERSATION_HISTORY = 50
SESSION_TIMEOUT_HOURS = 24

# Initialize components
crisis_detector = CrisisDetector(enable_nlp=USE_NLP_CRISIS_CLASSIFIER)
response_generator = ResponseGenerator()
intent_detector = IntentDetector()
conversation_manager = ConversationManager(
    max_history=MAX_CONVERSATION_HISTORY,
    session_timeout_hours=SESSION_TIMEOUT_HOURS
)

# v3 — RAG knowledge base and long-term memory
knowledge_base = KnowledgeBase()
memory_store = MemoryStore()

# HTTP session for emotion service
emotion_service_session = requests.Session()
emotion_service_session.headers.update({"Content-Type": "application/json"})


# ==================== Pydantic Models ====================

class ChatMessage(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    style: Optional[str] = "balanced"
    user_name: Optional[str] = "friend"
    use_name: Optional[bool] = True
    use_memory: Optional[bool] = True


class ChatResponse(BaseModel):
    session_id: str
    message_id: str
    response: str
    emotion_detected: str
    emotional_intensity: float
    crisis_level: str
    crisis_resources: Optional[List[Dict]] = None
    coping_strategies: Optional[List[str]] = None
    requires_escalation: bool
    timestamp: str
    # v2 enrichments
    intent: Optional[str] = None
    strategy: Optional[str] = None
    depth_level: Optional[int] = None
    emotion_trend: Optional[str] = None
    quality_score: Optional[float] = None


class SessionInfo(BaseModel):
    session_id: str
    user_id: str
    created_at: str
    status: str
    message_count: int
    primary_emotions: List[str] = []
    crisis_detected: bool = False


class ConversationData(BaseModel):
    session_id: str
    user_id: str
    message_count: int
    duration_minutes: float
    emotions_detected: List[str]
    crisis_detected: bool
    status: str
    messages: List[Dict]


# ==================== Helper Functions ====================

async def call_emotion_service(text: str) -> Optional[Dict]:
    """Call emotion detection service and parse response"""
    try:
        response = emotion_service_session.post(
            f"{EMOTION_SERVICE_URL}/analyze",
            json={"text": text},
            timeout=(1.5, EMOTION_SERVICE_TIMEOUT_SECONDS)
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.warning(f"Emotion service unavailable, using fallback emotion mode: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing emotion response: {e}")
        return None


async def call_recommendation_service(
    emotion: str,
    intensity: float,
    session_turns: int = 0,
    excluded_ids: Optional[List[str]] = None,
) -> Optional[List[str]]:
    """Fetch personalised coping strategies from the recommendation service.
    Falls back to None so the chatbot can use its local strategies."""
    try:
        payload = {
            "emotion": emotion,
            "intensity": intensity,
            "top_k": 4,
            "excluded_ids": excluded_ids or [],
            "context": {"session_turns": session_turns},
        }
        response = emotion_service_session.post(
            f"{RECOMMENDATION_SERVICE_URL}/recommend",
            json=payload,
            timeout=(1.0, RECOMMENDATION_TIMEOUT_SECONDS),
        )
        response.raise_for_status()
        data = response.json()
        recs = data.get("recommendations", [])
        return [f"{r['title']}: {r['description']}" for r in recs] if recs else None
    except requests.exceptions.RequestException as e:
        logger.warning(f"Recommendation service unavailable, using local fallback: {e}")
        return None
    except Exception as e:
        logger.error(f"Error calling recommendation service: {e}")
        return None


def extract_emotion_data(emotion_response: Dict) -> tuple:
    """Extract emotion and intensity from emotion service response"""
    try:
        emotion_obj = emotion_response.get("emotion", {})
        if isinstance(emotion_obj, dict):
            emotion = emotion_obj.get("emotion", "neutral")
            intensity = emotion_obj.get("confidence", 0.5)
        else:
            emotion = emotion_response.get("emotion", "neutral")
            intensity = 0.5
        
        return emotion, intensity
    except Exception as e:
        logger.warning(f"Error extracting emotion data: {e}")
        return "neutral", 0.5


def infer_emotion_heuristic(text: str) -> tuple:
    """Fast lexical fallback for better accuracy on mental-health phrasing."""
    lowered = (text or "").lower()

    mapping = {
        "stress": ["stressed", "overwhelmed", "burnout", "too much", "pressure", "exams", "deadline", "cannot handle", "can't handle", "handle this anymore"],
        "anxiety": ["anxious", "panic", "worried", "can't stop thinking", "nervous", "fear", "scared"],
        "sadness": ["sad", "empty", "hopeless", "cry", "down", "depressed", "worthless", "numb", "hate myself", "hate me", "hate this", "not well", "not okay", "not good", "not fine", "unwell"],
        "loneliness": ["lonely", "alone", "isolated", "nobody understands", "no one cares", "disconnected", "left out"],
        "frustration": ["frustrated", "stuck", "nothing works", "give up", "pointless", "so done", "fed up", "sick of"],
        "anger": ["angry", "furious", "mad", "irritated", "annoyed"],
        "happiness": ["happy", "grateful", "excited", "good", "better", "relieved", "joy", "proud", "great news", "amazing", "awesome", "wonderful", "passed", "succeeded", "celebrate", "thrilled"],
    }

    scores = {k: 0 for k in mapping}
    for emotion, keywords in mapping.items():
        for word in keywords:
            if word in lowered:
                # Multi-word phrases are more specific, give them extra weight
                scores[emotion] += 2 if " " in word else 1

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "neutral", 0.45

    intensity = min(0.92, 0.55 + 0.12 * scores[best])
    return best, intensity


# ==================== Event Handlers ====================

@app.on_event("startup")
async def startup_event():
    logger.info("MindSafe Chatbot Service starting...")
    logger.info(f"Emotion service URL: {EMOTION_SERVICE_URL}")
    logger.info(f"NLP crisis classifier enabled: {USE_NLP_CRISIS_CLASSIFIER}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("MindSafe Chatbot Service shutting down")


# ==================== API Endpoints ====================

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "chatbot",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }


@app.post("/conversation/new", response_model=SessionInfo)
async def create_conversation(user_id: str = "anonymous"):
    try:
        session_id = conversation_manager.create_session(user_id)
        session = conversation_manager.get_session(session_id)
        
        return SessionInfo(
            session_id=session.session_id,
            user_id=session.user_id,
            created_at=session.created_at,
            status=session.status,
            message_count=0,
            primary_emotions=[],
            crisis_detected=False
        )
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")


@app.post("/chat", response_model=ChatResponse)
async def send_message(message: ChatMessage):
    try:
        # ── 1. Session ──────────────────────────────────
        if message.session_id:
            session = conversation_manager.get_session(message.session_id)
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            session_id = message.session_id
        else:
            session_id = conversation_manager.create_session("anonymous")

        # ── 2. Intent Detection ─────────────────────────
        intent_result = intent_detector.detect(message.content)
        user_intent = intent_result.intent

        # ── 3. Emotion Detection (heuristic + optional external) ──
        heuristic_emotion, heuristic_intensity = infer_emotion_heuristic(message.content)
        emotion, intensity = heuristic_emotion, heuristic_intensity

        if USE_EXTERNAL_EMOTION_SERVICE and heuristic_emotion == "neutral":
            emotion_response = await call_emotion_service(message.content)
            if emotion_response:
                model_emotion, model_intensity = extract_emotion_data(emotion_response)
                emotion, intensity = model_emotion, model_intensity

        # ── 4. Crisis Detection ─────────────────────────
        crisis_result = crisis_detector.detect(message.content, emotion)

        crisis_level_enum = crisis_result.get('crisis_level', CrisisLevel.LOW)
        crisis_level = crisis_level_enum.value if hasattr(crisis_level_enum, 'value') else str(crisis_level_enum)
        requires_escalation = crisis_result.get('requires_escalation', False) or crisis_level == "high"
        crisis_alert = crisis_result.get('crisis_alert', False)

        crisis_resources = []
        if crisis_alert:
            crisis_resources = crisis_result.get('helplines', [])

        # ── 5. Strategy Selection ───────────────────────
        depth_level = conversation_manager.get_depth(session_id)
        strategy_pool = strategies_for(user_intent, emotion)
        # Avoid repeating the last strategy when possible
        last_strat = conversation_manager.last_strategy(session_id)
        chosen_strategy = strategy_pool[0]
        if last_strat and last_strat == chosen_strategy and len(strategy_pool) > 1:
            chosen_strategy = strategy_pool[1]

        # ── 6. RAG + Memory Context ────────────────────────
        rag_docs = knowledge_base.query(message.content, emotion=emotion, top_k=3)
        rag_context = ""
        if rag_docs:
            rag_context = "\n".join(
                f"- [{d['category']}] {d['title']}: {d['text']}" for d in rag_docs
            )

        user_id = "anonymous"
        if message.session_id:
            sess = conversation_manager.get_session(message.session_id)
            if sess:
                user_id = sess.user_id
        memory_context = memory_store.build_memory_context(user_id)

        # ── 7. Response Generation ──────────────────────
        recent_context = conversation_manager.get_recent_context(session_id)
        response_text = response_generator.generate(
            emotion=emotion,
            crisis_level=crisis_level,
            user_message=message.content,
            conversation_history=recent_context,
            intensity=intensity,
            style=message.style or "balanced",
            user_name=message.user_name or "friend",
            use_name=message.use_name is not False,
            use_memory=message.use_memory is not False,
            intent=user_intent,
            strategy=chosen_strategy,
            depth_level=depth_level,
            rag_context=rag_context,
            memory_context=memory_context,
        )

        # ── 8. Quality Scoring ──────────────────────────
        score_info = ResponseGenerator.score_response(response_text, emotion, message.content)
        quality_score = score_info.get("overall", 0.0)

        # ── 9. Coping Strategies ────────────────────────
        coping_strategies = None
        if not crisis_alert:
            session = conversation_manager.get_session(session_id)
            turn_count = len(session.messages) if session else 0
            coping_strategies = await call_recommendation_service(
                emotion, intensity, session_turns=turn_count
            )
            if coping_strategies is None:
                coping_strategies = response_generator.generate_coping_suggestions(emotion, intensity)

        # ── 10. Persist Messages ────────────────────────
        msg_id = datetime.now(timezone.utc).isoformat()
        conversation_manager.add_message(
            session_id=session_id,
            role="user",
            content=message.content,
            emotion=emotion,
            intensity=intensity,
            crisis_level=crisis_level,
            intent=user_intent,
        )

        conversation_manager.add_message(
            session_id=session_id,
            role="assistant",
            content=response_text,
            crisis_level=crisis_level,
            strategy_used=chosen_strategy,
        )

        emotion_trend = conversation_manager.get_emotion_trend(session_id)
        depth_level = conversation_manager.get_depth(session_id)

        # ── 11. Return Response ─────────────────────────
        return ChatResponse(
            session_id=session_id,
            message_id=msg_id,
            response=response_text,
            emotion_detected=emotion,
            emotional_intensity=round(intensity, 2),
            crisis_level=crisis_level,
            crisis_resources=crisis_resources if crisis_alert else None,
            coping_strategies=coping_strategies,
            requires_escalation=requires_escalation,
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            intent=user_intent,
            strategy=chosen_strategy,
            depth_level=depth_level,
            emotion_trend=emotion_trend,
            quality_score=quality_score,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing message")


@app.get("/conversation/{session_id}", response_model=ConversationData)
async def get_conversation(session_id: str):
    try:
        session = conversation_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        history = conversation_manager.get_session_history(session_id)
        summary = conversation_manager.get_session_summary(session_id)
        
        return ConversationData(
            session_id=session_id,
            user_id=session.user_id,
            message_count=summary.get('message_count', 0),
            duration_minutes=summary.get('duration_minutes', 0),
            emotions_detected=summary.get('emotions_detected', []),
            crisis_detected=summary.get('crisis_detected', False),
            status=summary.get('status', 'active'),
            messages=history
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving conversation: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving conversation")


@app.post("/conversation/{session_id}/close")
async def close_conversation(session_id: str, notes: str = ""):
    try:
        session = conversation_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Generate LLM summary and save to long-term memory
        llm_summary = conversation_manager.generate_llm_session_summary(session_id)
        if llm_summary:
            memory_store.save_session_summary(
                user_id=session.user_id,
                session_id=session_id,
                summary=llm_summary,
                emotions=session.primary_emotions,
                strategies_used=session.strategies_used,
            )

        conversation_manager.close_session(session_id, notes)
        summary = conversation_manager.get_session_summary(session_id)
        
        return {
            "status": "closed",
            "session_id": session_id,
            "summary": summary,
            "llm_summary": llm_summary,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing session: {e}")
        raise HTTPException(status_code=500, detail="Error closing session")


@app.get("/stats")
async def service_stats():
    return {
        "service": "chatbot",
        "status": "operational",
        "active_sessions": len([s for s in conversation_manager.sessions.values() if s.status == "active"]),
        "total_sessions": len(conversation_manager.sessions),
        "total_users": len(conversation_manager.user_sessions),
        "max_conversation_history": MAX_CONVERSATION_HISTORY,
        "session_timeout_hours": SESSION_TIMEOUT_HOURS,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8004,
        reload=False
    )
