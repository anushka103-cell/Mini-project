"""
MindSafe Knowledge Base — RAG Module

Curated CBT, DBT, mindfulness, and self-care techniques stored in a
ChromaDB vector store.  At startup the knowledge base seeds itself from
an in-memory library (no external files required).

Usage:
    kb = KnowledgeBase()          # seeds on first call
    docs = kb.query("I feel anxious about exams", emotion="anxiety", top_k=3)
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────
#  Curated technique library
# ────────────────────────────────────────────────────────

TECHNIQUES: list[dict] = [
    # ── CBT (Cognitive Behavioural Therapy) ──────────────
    {
        "id": "cbt-thought-record",
        "title": "Thought Record",
        "category": "CBT",
        "emotions": ["anxiety", "sadness", "stress"],
        "text": (
            "Thought Record: When a distressing thought appears, write down "
            "the situation, the automatic thought, the emotion it triggered, "
            "evidence for and against the thought, and a balanced alternative. "
            "This helps you see that thoughts are not facts."
        ),
    },
    {
        "id": "cbt-cognitive-distortions",
        "title": "Identifying Cognitive Distortions",
        "category": "CBT",
        "emotions": ["anxiety", "sadness", "frustration"],
        "text": (
            "Common cognitive distortions include catastrophizing (imagining "
            "the worst), all-or-nothing thinking, mind-reading, and "
            "emotional reasoning. Recognizing the distortion is the first "
            "step toward challenging it."
        ),
    },
    {
        "id": "cbt-behavioural-activation",
        "title": "Behavioural Activation",
        "category": "CBT",
        "emotions": ["sadness", "loneliness"],
        "text": (
            "Behavioural Activation: Depression and sadness often reduce "
            "activity, which deepens low mood. Schedule small, achievable "
            "pleasant activities each day — a short walk, cooking a meal, "
            "calling a friend — to gradually rebuild engagement and pleasure."
        ),
    },
    {
        "id": "cbt-socratic-questioning",
        "title": "Socratic Questioning",
        "category": "CBT",
        "emotions": ["anxiety", "stress", "frustration"],
        "text": (
            "Socratic Questioning: Ask yourself — What evidence supports "
            "this thought? What evidence contradicts it? Is there an "
            "alternative explanation? What would I tell a friend in this "
            "situation? This helps loosen rigid thinking patterns."
        ),
    },
    {
        "id": "cbt-exposure-hierarchy",
        "title": "Gradual Exposure",
        "category": "CBT",
        "emotions": ["anxiety"],
        "text": (
            "Gradual Exposure: List feared situations from least to most "
            "anxiety-provoking. Start with the easiest and gradually work "
            "up. Each successful exposure teaches your brain that the "
            "feared outcome is unlikely or manageable."
        ),
    },
    {
        "id": "cbt-decatastrophizing",
        "title": "Decatastrophizing",
        "category": "CBT",
        "emotions": ["anxiety", "stress"],
        "text": (
            "Decatastrophizing: Ask — What is the worst that could happen? "
            "How likely is it? What is the best that could happen? What is "
            "the most realistic outcome? This pulls the mind away from "
            "worst-case fixation."
        ),
    },

    # ── DBT (Dialectical Behaviour Therapy) ─────────────
    {
        "id": "dbt-tipp",
        "title": "TIPP Skills for Crisis",
        "category": "DBT",
        "emotions": ["anger", "anxiety", "stress"],
        "text": (
            "TIPP: Temperature (hold ice or splash cold water on your face "
            "to activate the dive reflex), Intense exercise (60 seconds of "
            "jumping jacks), Paced breathing (exhale longer than inhale), "
            "Progressive muscle relaxation. TIPP is designed to bring down "
            "extreme emotional arousal fast."
        ),
    },
    {
        "id": "dbt-wise-mind",
        "title": "Wise Mind",
        "category": "DBT",
        "emotions": ["frustration", "anger", "stress"],
        "text": (
            "Wise Mind: Imagine two circles overlapping — one is your "
            "Emotion Mind (reactive, impulsive), the other is your "
            "Reasonable Mind (logical, cold). The overlap is Wise Mind — "
            "it honours your feelings AND your rational knowing. Before "
            "acting, pause and ask: what would my Wise Mind say?"
        ),
    },
    {
        "id": "dbt-radical-acceptance",
        "title": "Radical Acceptance",
        "category": "DBT",
        "emotions": ["sadness", "frustration", "anger"],
        "text": (
            "Radical Acceptance means fully acknowledging reality as it is "
            "— not approving of it, but stopping the fight against what "
            "you cannot change. Pain is inevitable; suffering is pain plus "
            "non-acceptance. Try saying: 'This is what is. I can cope.'"
        ),
    },
    {
        "id": "dbt-opposite-action",
        "title": "Opposite Action",
        "category": "DBT",
        "emotions": ["sadness", "anxiety", "anger"],
        "text": (
            "Opposite Action: When an emotion pushes you toward unhelpful "
            "behaviour (e.g., isolation when sad, avoidance when anxious), "
            "deliberately do the opposite. Sad? Reach out. Anxious? "
            "Approach the feared thing gently. This breaks the emotion's "
            "behavioural grip."
        ),
    },
    {
        "id": "dbt-distress-tolerance-accepts",
        "title": "ACCEPTS Distress Tolerance",
        "category": "DBT",
        "emotions": ["stress", "anxiety", "anger", "sadness"],
        "text": (
            "ACCEPTS: Activities (distract with tasks), Contributing "
            "(help someone else), Comparisons (recall times you coped), "
            "Emotions (watch something funny), Push away (mentally shelve "
            "the problem briefly), Thoughts (count, do a puzzle), "
            "Sensations (hold ice, snap a rubber band). Use when emotions "
            "are overwhelming and you need temporary relief."
        ),
    },

    # ── Mindfulness ──────────────────────────────────────
    {
        "id": "mindful-54321",
        "title": "5-4-3-2-1 Grounding",
        "category": "Mindfulness",
        "emotions": ["anxiety", "stress"],
        "text": (
            "5-4-3-2-1 Grounding: Notice 5 things you can see, 4 you can "
            "touch, 3 you can hear, 2 you can smell, 1 you can taste. "
            "This anchors you in the present moment and interrupts the "
            "anxiety spiral."
        ),
    },
    {
        "id": "mindful-body-scan",
        "title": "Body Scan Meditation",
        "category": "Mindfulness",
        "emotions": ["stress", "anxiety", "sadness"],
        "text": (
            "Body Scan: Lie down or sit comfortably. Starting from your "
            "toes, slowly move attention up through each body part. Notice "
            "tension without judging it. Breathe into tight areas. This "
            "develops body awareness and releases held stress."
        ),
    },
    {
        "id": "mindful-box-breathing",
        "title": "Box Breathing (4-4-4-4)",
        "category": "Mindfulness",
        "emotions": ["anxiety", "stress", "anger"],
        "text": (
            "Box Breathing: Inhale for 4 counts, hold for 4 counts, exhale "
            "for 4 counts, hold for 4 counts. Repeat 4-6 times. This "
            "activates the parasympathetic nervous system and calms the "
            "fight-or-flight response within minutes."
        ),
    },
    {
        "id": "mindful-leaves-on-stream",
        "title": "Leaves on a Stream",
        "category": "Mindfulness",
        "emotions": ["anxiety", "sadness", "stress"],
        "text": (
            "Leaves on a Stream: Visualize a gentle stream. Place each "
            "thought or worry onto a leaf and watch it float away. You're "
            "not suppressing thoughts — just observing them without getting "
            "swept into their current."
        ),
    },
    {
        "id": "mindful-self-compassion",
        "title": "Self-Compassion Break",
        "category": "Mindfulness",
        "emotions": ["sadness", "frustration", "loneliness"],
        "text": (
            "Self-Compassion Break: 1) Acknowledge the pain — 'This is a "
            "moment of suffering.' 2) Remember common humanity — 'Others "
            "feel this too.' 3) Offer kindness — place a hand on your "
            "heart and say 'May I be kind to myself right now.'"
        ),
    },

    # ── Emotional regulation ─────────────────────────────
    {
        "id": "er-emotion-naming",
        "title": "Name It to Tame It",
        "category": "Emotional Regulation",
        "emotions": ["anxiety", "anger", "sadness", "frustration", "stress"],
        "text": (
            "Name It to Tame It: Research shows that simply labelling an "
            "emotion ('I notice I'm feeling anxious') reduces amygdala "
            "activation. The more precise the label, the more calming the "
            "effect. Try expanding beyond 'bad' to the specific feeling."
        ),
    },
    {
        "id": "er-emotional-surfing",
        "title": "Urge Surfing",
        "category": "Emotional Regulation",
        "emotions": ["anger", "frustration", "stress"],
        "text": (
            "Urge Surfing: An emotion or craving is like a wave — it "
            "builds, peaks, and naturally subsides. Instead of acting on "
            "the urge, observe it with curiosity. Note where you feel it "
            "in your body. Ride the wave; it typically peaks in 15-20 "
            "minutes and then fades."
        ),
    },

    # ── Self-care & resilience ───────────────────────────
    {
        "id": "sc-sleep-hygiene",
        "title": "Sleep Hygiene Basics",
        "category": "Self-Care",
        "emotions": ["stress", "anxiety", "sadness"],
        "text": (
            "Good sleep hygiene: Keep a consistent wake time. Avoid screens "
            "30 min before bed. Keep the room cool and dark. Use the bed "
            "only for sleep. If you can't sleep after 20 min, get up and "
            "do something calm until drowsy. Sleep is foundational to "
            "emotional regulation."
        ),
    },
    {
        "id": "sc-social-connection",
        "title": "Micro-Connection Strategy",
        "category": "Self-Care",
        "emotions": ["loneliness", "sadness"],
        "text": (
            "Micro-Connection: You don't need deep conversations to feel "
            "less alone. Start small — smile at a stranger, text someone "
            "'thinking of you', join an online forum about a hobby. Small "
            "doses of connection rebuild the social muscle gradually."
        ),
    },
    {
        "id": "sc-gratitude-journal",
        "title": "Gratitude Journaling",
        "category": "Self-Care",
        "emotions": ["sadness", "stress", "neutral"],
        "text": (
            "Gratitude Journal: Each evening, write three specific things "
            "you're grateful for and why. Research shows this shifts "
            "attention from threat to reward circuits over 2-3 weeks. "
            "Specificity matters — 'my friend checked on me' beats 'family'."
        ),
    },
    {
        "id": "sc-movement",
        "title": "Movement as Medicine",
        "category": "Self-Care",
        "emotions": ["sadness", "stress", "anxiety", "anger", "frustration"],
        "text": (
            "Even 10 minutes of moderate movement — a brisk walk, dancing "
            "to a song, stretching — releases endorphins and lowers "
            "cortisol. You don't need a gym; movement is medicine at any "
            "dose."
        ),
    },

    # ── Positive psychology ──────────────────────────────
    {
        "id": "pp-strengths-spotting",
        "title": "Strengths Spotting",
        "category": "Positive Psychology",
        "emotions": ["sadness", "frustration", "loneliness"],
        "text": (
            "Strengths Spotting: Think of a recent challenge you navigated. "
            "What personal strengths did you use — patience, creativity, "
            "perseverance, humour? Recognizing these builds self-efficacy "
            "and counters the inner critic."
        ),
    },
    {
        "id": "pp-best-possible-self",
        "title": "Best Possible Self",
        "category": "Positive Psychology",
        "emotions": ["sadness", "stress", "neutral"],
        "text": (
            "Best Possible Self: Spend 5 minutes writing about your life "
            "in the future where everything has gone as well as it could. "
            "This exercise boosts optimism, clarifies goals, and has been "
            "shown to improve mood over repeated practice."
        ),
    },

    # ── Anger / frustration specific ─────────────────────
    {
        "id": "am-anger-iceberg",
        "title": "Anger Iceberg",
        "category": "Anger Management",
        "emotions": ["anger", "frustration"],
        "text": (
            "Anger Iceberg: Anger is the visible tip; underneath often lie "
            "hurt, fear, embarrassment, or feeling disrespected. Ask — "
            "'What is underneath my anger?' Addressing the deeper feeling "
            "is more effective than managing anger alone."
        ),
    },
    {
        "id": "am-cool-down-plan",
        "title": "Personal Cool-Down Plan",
        "category": "Anger Management",
        "emotions": ["anger"],
        "text": (
            "Personal Cool-Down Plan: Decide *in advance* what you'll do "
            "when anger spikes — walk away for 5 min, splash cold water on "
            "wrists, listen to a specific song. Having a pre-decided plan "
            "bypasses impulsive reactions."
        ),
    },

    # ── Loneliness specific ──────────────────────────────
    {
        "id": "ls-belonging-audit",
        "title": "Belonging Audit",
        "category": "Social Connection",
        "emotions": ["loneliness"],
        "text": (
            "Belonging Audit: List every group or community you're loosely "
            "part of — class, gym, online forum, neighbourhood. Choose one "
            "where you could show up more intentionally this week. "
            "Connection grows from presence, not perfection."
        ),
    },
    {
        "id": "ls-compassionate-letter",
        "title": "Compassionate Letter to Self",
        "category": "Social Connection",
        "emotions": ["loneliness", "sadness"],
        "text": (
            "Write a letter to yourself as if you were writing to a dear "
            "friend experiencing loneliness. What would you say? What would "
            "you remind them of? Then read it back to yourself. Self-"
            "compassion is a bridge until external connection strengthens."
        ),
    },

    # ── Happiness / positive states ──────────────────────
    {
        "id": "hp-savouring",
        "title": "Savouring Practice",
        "category": "Positive Psychology",
        "emotions": ["happiness"],
        "text": (
            "Savouring: When something good happens, deliberately slow "
            "down and absorb it. Describe it to yourself in detail. Share "
            "it with someone. This trains the brain to linger on positive "
            "experiences instead of rushing past them."
        ),
    },
    {
        "id": "hp-pay-it-forward",
        "title": "Pay It Forward",
        "category": "Positive Psychology",
        "emotions": ["happiness", "neutral"],
        "text": (
            "Capitalise on good feelings by doing something kind for "
            "someone else — it creates a positive feedback loop. A genuine "
            "compliment, holding a door, or buying a coffee for the next "
            "person in line keeps the momentum going."
        ),
    },
]


# ────────────────────────────────────────────────────────
#  KnowledgeBase class (ChromaDB-backed)
# ────────────────────────────────────────────────────────

class KnowledgeBase:
    """Singleton-ish RAG knowledge base backed by an in-process ChromaDB."""

    _instance: Optional["KnowledgeBase"] = None

    def __new__(cls) -> "KnowledgeBase":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._collection = None
        self._ready = False
        self._init_store()

    # ────────────────────────────────────────
    def _init_store(self):
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            persist_dir = os.getenv("CHROMA_PERSIST_DIR", "/tmp/mindsafe_chroma")
            self._client = chromadb.Client()  # in-memory, fast startup

            # Use sentence-transformers for embeddings
            ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )

            self._collection = self._client.get_or_create_collection(
                name="mindsafe_techniques",
                embedding_function=ef,
                metadata={"hnsw:space": "cosine"},
            )

            # Seed if empty
            if self._collection.count() == 0:
                self._seed()

            self._ready = True
            logger.info(
                "KnowledgeBase ready — %d techniques indexed", self._collection.count()
            )
        except Exception as e:
            logger.warning("KnowledgeBase init failed (will use fallback): %s", e)
            self._ready = False

    # ────────────────────────────────────────
    def _seed(self):
        ids = [t["id"] for t in TECHNIQUES]
        documents = [t["text"] for t in TECHNIQUES]
        metadatas = [
            {"title": t["title"], "category": t["category"], "emotions": ",".join(t["emotions"])}
            for t in TECHNIQUES
        ]
        self._collection.add(ids=ids, documents=documents, metadatas=metadatas)

    # ────────────────────────────────────────
    def query(
        self,
        user_message: str,
        emotion: str | None = None,
        top_k: int = 3,
    ) -> list[dict]:
        """
        Retrieve the most relevant techniques for the user's message.

        Returns list of dicts: [{title, category, text, relevance_score}]
        """
        if not self._ready or not self._collection:
            return self._fallback_query(emotion, top_k)

        try:
            # Build query text enriched with emotion for better semantic match
            query_text = user_message
            if emotion and emotion != "neutral":
                query_text = f"{emotion}: {user_message}"

            # Optional metadata filter to prefer emotion-matched docs
            where_filter = None
            if emotion and emotion != "neutral":
                where_filter = {"emotions": {"$contains": emotion}}

            results = self._collection.query(
                query_texts=[query_text],
                n_results=top_k,
                where=where_filter,
            )

            # If filter was too restrictive, retry without it
            if not results["documents"][0] and where_filter:
                results = self._collection.query(
                    query_texts=[query_text],
                    n_results=top_k,
                )

            docs = []
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                dist = results["distances"][0][i] if results["distances"] else 1.0
                docs.append({
                    "title": meta.get("title", ""),
                    "category": meta.get("category", ""),
                    "text": doc,
                    "relevance_score": round(1 - dist, 3),
                })
            return docs

        except Exception as e:
            logger.warning("ChromaDB query failed, using fallback: %s", e)
            return self._fallback_query(emotion, top_k)

    # ────────────────────────────────────────
    @staticmethod
    def _fallback_query(emotion: str | None, top_k: int) -> list[dict]:
        """Keyword-based fallback if ChromaDB is unavailable."""
        if not emotion or emotion == "neutral":
            subset = TECHNIQUES[:top_k]
        else:
            subset = [t for t in TECHNIQUES if emotion in t["emotions"]][:top_k]
            if not subset:
                subset = TECHNIQUES[:top_k]

        return [
            {
                "title": t["title"],
                "category": t["category"],
                "text": t["text"],
                "relevance_score": 0.5,
            }
            for t in subset
        ]
