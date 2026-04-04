"""NLP-based Crisis Detection Module for Mental Health Chatbot.

Detects phrases and semantic signals related to:
- suicide
- self harm
- severe depression
- panic attacks

Returns risk levels: low, medium, high.
"""

import logging
import re
import threading
from enum import Enum
from typing import Dict, List

try:
    from transformers import pipeline
except Exception:  # pragma: no cover - optional dependency fallback
    pipeline = None


class CrisisLevel(str, Enum):
    """Required risk levels for crisis detection."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CrisisDetector:
    """Hybrid detector using keyword rules + optional NLP classifier."""
    
    # High-risk phrases (suicidal ideation, self-harm)
    HIGH_KEYWORDS = [
        "suicide", "kill myself", "end my life", "don't want to live",
        "deserve to die", "better off dead", "hang myself", "cut myself",
        "starve myself", "overdose", "jump off", "slit wrist", "harm myself",
        "hurt myself", "self-harm", "self harm", "mutilate",
        "want to hurt myself", "want to die",
    ]
    
    # Medium risk phrases (severe depression, hopelessness)
    MEDIUM_DEPRESSION_KEYWORDS = [
        "hopeless", "worthless", "no point", "can't go on", "give up",
        "want to die", "wish i was dead", "everything is pointless",
        "nobody cares", "all alone", "total failure", "complete failure",
        "ruined my life", "destroy myself", "dark thoughts", "dying inside"
    ]
    
    # Medium risk phrases (panic attacks, acute distress)
    MEDIUM_PANIC_KEYWORDS = [
        "panic", "panic attack", "losing control", "heart racing",
        "breathing difficulty", "suffocating", "terrified", "unbearable",
        "can't cope", "breaking down", "falling apart", "crisis",
        "emergency", "urgent help", "desperate", "can't take it",
        "can't take this", "can't take this anymore", "cannot take this",
    ]
    
    # Crisis context indicators (events that trigger crises)
    CONTEXT_TRIGGERS = [
        "just broke up", "lost my job", "fired", "evicted",
        "health diagnosis", "terminal", "accident", "death",
        "assault", "abuse", "raped", "molested", "traumatic",
        "overdose", "intoxicated", "drunk"
    ]
    
    def __init__(self, enable_nlp: bool = True):
        """Initialize detector with regex patterns and optional NLP classifier."""
        self.logger = logging.getLogger(__name__)
        self.high_pattern = self._compile_pattern(self.HIGH_KEYWORDS)
        self.medium_depression_pattern = self._compile_pattern(
            self.MEDIUM_DEPRESSION_KEYWORDS
        )
        self.medium_panic_pattern = self._compile_pattern(self.MEDIUM_PANIC_KEYWORDS)
        self.context_pattern = self._compile_pattern(self.CONTEXT_TRIGGERS)
        self.enable_nlp = enable_nlp and pipeline is not None
        self.nlp_classifier = None
        self._nlp_load_started = False
        self._nlp_ready = False
        self._nlp_load_error = None

        if self.enable_nlp:
            # Start loading in background so API startup is not blocked by model download.
            self._start_nlp_loader()

    def _start_nlp_loader(self) -> None:
        """Start background NLP model loading once."""
        if self._nlp_load_started:
            return

        self._nlp_load_started = True

        def _load() -> None:
            try:
                self.nlp_classifier = pipeline(
                    "zero-shot-classification",
                    model="facebook/bart-large-mnli",
                )
                self._nlp_ready = True
                self.logger.info("NLP crisis classifier loaded successfully")
            except Exception as exc:  # pragma: no cover - runtime dependency guard
                self._nlp_load_error = str(exc)
                self._nlp_ready = False
                self.logger.warning("NLP crisis classifier unavailable: %s", exc)
                self.nlp_classifier = None

        threading.Thread(target=_load, daemon=True).start()
    
    @staticmethod
    def _compile_pattern(keywords: List[str]) -> re.Pattern:
        """Compile keywords into regex pattern with word boundaries"""
        # Add word boundaries and case-insensitive flag
        escaped = [re.escape(kw) for kw in keywords]
        pattern = r'\b(' + '|'.join(escaped) + r')\b'
        return re.compile(pattern, re.IGNORECASE)
    
    def _nlp_signals(self, text: str) -> Dict[str, float]:
        """Run NLP classifier and map label confidences."""
        if not self.nlp_classifier:
            return {}

        labels = [
            "suicidal intent",
            "self harm intent",
            "severe depression distress",
            "panic attack distress",
            "safe conversation",
        ]

        try:
            result = self.nlp_classifier(text, labels, multi_label=True)
            return {
                label: float(score)
                for label, score in zip(result.get("labels", []), result.get("scores", []))
            }
        except Exception as exc:  # pragma: no cover
            self.logger.warning("NLP crisis scoring failed: %s", exc)
            return {}

    def detect(self, text: str, emotion: str = None) -> Dict:
        """Detect crisis indicators and return actionable plan payload."""
        text_lower = text.lower()
        detected_categories: List[str] = []
        keywords_found: List[str] = []
        risk_score = 0.0

        # Rule-based hits
        high_matches = self.high_pattern.findall(text_lower)
        if high_matches:
            detected_categories.extend(["suicide", "self_harm"])
            keywords_found.extend(list(set(high_matches)))
            risk_score = max(risk_score, 0.85)

        dep_matches = self.medium_depression_pattern.findall(text_lower)
        if dep_matches:
            detected_categories.append("severe_depression")
            keywords_found.extend(list(set(dep_matches)))
            risk_score = max(risk_score, 0.6)

        panic_matches = self.medium_panic_pattern.findall(text_lower)
        if panic_matches:
            detected_categories.append("panic_attacks")
            keywords_found.extend(list(set(panic_matches)))
            risk_score = max(risk_score, 0.58)

        context_matches = self.context_pattern.findall(text_lower)
        if context_matches and emotion in ["sadness", "anxiety", "stress"]:
            keywords_found.extend(list(set(context_matches)))
            risk_score = max(risk_score, 0.55)

        # NLP semantic scores
        nlp_scores = self._nlp_signals(text)
        if nlp_scores:
            if nlp_scores.get("suicidal intent", 0.0) >= 0.35:
                detected_categories.append("suicide")
                risk_score = max(risk_score, 0.9)
            if nlp_scores.get("self harm intent", 0.0) >= 0.35:
                detected_categories.append("self_harm")
                risk_score = max(risk_score, 0.9)
            if nlp_scores.get("severe depression distress", 0.0) >= 0.45:
                detected_categories.append("severe_depression")
                risk_score = max(risk_score, 0.62)
            if nlp_scores.get("panic attack distress", 0.0) >= 0.45:
                detected_categories.append("panic_attacks")
                risk_score = max(risk_score, 0.6)
        
        detected_categories = sorted(set(detected_categories))
        keywords_found = sorted(set(keywords_found))

        if risk_score >= 0.8:
            crisis_level = CrisisLevel.HIGH
        elif risk_score >= 0.5:
            crisis_level = CrisisLevel.MEDIUM
        else:
            crisis_level = CrisisLevel.LOW

        crisis_alert = crisis_level in {CrisisLevel.MEDIUM, CrisisLevel.HIGH}
        resources_payload = self.get_crisis_resources(crisis_level)

        return {
            "crisis_level": crisis_level,
            "detected_categories": detected_categories,
            "keywords": keywords_found,
            "risk_score": round(risk_score, 2),
            "crisis_alert": crisis_alert,
            "requires_escalation": crisis_level == CrisisLevel.HIGH,
            "recommendation": resources_payload.get("recommendation"),
            "action": (
                "trigger_crisis_alert" if crisis_alert else "continue_support"
            ),
            "helplines": resources_payload.get("helplines", []),
            "connect_professional_help": resources_payload.get(
                "connect_professional_help", False
            ),
        }
    
    def get_crisis_resources(self, crisis_level: CrisisLevel) -> Dict:
        """Return emergency helplines and optional professional escalation info."""
        resources = {
            CrisisLevel.HIGH: {
                "recommendation": "Trigger immediate crisis alert and connect to urgent professional support.",
                "helplines": [
                    {
                        "name": "988 Suicide & Crisis Lifeline (US)",
                        "contact": "Call or text 988",
                        "available": "24/7",
                        "url": "https://988lifeline.org",
                    },
                    {
                        "name": "Crisis Text Line",
                        "contact": "Text HOME to 741741",
                        "available": "24/7",
                        "url": "https://www.crisistextline.org",
                    },
                    {
                        "name": "International Helplines",
                        "contact": "Country-specific crisis centers",
                        "url": "https://findahelpline.com",
                    },
                ],
                "connect_professional_help": True,
            },
            CrisisLevel.MEDIUM: {
                "recommendation": "Trigger crisis alert and suggest speaking with a licensed professional soon.",
                "helplines": [
                    {
                        "name": "SAMHSA National Helpline",
                        "contact": "1-800-662-4357",
                        "available": "24/7",
                        "url": "https://www.samhsa.gov/find-help/national-helpline",
                    },
                    {
                        "name": "NAMI Helpline",
                        "contact": "1-800-950-NAMI",
                        "available": "Mon-Fri",
                        "url": "https://www.nami.org/help",
                    },
                ],
                "connect_professional_help": True,
            },
            CrisisLevel.LOW: {
                "recommendation": "No immediate crisis indicators detected; continue supportive monitoring.",
                "helplines": [],
                "connect_professional_help": False,
            },
        }

        return resources.get(crisis_level, resources[CrisisLevel.LOW])


if __name__ == "__main__":
    # Test the crisis detector
    detector = CrisisDetector()
    
    test_messages = [
        "I'm just having a bad day",
        "I keep getting panic attacks and cannot breathe",
        "I feel hopeless and everything is pointless",
        "I've been thinking about killing myself",
    ]
    
    for msg in test_messages:
        result = detector.detect(msg)
        print(f"\nMessage: {msg}")
        print(f"Crisis Level: {result['crisis_level']}")
        print(f"Risk Score: {result['risk_score']}")
        print(f"Action: {result['action']}")
        print(f"Alert: {result['crisis_alert']}")
