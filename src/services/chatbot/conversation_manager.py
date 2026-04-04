"""
Conversation Manager Module — v2

Manages conversation history, context, user profiles,
session tracking, **conversation depth**, and **emotional trajectory**
for the MindSafe AI Companion.
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field, asdict
import json
import uuid
import logging

from system_prompt import DEPTH_TURN_THRESHOLDS, DEPTH_LEVELS

# Suppress HF Hub warnings
logging.getLogger('huggingface_hub.utils._http').setLevel(logging.ERROR)


@dataclass
class Message:
    """Represents a single message in the conversation"""
    role: str  # "user" or "assistant"
    content: str
    timestamp: str
    emotion: Optional[str] = None
    intensity: Optional[float] = None
    crisis_level: Optional[str] = None
    intent: Optional[str] = None
    strategy_used: Optional[str] = None


@dataclass
class ConversationSession:
    """Represents a conversation session with depth tracking."""
    session_id: str
    user_id: str
    created_at: str
    last_updated: str
    messages: List[Message] = None
    status: str = "active"  # active, closed, needs_escalation
    primary_emotions: List[str] = None
    crisis_detected: bool = False
    notes: str = ""
    # ── v2 additions ──
    depth_level: int = 1                        # 1-4 per DEPTH_LEVELS
    emotion_trajectory: List[Dict] = None       # [{emotion, intensity, turn}]
    intent_history: List[str] = None            # last N intents
    strategies_used: List[str] = None           # anti-repetition for strategies
    user_turn_count: int = 0

    def __post_init__(self):
        if self.messages is None:
            self.messages = []
        if self.primary_emotions is None:
            self.primary_emotions = []
        if self.emotion_trajectory is None:
            self.emotion_trajectory = []
        if self.intent_history is None:
            self.intent_history = []
        if self.strategies_used is None:
            self.strategies_used = []


class ConversationManager:
    """
    Manages conversation history, context, and user sessions.
    Handles session tracking, context retrieval, and conversation analytics.
    """
    
    def __init__(self, max_history: int = 50, session_timeout_hours: int = 24):
        """
        Initialize conversation manager.
        
        Args:
            max_history (int): Maximum messages to keep per session
            session_timeout_hours (int): Session timeout duration
        """
        self.sessions: Dict[str, ConversationSession] = {}
        self.user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids]
        self.max_history = max_history
        self.session_timeout = timedelta(hours=session_timeout_hours)
        self.max_sessions = 1000  # Cap total in-memory sessions
    
    def create_session(self, user_id: str) -> str:
        """
        Create a new conversation session.
        
        Args:
            user_id (str): User identifier
            
        Returns:
            str: Session ID
        """
        # Purge expired/closed sessions before creating a new one
        self._cleanup_expired_sessions()

        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        session = ConversationSession(
            session_id=session_id,
            user_id=user_id,
            created_at=now,
            last_updated=now,
            messages=[],
            primary_emotions=[]
        )
        
        self.sessions[session_id] = session
        
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = []
        self.user_sessions[user_id].append(session_id)
        
        return session_id
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        emotion: Optional[str] = None,
        intensity: Optional[float] = None,
        crisis_level: Optional[str] = None,
        intent: Optional[str] = None,
        strategy_used: Optional[str] = None,
    ) -> Message:
        """
        Add a message to the conversation.  Updates depth level and
        emotional trajectory automatically for user turns.
        """
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        message = Message(
            role=role,
            content=content,
            timestamp=now,
            emotion=emotion,
            intensity=intensity,
            crisis_level=crisis_level,
            intent=intent,
            strategy_used=strategy_used,
        )
        
        session.messages.append(message)
        session.last_updated = now
        
        # Track emotions, crisis, depth — user turns only
        if role == "user":
            session.user_turn_count += 1
            if emotion:
                if emotion not in session.primary_emotions:
                    session.primary_emotions.append(emotion)
                session.emotion_trajectory.append({
                    "emotion": emotion,
                    "intensity": intensity or 0.5,
                    "turn": session.user_turn_count,
                })
            if intent:
                session.intent_history.append(intent)
                # keep the last 10
                session.intent_history = session.intent_history[-10:]

            # Auto-advance depth
            self._advance_depth(session)

        if role == "assistant" and strategy_used:
            session.strategies_used.append(strategy_used)
            session.strategies_used = session.strategies_used[-10:]

        if crisis_level in ["medium", "high"]:
            session.crisis_detected = True

        if crisis_level == "high":
            session.status = "needs_escalation"
        
        # Trim history if exceeds max
        if len(session.messages) > self.max_history:
            session.messages = session.messages[-self.max_history:]
        
        return message

    # ──────────────────────────────────────────────────────
    #  Depth management
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _advance_depth(session: ConversationSession) -> None:
        """Promote depth when user turn count hits the threshold."""
        current = session.depth_level
        if current >= 4:
            return
        next_level = current + 1
        threshold = DEPTH_TURN_THRESHOLDS.get(next_level, 999)
        if session.user_turn_count >= threshold:
            session.depth_level = next_level

    def get_depth(self, session_id: str) -> int:
        session = self.get_session(session_id)
        return session.depth_level if session else 1

    def get_depth_label(self, session_id: str) -> str:
        return DEPTH_LEVELS.get(self.get_depth(session_id), "surface")

    # ──────────────────────────────────────────────────────
    #  Emotional trajectory helpers
    # ──────────────────────────────────────────────────────
    def get_emotion_trend(self, session_id: str) -> str:
        """Return 'improving', 'worsening', or 'stable'."""
        session = self.get_session(session_id)
        if not session or len(session.emotion_trajectory) < 2:
            return "stable"
        recent = session.emotion_trajectory[-3:]
        intensities = [e["intensity"] for e in recent]
        delta = intensities[-1] - intensities[0]
        if delta < -0.15:
            return "improving"
        if delta > 0.15:
            return "worsening"
        return "stable"

    def dominant_emotion(self, session_id: str) -> Optional[str]:
        """Most frequent emotion across the session."""
        session = self.get_session(session_id)
        if not session or not session.emotion_trajectory:
            return None
        counts: Dict[str, int] = {}
        for e in session.emotion_trajectory:
            counts[e["emotion"]] = counts.get(e["emotion"], 0) + 1
        return max(counts, key=counts.get)  # type: ignore[arg-type]

    def last_strategy(self, session_id: str) -> Optional[str]:
        session = self.get_session(session_id)
        if not session or not session.strategies_used:
            return None
        return session.strategies_used[-1]
    
    def get_session(self, session_id: str) -> Optional[ConversationSession]:
        """Get a conversation session"""
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        
        # Check if session has timed out
        last_updated = datetime.fromisoformat(session.last_updated.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - last_updated > self.session_timeout:
            session.status = "closed"
        
        return session

    def _cleanup_expired_sessions(self) -> int:
        """Remove expired and closed sessions from memory. Returns count removed."""
        now = datetime.now(timezone.utc)
        to_remove = []
        for sid, session in self.sessions.items():
            last_updated = datetime.fromisoformat(session.last_updated.replace("Z", "+00:00"))
            if (now - last_updated > self.session_timeout) or session.status == "closed":
                to_remove.append(sid)

        # Also evict oldest sessions if we exceed the cap
        if len(self.sessions) - len(to_remove) > self.max_sessions:
            remaining = [(sid, s) for sid, s in self.sessions.items() if sid not in to_remove]
            remaining.sort(key=lambda x: x[1].last_updated)
            excess = len(remaining) - self.max_sessions
            to_remove.extend(sid for sid, _ in remaining[:excess])

        for sid in to_remove:
            session = self.sessions.pop(sid, None)
            if session:
                uid = session.user_id
                if uid in self.user_sessions:
                    self.user_sessions[uid] = [s for s in self.user_sessions[uid] if s != sid]
                    if not self.user_sessions[uid]:
                        del self.user_sessions[uid]

        return len(to_remove)
    
    def get_session_history(self, session_id: str, limit: int = None) -> List[Dict]:
        """
        Get conversation history for a session.
        
        Args:
            session_id (str): Session identifier
            limit (int): Maximum messages to return
            
        Returns:
            List[Dict]: Conversation history
        """
        session = self.get_session(session_id)
        if not session:
            return []
        
        messages = session.messages
        if limit:
            messages = messages[-limit:]
        
        return [asdict(msg) for msg in messages]
    
    def get_recent_context(self, session_id: str, turn_count: int = 4) -> str:
        """
        Get recent conversation context as formatted string.
        
        Args:
            session_id (str): Session identifier
            turn_count (int): Number of recent turns to include
            
        Returns:
            str: Formatted conversation context
        """
        history = self.get_session_history(session_id, limit=turn_count * 2)
        
        if not history:
            return ""
        
        context_lines = []
        for msg in history:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            context_lines.append(f"{role_label}: {msg['content']}")
        
        return "\n".join(context_lines)
    
    def close_session(self, session_id: str, notes: str = "") -> bool:
        """
        Close a conversation session.
        
        Args:
            session_id (str): Session identifier
            notes (str): Optional closing notes
            
        Returns:
            bool: Success status
        """
        if session_id not in self.sessions:
            return False
        
        session = self.sessions[session_id]
        session.status = "closed"
        session.notes = notes
        session.last_updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        return True
    
    def get_user_sessions(self, user_id: str) -> List[ConversationSession]:
        """
        Get all sessions for a user.
        
        Args:
            user_id (str): User identifier
            
        Returns:
            List[ConversationSession]: User's sessions
        """
        session_ids = self.user_sessions.get(user_id, [])
        return [self.sessions[sid] for sid in session_ids if sid in self.sessions]
    
    def get_session_summary(self, session_id: str) -> Dict:
        """
        Get a summary of the conversation session.
        
        Args:
            session_id (str): Session identifier
            
        Returns:
            Dict: Session summary
        """
        session = self.get_session(session_id)
        if not session:
            return {}
        
        # Calculate statistics
        user_messages = [m for m in session.messages if m.role == "user"]
        assistant_messages = [m for m in session.messages if m.role == "assistant"]
        
        emotion_counts = {}
        for msg in user_messages:
            if msg.emotion:
                emotion_counts[msg.emotion] = emotion_counts.get(msg.emotion, 0) + 1
        
        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "created_at": session.created_at,
            "duration_minutes": self._calculate_duration(session),
            "message_count": len(session.messages),
            "user_messages": len(user_messages),
            "assistant_messages": len(assistant_messages),
            "emotions_detected": session.primary_emotions,
            "emotion_distribution": emotion_counts,
            "crisis_detected": session.crisis_detected,
            "status": session.status,
            "notes": session.notes
        }
    
    @staticmethod
    def _calculate_duration(session: ConversationSession) -> float:
        """Calculate session duration in minutes"""
        start = datetime.fromisoformat(session.created_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(session.last_updated.replace("Z", "+00:00"))
        duration = (end - start).total_seconds() / 60
        return round(duration, 2)
    
    def generate_llm_session_summary(self, session_id: str) -> str:
        """
        Use Groq LLM to produce a concise natural-language summary of the
        session (for long-term memory storage).  Returns a plain fallback
        if the LLM is unavailable.
        """
        session = self.get_session(session_id)
        if not session or not session.messages:
            return ""

        # Build a transcript of user messages
        user_msgs = [m for m in session.messages if m.role == "user"]
        if not user_msgs:
            return ""

        transcript = "\n".join(
            f"- [{m.emotion or 'neutral'}] {m.content}" for m in user_msgs[-10:]
        )
        emotions = ", ".join(session.primary_emotions) or "neutral"

        # Try LLM
        import os
        groq_key = os.getenv("GROQ_API_KEY", "")
        if groq_key:
            try:
                from groq import Groq
                client = Groq(api_key=groq_key)
                resp = client.chat.completions.create(
                    model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "Summarise this mental-health support session in 2-3 sentences. "
                                "Include the main topics, emotions, and any techniques discussed. "
                                "Write in third person (e.g. 'The user discussed...'). Be concise."
                            ),
                        },
                        {
                            "role": "user",
                            "content": f"Session emotions: {emotions}\n\nUser messages:\n{transcript}",
                        },
                    ],
                    max_tokens=150,
                    temperature=0.5,
                )
                summary = resp.choices[0].message.content.strip()
                if summary:
                    return summary
            except Exception as e:
                logging.getLogger(__name__).warning("LLM summary failed: %s", e)

        # Fallback: simple rule-based summary
        return (
            f"Session covering {emotions}. "
            f"User sent {len(user_msgs)} messages over "
            f"{self._calculate_duration(session):.0f} minutes."
        )

    def export_session(self, session_id: str) -> Dict:
        """
        Export session data for analysis or backup.
        
        Args:
            session_id (str): Session identifier
            
        Returns:
            Dict: Complete session export
        """
        session = self.get_session(session_id)
        if not session:
            return {}
        
        return {
            "session": asdict(session),
            "summary": self.get_session_summary(session_id),
            "history": self.get_session_history(session_id),
            "export_timestamp": datetime.utcnow().isoformat() + "Z"
        }


if __name__ == "__main__":
    # Test conversation manager
    manager = ConversationManager()
    
    # Create session
    user_id = "user_123"
    session_id = manager.create_session(user_id)
    print(f"Created session: {session_id}\n")
    
    # Add messages
    manager.add_message(session_id, "user", "I'm feeling really sad today", emotion="sadness", intensity=0.8)
    manager.add_message(session_id, "assistant", "I hear you. That sounds tough.")
    manager.add_message(session_id, "user", "Everything feels pointless", emotion="sadness", intensity=0.9, crisis_level="high")
    manager.add_message(session_id, "assistant", "I'm concerned about your wellbeing. Let me provide resources.")
    
    # Get summary
    summary = manager.get_session_summary(session_id)
    print("Session Summary:")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    
    # Get history
    print("\nConversation History:")
    for msg in manager.get_session_history(session_id):
        print(f"{msg['role'].upper()}: {msg['content']}")
