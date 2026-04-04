"""
MindSafe AI Companion — Intent Detection Engine

Detects the user's conversational intent from the raw text so the
response generator can pick the right conversation strategy.
"""

import re
from dataclasses import dataclass, field

# ─── Intent definitions ────────────────────────────────
INTENT_KEYWORDS: dict[str, list[str]] = {
    "emotional_venting": [
        "i can't take",  "i can't handle", "i'm so done",
        "i'm tired of", "sick of", "i hate", "i'm fed up",
        "i just need to vent", "letting it out", "so frustrated",
        "i'm exhausted", "i can't anymore", "overwhelmed",
        "breaking down", "falling apart", "losing it",
    ],
    "seeking_advice": [
        "what should i", "how do i", "any tips",
        "can you suggest", "what can i do", "help me with",
        "advice", "recommend", "i need help with",
        "how to deal", "what would you", "guide me",
        "strategies for", "ways to", "can you give",
        "give me some", "give me", "things to",
        "tell me some", "some tips", "some ways",
        "suggestions", "help me relax", "help me calm",
        "help me cope", "help me sleep", "help me focus",
        "what helps", "something to help", "anything to help",
        "techniques", "exercises", "methods",
    ],
    "reflection": [
        "i've been thinking", "looking back", "i realize",
        "i noticed that", "it occurred to me", "reflecting on",
        "i understand now", "makes me wonder", "come to think",
        "it hit me that", "i've learned", "i see now",
    ],
    "reassurance": [
        "am i okay", "is it normal", "tell me it'll be",
        "i'm scared", "will it get better", "am i wrong",
        "do you think i'm", "is this okay", "i need to hear",
        "please tell me", "i just need someone", "i'm worried",
    ],
    "sharing_good_news": [
        "i did it", "great news", "i'm so happy",
        "guess what", "finally", "i'm proud",
        "good day", "best day", "excited about",
        "wonderful", "amazing", "awesome",
        "succeeded", "accomplished", "achieved",
    ],
    "discussing_stress": [
        "deadline", "too much work", "overwhelmed",
        "so much pressure", "can't keep up", "burned out",
        "burnout", "swamped", "behind on", "stressed about",
        "work is killing", "so busy", "no time",
        "exams", "assignments", "responsibilities",
    ],
    "greeting": [
        "hello", "hi", "hey", "good morning",
        "good evening", "good afternoon", "howdy",
        "what's up", "how are you",
    ],
    "farewell": [
        "bye", "goodbye", "see you", "take care",
        "goodnight", "talk later", "gotta go",
        "signing off", "catch you later",
    ],
}

# Precompile patterns once at import time
_COMPILED: dict[str, list[re.Pattern]] = {}
for _intent, _phrases in INTENT_KEYWORDS.items():
    _COMPILED[_intent] = [
        re.compile(r"\b" + re.escape(p) + r"\b", re.IGNORECASE)
        for p in _phrases
    ]


@dataclass
class IntentResult:
    intent: str
    confidence: float          # 0-1
    all_scores: dict = field(default_factory=dict)


class IntentDetector:
    """Keyword + heuristic intent detector.

    Scoring: each matched phrase contributes 1 point; the confidence is
    normalised by the total number of phrases for that intent so that
    intents with fewer keywords aren't unfairly penalised.
    """

    def detect(self, text: str) -> IntentResult:
        scores: dict[str, float] = {}
        text_lower = text.lower()

        for intent, patterns in _COMPILED.items():
            hits = sum(1 for p in patterns if p.search(text_lower))
            if hits:
                scores[intent] = hits / len(patterns)

        if not scores:
            return IntentResult(
                intent="emotional_venting",   # safe default
                confidence=0.3,
                all_scores={},
            )

        best = max(scores, key=scores.get)      # type: ignore[arg-type]
        raw = scores[best]
        # Clamp to [0.3, 1.0] so the system never over-commits
        confidence = min(1.0, max(0.3, raw * 2.5))

        return IntentResult(
            intent=best,
            confidence=round(confidence, 2),
            all_scores={k: round(v, 3) for k, v in scores.items()},
        )

    # Convenience helpers ────────────────────────────────
    def is_venting(self, r: IntentResult) -> bool:
        return r.intent == "emotional_venting"

    def wants_advice(self, r: IntentResult) -> bool:
        return r.intent == "seeking_advice"

    def is_positive(self, r: IntentResult) -> bool:
        return r.intent == "sharing_good_news"
