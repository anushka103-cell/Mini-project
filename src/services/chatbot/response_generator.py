"""
Empathetic Response Generation Module — v3 (LLM-powered)

Generates contextually appropriate, emotionally intelligent responses
using a two-tier pipeline:

  Primary:  Groq LLM (Llama 3.3 70B) with rich system prompt,
            RAG context, and long-term memory.
  Fallback: Template-based pipeline (v2) activated when the LLM
            is unavailable, rate-limited, or returns a low-quality
            response.

  Intent → Emotion → Strategy → RAG → Memory → LLM → Score → Final
"""

from __future__ import annotations

import logging
import os
import random
import re
from collections import deque
from typing import Dict, List, Optional

from system_prompt import (
    COMPANION_NAME,
    CRISIS_HELPLINES,
    CRISIS_PREAMBLE,
    CRISIS_CLOSING,
    IDENTITY_STATEMENT,
    BOUNDARY_DISCLAIMER,
    PERSONALITY_TRAITS,
    FORBIDDEN_TONES,
    SAFETY_BOUNDARIES,
    QUALITY_CHECKS,
    DEPTH_LEVELS,
    intensity_label,
    strategies_for,
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────
#  Groq LLM client (lazy-loaded)
# ────────────────────────────────────────────────────────────────

_groq_client = None
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "768"))
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.75"))


def _get_groq_client():
    """Lazy-init the Groq client."""
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    if not GROQ_API_KEY:
        logger.info("GROQ_API_KEY not set — LLM generation disabled, using templates")
        return None
    try:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        logger.info("Groq client initialised (model=%s)", GROQ_MODEL)
        return _groq_client
    except Exception as e:
        logger.warning("Failed to init Groq client: %s", e)
        return None

# ────────────────────────────────────────────────────────────────
#  Anti-repetition ring buffer
# ────────────────────────────────────────────────────────────────

class _RepetitionGuard:
    """Remember recently used template fragments; reject duplicates."""

    def __init__(self, window: int = 6):
        self._recent: deque[str] = deque(maxlen=window)

    def pick(self, options: list[str]) -> str:
        available = [o for o in options if o not in self._recent]
        if not available:
            self._recent.clear()
            available = options
        choice = random.choice(available)
        self._recent.append(choice)
        return choice


# ────────────────────────────────────────────────────────────────
#  Cognitive reframing bank
# ────────────────────────────────────────────────────────────────

REFRAMING_PHRASES: dict[str, list[str]] = {
    "sadness": [
        "Sometimes our lowest moments teach us what we truly value.",
        "Sadness can be the heart asking for something it needs — what might that be for you?",
        "This pain won't define you, but it may reveal new strength in you.",
    ],
    "anxiety": [
        "What if the worst-case scenario your mind is imagining right now is just one possibility — and not the most likely one?",
        "Anxiety is rehearsal without a stage; what would letting go of the rehearsal look like?",
        "Your mind is trying to protect you, but you can remind it that you're safe right now.",
    ],
    "anger": [
        "Anger often guards something we care about deeply — what is it protecting for you?",
        "What would change if you replaced the thought 'This shouldn't have happened' with 'This happened — and I get to decide what comes next'?",
        "Strength isn't about suppressing anger; it's about choosing what to do with it.",
    ],
    "frustration": [
        "Frustration usually means you care about doing this well — and that counts for something.",
        "What if this setback is a detour, not a dead end?",
        "Taking a brief step back might reveal a path you haven't seen yet.",
    ],
    "stress": [
        "What if you only needed to handle the next hour, not the whole week?",
        "Stress often stacks in our mind more than it actually stacks in reality.",
        "You've survived 100% of your hardest days so far.",
    ],
    "loneliness": [
        "Loneliness shows that connection matters to you — and that is a beautiful thing to know about yourself.",
        "Being lonely doesn't mean you're alone in the world; it means your heart is ready for more closeness.",
        "Even the smallest reach-out — a text, a call — can start to bridge that gap.",
    ],
}


class ResponseGenerator:
    """
    Generates empathetic responses tailored to user emotions.
    Uses emotion profiles, conversation history, and response templates.
    Strategy-aware: adapts output to Reflect / Explore / Support /
    Encourage / Reframe based on detected intent and emotion.
    """

    # ────── Emotion-specific response templates ──────
    RESPONSE_TEMPLATES = {
        "sadness": {
            "validation": [
                "I hear that you're feeling down. That's a completely valid emotion.",
                "Your sadness makes sense given what you're experiencing.",
                "It's okay to feel sad sometimes — emotions serve an important purpose.",
                "I recognize that you're going through a difficult time right now.",
            ],
            "empathy": [
                "It sounds like you're carrying a heavy emotional weight.",
                "I can sense how much pain you're in right now.",
                "That sounds really tough. I'm here to listen.",
                "Your feelings are important, and I want you to know I'm listening.",
            ],
            "action": [
                "Have you been able to talk to someone close to you about this?",
                "What's one small thing that has helped you feel even slightly better?",
                "Would it help to explore some coping strategies together?",
                "Sometimes taking things one moment at a time can help.",
            ],
        },
        "anxiety": {
            "validation": [
                "Anxiety is your mind trying to protect you — it's a natural response.",
                "What you're feeling is real and valid, even if it feels overwhelming.",
                "Anxiety is more common than you might think — you're not alone in this.",
                "Your worries matter, and I'm here to help you work through them.",
            ],
            "empathy": [
                "I can tell that worry is taking up a lot of your mental space right now.",
                "Living with anxiety can be exhausting — thank you for sharing this with me.",
                "It sounds like your mind is working overtime to anticipate problems.",
                "That level of worry must be affecting your daily life.",
            ],
            "action": [
                "Let's try breaking down what's worrying you into smaller, manageable pieces.",
                "Would grounding techniques or breathing exercises help right now?",
                "What's one thing you can control about this situation?",
                "Sometimes anxiety thrives when we're alone — connecting with others helps.",
            ],
        },
        "anger": {
            "validation": [
                "Anger is a valid response to injustice or being wronged.",
                "It makes sense that you're angry — something important to you was affected.",
                "Anger can be a healthy emotion when it motivates positive change.",
                "Your frustration is justified — I can understand why you feel this way.",
            ],
            "empathy": [
                "I can sense the intensity of your frustration right now.",
                "It sounds like you've been pushed to your limits.",
                "Holding onto this anger must be emotionally draining for you.",
                "Your anger is telling you that something matters to you.",
            ],
            "action": [
                "What would help you process this anger in a healthy way?",
                "Is there something you'd like to change about this situation?",
                "Physical activity can sometimes help channel angry energy — have you tried that?",
                "What would a positive resolution look like to you?",
            ],
        },
        "happiness": {
            "validation": [
                "It's wonderful that you're experiencing joy right now!",
                "Your happiness is beautiful — celebrate this moment.",
                "Positive emotions are gifts — treasure them when they appear.",
                "I love hearing about moments that bring you joy!",
            ],
            "empathy": [
                "Your enthusiasm is contagious — I can feel your positive energy!",
                "It's heartwarming to see you in such a good place.",
                "Your joy is truly inspiring — thank you for sharing it.",
                "I'm genuinely happy to hear that you're feeling this way.",
            ],
            "action": [
                "What specifically is making you feel so good right now?",
                "How can you hold onto this feeling and bring it into other areas of life?",
                "Who else in your life would benefit from hearing this good news?",
                "This is a great time to reflect on what's working well for you.",
            ],
        },
        "stress": {
            "validation": [
                "Stress is your body's signal that demands exceed your current resources.",
                "What you're experiencing is a normal response to pressure.",
                "It's completely understandable to feel stressed in this situation.",
                "Your stress is telling you that self-care might be needed.",
            ],
            "empathy": [
                "I can hear how overwhelmed you're feeling right now.",
                "Carrying this much stress must be exhausting for you.",
                "It sounds like you're juggling many responsibilities.",
                "The pressure you're under sounds quite intense.",
            ],
            "action": [
                "Let's identify what you can control versus what you can't.",
                "What's the smallest first step toward reducing this stress?",
                "When was the last time you took a real break? You might need one.",
                "Prioritizing what matters most might help lighten your load.",
            ],
        },
        # ── NEW emotions ──
        "loneliness": {
            "validation": [
                "Feeling lonely is one of the hardest emotions — and it's completely valid.",
                "Loneliness doesn't mean something is wrong with you; it means connection matters to you.",
                "Many people feel this way even when surrounded by others — you're not alone in that.",
                "Thank you for trusting me with something so personal.",
            ],
            "empathy": [
                "It sounds like you're craving a kind of closeness that hasn't been easy to find.",
                "That sense of isolation can feel heavy, especially when it lingers.",
                "I hear you — feeling disconnected can be deeply painful.",
                "Being lonely takes real energy, even if people don't always see it.",
            ],
            "action": [
                "Is there one person you feel even a little safe reaching out to?",
                "Sometimes a small routine — a walk, a coffee shop — can create unexpected connections.",
                "Would it help to explore ways to build connection at your own pace?",
                "What does meaningful connection look like for you?",
            ],
        },
        "frustration": {
            "validation": [
                "Frustration usually means you really care about the outcome — and that's a strength.",
                "It makes total sense to feel frustrated when things don't go the way you expected.",
                "You're allowed to be annoyed. Your feelings are valid.",
                "Feeling stuck can be incredibly exhausting. I get it.",
            ],
            "empathy": [
                "It sounds like you keep hitting a wall, and that's really draining.",
                "I can hear the tension in what you're describing.",
                "Dealing with repeated obstacles takes a real toll.",
                "That kind of frustration can make everything else feel harder too.",
            ],
            "action": [
                "What's the specific thing that's frustrating you most right now?",
                "Is there a different angle you haven't tried yet?",
                "Sometimes stepping away for 10 minutes resets your perspective — would that be possible?",
                "Would it help to break the problem into smaller parts together?",
            ],
        },
        "neutral": {
            "validation": [
                "Thank you for sharing where you're at emotionally.",
                "I appreciate you talking with me about this.",
                "It's good to check in on how you're really feeling.",
                "Let's explore what's on your mind today.",
            ],
            "empathy": [
                "I'm here to listen and support you in whatever way helps.",
                "Your wellbeing matters, and I'm glad you reached out.",
                "Let's see if we can uncover what's underlying these feelings.",
                "I'm ready to support you through whatever comes up.",
            ],
            "action": [
                "Can you tell me more about what's been on your mind lately?",
                "How are you really doing today, beyond the surface?",
                "Is there something specific you'd like to talk about?",
                "What brought you here to chat today?",
            ],
        },
    }

    # ────── Crisis-specific responses ──────
    CRISIS_RESPONSES = {
        "high": (
            f"{CRISIS_PREAMBLE} "
            "I'm genuinely concerned about your safety right now. "
            "Please reach out to a crisis helpline — you deserve "
            "immediate support from someone trained to help."
        ),
        "medium": (
            "I hear how intense this feels. Reaching out to a mental "
            "health professional soon can give you the support you deserve, "
            "and I can share helpline options too."
        ),
        "low": "I'm here to support you. Let's talk through what you're experiencing.",
    }

    # ────── Encouragement bank ──────
    ENCOURAGEMENTS: dict[str, list[str]] = {
        "sadness": [
            "This feeling is temporary, and you have strength to get through it.",
            "You've overcome difficult times before — you can do this too.",
            "Reaching out like this is a sign of your strength, not weakness.",
        ],
        "anxiety": [
            "You're not alone in feeling this way — many people experience anxiety.",
            "Your ability to talk about this shows real courage.",
            "One step at a time is all you need right now.",
        ],
        "anger": [
            "Channel this energy into positive change — you have the power.",
            "Your anger can be a catalyst for meaningful action.",
            "Let what matters most to you guide your next steps.",
        ],
        "stress": [
            "You're stronger than you realise — you can handle this.",
            "Breaking things down makes even big problems manageable.",
            "Progress over perfection — every small step counts.",
        ],
        "loneliness": [
            "You matter, even on the days it doesn't feel that way.",
            "Connection is a skill — and you're already practising it by being here.",
            "Feeling lonely is hard, but it won't always feel this way.",
        ],
        "frustration": [
            "Frustration is proof that you haven't given up.",
            "Every problem has a crack in it — you'll find it.",
            "Be patient with yourself. You're doing better than you think.",
        ],
    }

    # ──────────────────────────────────────────────────────
    def __init__(self):
        self.emotion_templates = self.RESPONSE_TEMPLATES
        self._guard = _RepetitionGuard(window=6)

    # ──────────────────────────────────────────────────────
    #  LLM System Prompt Builder
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _build_system_prompt(
        emotion: str,
        intensity: float,
        intent: str,
        strategy: str,
        depth_level: int,
        rag_context: str,
        memory_context: str,
        style: str = "balanced",
    ) -> str:
        depth_label = DEPTH_LEVELS.get(depth_level, "surface")
        traits = ", ".join(PERSONALITY_TRAITS)
        forbidden = ", ".join(FORBIDDEN_TONES)
        boundaries = "\n".join(f"- {b}" for b in SAFETY_BOUNDARIES)

        parts = [
            f"You are {COMPANION_NAME} — a warm, empathetic AI mental health companion.",
            f"Core traits: {traits}.",
            f"Forbidden tones: {forbidden}.",
            IDENTITY_STATEMENT,
            BOUNDARY_DISCLAIMER,
            "",
            "## Safety boundaries",
            boundaries,
            "",
            "## Current conversation context",
            f"- User emotion: {emotion} (intensity: {intensity_label(intensity)}, {intensity:.2f})",
            f"- User intent: {intent}",
            f"- Conversation strategy: {strategy}",
            f"- Conversation depth: {depth_label} (level {depth_level})",
            "",
        ]

        # Strategy guidance
        strategy_guidance = {
            "reflect": "Mirror the user's feelings back. Use reflective listening. Do NOT give advice yet.",
            "explore": "Ask open-ended questions to help the user understand their feelings better.",
            "support": "Validate emotions and provide comfort. Be warm and reassuring.",
            "encourage": "Highlight the user's strengths and progress. Be uplifting.",
            "reframe": "Gently offer an alternative perspective. Use cognitive reframing techniques.",
        }
        parts.append(f"## Strategy instruction\n{strategy_guidance.get(strategy, strategy_guidance['support'])}")
        parts.append("")

        # RAG context
        if rag_context:
            parts.append("## Relevant techniques (use naturally, don't list)")
            parts.append(rag_context)
            parts.append("")

        # Memory context
        if memory_context:
            parts.append("## What you know about this user from past sessions")
            parts.append(memory_context)
            parts.append("")

        # Response rules — adapt length to style
        length_rules = {
            "concise": "- Respond in 2-3 sentences MAX. Be brief, direct, and warm. Get to the point quickly.",
            "balanced": "- Respond in 3-5 sentences. Be warm and conversational.",
            "warm": "- Respond in 4-7 sentences. Be thorough, warm, and conversational.",
        }
        length_rule = length_rules.get(style, length_rules["balanced"])

        parts.extend([
            "## Response rules",
            length_rule,
            "- Address the user directly (you/your).",
            "- Match the tone and weight of the user's message. A casual greeting deserves a casual, warm reply — NOT a heavy emotional response.",
            "- If the user sends a simple greeting like 'Hi' or 'Hello', respond naturally and invite them to share what's on their mind.",
            "- Acknowledge their emotion first, then apply the strategy.",
            "- If you reference a technique, weave it in naturally — never list or lecture.",
            "- End with an open question or gentle invitation to continue.",
            "- Do NOT start with 'I hear you' or 'I'm sorry to hear that' or other repetitive openers.",
            "- Do NOT echo the user's exact message back to them in quotes.",
            "- Do NOT exaggerate or catastrophize simple messages.",
            "- Do NOT use bullet points or numbered lists.",
            "- Do NOT diagnose, prescribe, or replace professional help.",
            "- Do NOT mention that you're an AI unless directly asked.",
        ])

        return "\n".join(parts)

    # ──────────────────────────────────────────────────────
    #  LLM Generation (Groq)
    # ──────────────────────────────────────────────────────
    def generate_llm_response(
        self,
        user_message: str,
        emotion: str,
        intensity: float,
        intent: str,
        strategy: str,
        depth_level: int,
        conversation_history: str | None = None,
        rag_context: str = "",
        memory_context: str = "",
        style: str = "balanced",
    ) -> str | None:
        """
        Call Groq LLM for response generation.
        Returns None on any failure (caller should fall back to templates).
        """
        client = _get_groq_client()
        if client is None:
            return None

        system_prompt = self._build_system_prompt(
            emotion=emotion,
            intensity=intensity,
            intent=intent,
            strategy=strategy,
            depth_level=depth_level,
            rag_context=rag_context,
            memory_context=memory_context,
            style=style,
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Inject recent conversation history
        if conversation_history:
            for line in conversation_history.strip().split("\n"):
                line = line.strip()
                if line.lower().startswith("user:"):
                    messages.append({"role": "user", "content": line[5:].strip()})
                elif line.lower().startswith("assistant:"):
                    messages.append({"role": "assistant", "content": line[10:].strip()})

        # Current user message
        messages.append({"role": "user", "content": user_message})

        try:
            # Adjust token limit based on style
            max_tokens = 200 if style == "concise" else GROQ_MAX_TOKENS
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                max_tokens=max_tokens,
                temperature=GROQ_TEMPERATURE,
                top_p=0.9,
            )
            text = response.choices[0].message.content.strip()
            if not text or len(text) < 10:
                logger.warning("LLM returned empty/too-short response")
                return None
            logger.info("LLM response generated (%d chars)", len(text))
            return text
        except Exception as e:
            logger.warning("Groq LLM call failed: %s", e)
            return None

    # ──────────────────────────────────────────────────────
    #  Primary entry point
    # ──────────────────────────────────────────────────────
    def generate(
        self,
        emotion: str,
        crisis_level: str = "low",
        user_message: str | None = None,
        conversation_history: list | None = None,
        intensity: float = 0.5,
        style: str = "balanced",
        user_name: str = "friend",
        use_name: bool = True,
        use_memory: bool = True,
        # New v2 parameters
        intent: str | None = None,
        strategy: str | None = None,
        depth_level: int = 1,
        # v3 — RAG + memory context
        rag_context: str = "",
        memory_context: str = "",
    ) -> str:
        """Build an empathetic response. Tries LLM first, falls back to templates."""

        # ── Crisis gate ──
        if crisis_level in self.CRISIS_RESPONSES and crisis_level == "high":
            return self.CRISIS_RESPONSES["high"]

        # ── Greeting shortcut — keep it light ──
        if intent == "greeting":
            return self._greeting_response(user_name, use_name)

        # ── Resolve strategy ──
        if not strategy:
            strategy = strategies_for(intent or "emotional_venting", emotion)[0]

        # ── v3: Try LLM generation first ──
        if user_message and GROQ_API_KEY:
            # Convert history to string if needed
            history_str = conversation_history if isinstance(conversation_history, str) else ""
            if isinstance(conversation_history, list):
                history_str = "\n".join(str(item) for item in conversation_history)

            llm_response = self.generate_llm_response(
                user_message=user_message,
                emotion=emotion,
                intensity=intensity,
                intent=intent or "emotional_venting",
                strategy=strategy,
                depth_level=depth_level,
                conversation_history=history_str,
                rag_context=rag_context,
                memory_context=memory_context,
                style=style,
            )
            if llm_response:
                return llm_response

        # ── Fallback: template-based pipeline (v2) ──
        logger.info("Using template fallback for response generation")

        # ── Templates ──
        templates = self.emotion_templates.get(emotion, self.emotion_templates["neutral"])

        style = (style or "balanced").lower()
        if style not in {"warm", "balanced", "concise"}:
            style = "balanced"

        parts: list[str] = []

        # 0 — Reflective intro (mirrors the user's own words)
        intro = self._human_intro(user_message, user_name, use_name)
        if intro:
            parts.append(intro)

        # 0.5 — Memory cue from prior turn
        if use_memory and style != "concise":
            memory_cue = self._memory_cue(conversation_history, user_message)
            if memory_cue:
                parts.append(memory_cue)

        # 1 — Validation (always)
        parts.append(self._guard.pick(templates["validation"]))

        # 2 — Empathy (intensity-aware)
        empathy_threshold = 0.40 if style == "warm" else 0.55
        if intensity > empathy_threshold and style != "concise":
            parts.append(self._guard.pick(templates["empathy"]))

        # 3 — Strategy-driven core
        if strategy == "reflect":
            reflection = self._reflective_line(user_message)
            if reflection:
                parts.append(reflection)
        elif strategy == "explore":
            parts.append(
                self._contextual_follow_up(user_message, emotion)
                or self._guard.pick(templates["action"])
            )
        elif strategy == "support":
            parts.append(self._guard.pick(templates["action"]))
        elif strategy == "reframe":
            rf = self._cognitive_reframe(emotion)
            if rf:
                parts.append(rf)
            else:
                parts.append(self._guard.pick(templates["action"]))
        elif strategy == "encourage":
            enc = self._generate_encouragement(emotion)
            parts.append(enc or self._guard.pick(templates["action"]))
        else:
            parts.append(self._guard.pick(templates["action"]))

        # 4 — Encouragement for ongoing warm conversations
        if (
            style == "warm"
            and conversation_history
            and len(conversation_history) > 2
            and strategy != "encourage"
        ):
            enc = self._generate_encouragement(emotion)
            if enc:
                parts.append(enc)

        # 5 — Depth-aware closing question (depth ≥ 3 → deeper probes)
        if depth_level >= 3 and strategy not in ("encourage", "reframe"):
            deeper = self._depth_probe(emotion, depth_level)
            if deeper:
                parts.append(deeper)

        # ── Assemble ──
        if style == "concise":
            return " ".join(parts[:4])

        return " ".join(parts)

    # ──────────────────────────────────────────────────────
    #  Helper: greeting response
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _greeting_response(user_name: str | None = None, use_name: bool = True) -> str:
        safe_name = (user_name or "").strip() if use_name else ""
        name_part = f", {safe_name}" if safe_name and safe_name.lower() != "friend" else ""
        responses = [
            f"Hi{name_part}! I'm here for you. How are you feeling today?",
            f"Hey{name_part}! It's great to see you. What's on your mind?",
            f"Hello{name_part}! I'm glad you're here. How are things going?",
            f"Hi{name_part}! Welcome back. How has your day been so far?",
            f"Hey there{name_part}! What would you like to talk about today?",
        ]
        return random.choice(responses)

    # ──────────────────────────────────────────────────────
    #  Helper: reflective intro
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _human_intro(
        user_message: str | None,
        user_name: str | None = None,
        use_name: bool = True,
    ) -> str:
        if not user_message:
            return ""
        text = user_message.strip()
        if not text:
            return ""

        safe_name = (user_name or "").strip() if use_name else ""
        name_prefix = f"{safe_name}, " if safe_name and safe_name.lower() != "friend" else ""

        low = text.lower().strip()

        # ── Casual greetings — respond naturally, no drama ──
        greeting_words = {"hi", "hello", "hey", "howdy", "hola", "sup", "yo"}
        greeting_phrases = ["good morning", "good afternoon", "good evening",
                           "what's up", "how are you", "how's it going"]
        is_greeting = low.rstrip("!., ") in greeting_words or any(
            low.startswith(g) for g in greeting_phrases
        )
        if is_greeting:
            greetings = [
                f"{name_prefix}hey! It's nice to hear from you.".strip(),
                f"{name_prefix}hi there! How are you doing today?".strip(),
                f"{name_prefix}hello! What's on your mind today?".strip(),
                f"{name_prefix}hey! I'm glad you stopped by.".strip(),
            ]
            return random.choice(greetings)

        # ── Topic-specific intros ──
        if "exam" in low or "study" in low:
            return f"{name_prefix}that sounds really heavy, especially with exam pressure on top of everything.".strip()
        if "work" in low or "job" in low:
            return f"{name_prefix}that sounds draining, especially when work keeps piling up.".strip()
        if "family" in low or "parents" in low:
            return f"{name_prefix}family stress can feel deeply personal and exhausting.".strip()
        if "sleep" in low or "insomnia" in low:
            return f"{name_prefix}lack of sleep can make everything feel much harder to carry.".strip()
        if "cannot handle" in low or "can't handle" in low:
            return f"{name_prefix}thank you for being honest about how hard this feels right now.".strip()
        if "lonely" in low or "alone" in low:
            return f"{name_prefix}feeling disconnected like that can be really painful.".strip()

        # ── Short / simple messages — don't over-dramatise ──
        word_count = len(text.split())
        if word_count <= 4:
            short_intros = [
                f"{name_prefix}I appreciate you sharing that.".strip(),
                f"{name_prefix}thank you for reaching out.".strip(),
                f"{name_prefix}I'm here for you.".strip(),
            ]
            return random.choice(short_intros)

        # ── Longer messages — empathetic reflection ──
        clean = re.sub(r"\s+", " ", text)
        snippet = clean[:90] + ("..." if len(clean) > 90 else "")
        longer_intros = [
            f"{name_prefix}I hear you. Thank you for sharing that with me.".strip(),
            f"{name_prefix}I appreciate you talking with me about this.".strip(),
            f"{name_prefix}that sounds like it's been weighing on you.".strip(),
        ]
        return random.choice(longer_intros)

    # ──────────────────────────────────────────────────────
    #  Helper: memory cue
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _memory_cue(conversation_history: object | None, user_message: str | None) -> str | None:
        if not conversation_history:
            return None

        history_text = ""
        if isinstance(conversation_history, str):
            history_text = conversation_history
        elif isinstance(conversation_history, list):
            try:
                history_text = "\n".join(str(item) for item in conversation_history)
            except Exception:
                history_text = ""

        if not history_text:
            return None

        lines = [line.strip() for line in history_text.splitlines() if line.strip()]
        user_lines = [line for line in lines if line.lower().startswith("user:")]
        if len(user_lines) < 1:
            return None

        previous = user_lines[-1].split(":", 1)[-1].strip()
        current = (user_message or "").strip()
        if not previous or not current or previous.lower() == current.lower():
            return None

        # Skip trivial previous messages (greetings, very short)
        prev_low = previous.lower().strip("!., ")
        trivial = {"hi", "hello", "hey", "howdy", "yo", "sup", "hola",
                    "good morning", "good afternoon", "good evening",
                    "what's up", "how are you", "ok", "okay", "yes", "no", "thanks", "bye"}
        if prev_low in trivial or len(previous.split()) <= 2:
            return None

        if len(previous) > 80:
            previous = previous[:80].rstrip() + "..."

        return f"Earlier you mentioned '{previous}', and I can see this is still weighing on you."

    # ──────────────────────────────────────────────────────
    #  Helper: contextual follow-up
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _contextual_follow_up(user_message: str | None, emotion: str) -> str | None:
        if not user_message:
            return None

        low = user_message.lower()
        if "exam" in low or "study" in low:
            return "Would it help if we break exam stress into one tiny plan for just today?"
        if "cannot handle" in low or "can't handle" in low:
            return "Right now, what feels hardest: your thoughts, your body tension, or the situation itself?"
        if emotion == "stress":
            return "What is one task you can safely postpone so your mind gets some breathing room today?"
        if emotion == "anxiety":
            return "Would you like a quick 60-second grounding reset before we continue?"
        if emotion == "sadness":
            return "Would talking about what triggered this today feel helpful, just a little?"
        if emotion == "loneliness":
            return "What would feel like a manageable first step toward connection today?"
        if emotion == "frustration":
            return "Can you pinpoint the specific part that's most frustrating?"
        return None

    # ──────────────────────────────────────────────────────
    #  Helper: reflective listening line
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _reflective_line(user_message: str | None) -> str | None:
        """Reflect the underlying feeling — never quote the user's exact words."""
        if not user_message or len(user_message) < 10:
            return None

        low = user_message.lower()

        # Map user statements to reflected feelings (never quote their text)
        reflections = [
            (["hate myself", "hate me", "worthless", "failure", "loser"],
             [
                 "It sounds like you're being really hard on yourself right now, and that kind of inner critic can feel relentless.",
                 "It seems like there's a lot of self-criticism weighing you down. That takes a real toll.",
                 "I sense you're struggling with how you see yourself. Those feelings are painful, but they don't define who you are.",
             ]),
            (["not well", "not good", "not great", "not okay", "not fine", "unwell", "not doing well"],
             [
                 "It sounds like something is off, and it took courage to say that out loud.",
                 "Acknowledging that you're not okay is actually an important step — it means you're paying attention to yourself.",
                 "That honesty matters. Let's talk about what's going on beneath the surface.",
             ]),
            (["don't like", "dont like", "hate this", "can't stand"],
             [
                 "It sounds like something is really bothering you. Let's unpack what's behind that feeling.",
                 "There's clearly something weighing on you. I'd like to understand more about what's going on.",
                 "That frustration is telling you something important. Let's explore what it is.",
             ]),
            (["stressed", "overwhelmed", "too much", "pressure"],
             [
                 "It sounds like you're carrying a lot on your shoulders right now.",
                 "There seems to be a lot of pressure building up. That's exhausting.",
                 "You're dealing with more than feels manageable, and that's a heavy place to be.",
             ]),
            (["scared", "afraid", "terrified", "worried"],
             [
                 "It sounds like fear or uncertainty is taking up a lot of space in your mind right now.",
                 "That kind of worry can feel all-consuming. You don't have to face it alone.",
                 "Feeling scared is your mind's way of protecting you — but it can be overwhelming when it doesn't let up.",
             ]),
            (["lonely", "alone", "isolated", "no one"],
             [
                 "It sounds like you're craving connection that's been hard to find.",
                 "Feeling disconnected from others can be one of the most painful experiences. I hear you.",
                 "That sense of isolation is real, and I want you to know you're not going through this alone right now.",
             ]),
        ]

        for keywords, responses in reflections:
            if any(kw in low for kw in keywords):
                return random.choice(responses)

        # Generic reflection — still no quoting
        generic = [
            "It sounds like there's a lot going on beneath the surface. I'm here to listen.",
            "I can sense this is really affecting you. Let's take it one step at a time.",
            "What you're feeling clearly matters — and I want to understand it better.",
        ]
        return random.choice(generic)

    # ──────────────────────────────────────────────────────
    #  Helper: cognitive reframing
    # ──────────────────────────────────────────────────────
    def _cognitive_reframe(self, emotion: str) -> str | None:
        pool = REFRAMING_PHRASES.get(emotion)
        if not pool:
            return None
        return self._guard.pick(pool)

    # ──────────────────────────────────────────────────────
    #  Helper: encouragement
    # ──────────────────────────────────────────────────────
    def _generate_encouragement(self, emotion: str) -> str | None:
        msgs = self.ENCOURAGEMENTS.get(emotion, [])
        return self._guard.pick(msgs) if msgs else None

    # ──────────────────────────────────────────────────────
    #  Helper: depth probe (level ≥ 3)
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _depth_probe(emotion: str, depth_level: int) -> str | None:
        """Ask deeper reflective questions when conversation reaches depth 3+."""
        probes: dict[str, list[str]] = {
            "sadness": [
                "What do you think this sadness is trying to tell you about what you need?",
                "If this sadness could speak, what would it ask for?",
            ],
            "anxiety": [
                "Do you notice a pattern in when this anxiety shows up?",
                "What would your life look like if this worry loosened its grip, even a little?",
            ],
            "stress": [
                "When you think about the root of this stress, what comes up first?",
                "What would it mean to give yourself permission to rest?",
            ],
            "loneliness": [
                "What kind of connection would feel most meaningful to you right now?",
                "Has there been a time when you didn't feel this alone? What was different then?",
            ],
            "frustration": [
                "What outcome would feel truly satisfying here?",
                "Is there something deeper beneath the frustration — maybe unmet expectations?",
            ],
            "anger": [
                "What core value of yours was crossed here?",
                "If the anger faded, what feeling do you think would be underneath?",
            ],
        }
        pool = probes.get(emotion)
        if not pool:
            return None
        if depth_level >= 4:
            return pool[-1]  # deepest question
        return random.choice(pool)

    # ──────────────────────────────────────────────────────
    #  Coping suggestions (unchanged API surface)
    # ──────────────────────────────────────────────────────
    def generate_coping_suggestions(self, emotion: str, intensity: float = 0.5) -> list[str]:
        coping_strategies = {
            "sadness": [
                "Connect with someone you trust — isolation makes sadness worse",
                "Engage in an activity that normally brings you joy, even if small",
                "Practice self-compassion — treat yourself like a good friend would",
                "Get gentle physical exercise — even a short walk can help",
                "Maintain basic needs: sleep, nutrition, hydration",
            ],
            "anxiety": [
                "Try deep breathing: 4 in, 4 hold, 4 out — repeat 5 times",
                "Ground yourself with the 5-4-3-2-1 technique (5 things you see, 4 you touch, etc.)",
                "Physical activity helps metabolize anxiety hormones",
                "Limit caffeine and alcohol, which can worsen anxiety",
                "Practice or schedule something you can control today",
            ],
            "anger": [
                "Physical outlet: exercise, walk, or punch a pillow — don't suppress it",
                "Cool down first — separate yourself from the trigger temporarily",
                "Express your emotions through journaling or creative outlets",
                "Identify what value was violated — anger protects what matters to you",
                "Channel energy into constructive change",
            ],
            "stress": [
                "Break tasks into smaller, manageable steps",
                "Prioritize ruthlessly — what truly matters most right now?",
                "Take regular breaks — your mind needs rest",
                "Practice relaxation: meditation, yoga, or progressive muscle relaxation",
                "Delegate or ask for help — you don't have to do it all alone",
            ],
            "loneliness": [
                "Reach out to one person today — even a short text counts",
                "Join an online community around something you enjoy",
                "Volunteer — helping others can create unexpected connection",
                "Try a small social routine: a walk in the park, a local café",
                "Write down three people who might welcome a message from you",
            ],
            "frustration": [
                "Step away for a brief break before re-engaging",
                "Write down exactly what's frustrating you — clarity helps",
                "Ask yourself: is this within my control or not?",
                "Try a different approach or ask someone for a fresh perspective",
                "Celebrate small wins — progress is still progress",
            ],
            "happiness": [
                "Share your joy with others — it amplifies the feeling",
                "Document this moment — journal, photo, or memory",
                "Practice gratitude — identify three specific things making you happy",
                "Maintain momentum — what's contributing to this good feeling?",
                "Plan something to look forward to",
            ],
        }

        strategies = coping_strategies.get(emotion, coping_strategies.get("happiness", []))
        if intensity > 0.7:
            return strategies[:2]
        return strategies

    # ──────────────────────────────────────────────────────
    #  Response quality scorer
    # ──────────────────────────────────────────────────────
    @staticmethod
    def score_response(response: str, emotion: str, user_message: str | None = None) -> dict:
        """Quick heuristic quality score (0-1 per dimension)."""
        scores: dict[str, float] = {}

        # Empathy: does it reference feelings?
        feeling_words = ["feel", "sounds like", "hear you", "tough", "hard",
                         "valid", "understand", "sense", "pain", "heavy"]
        empathy_hits = sum(1 for w in feeling_words if w in response.lower())
        scores["empathy"] = min(1.0, empathy_hits / 3)

        # Warmth: presence of warm phrases
        warm_words = ["I'm here", "thank you", "matters", "strength",
                      "courage", "together", "safe"]
        warmth_hits = sum(1 for w in warm_words if w in response.lower())
        scores["warmth"] = min(1.0, warmth_hits / 2)

        # Actionability: contains a question or suggestion
        has_question = "?" in response
        has_suggestion = any(w in response.lower() for w in ["try", "would it help", "let's", "could you"])
        scores["actionability"] = 1.0 if (has_question and has_suggestion) else (0.6 if has_question else 0.3)

        # Length check: not too short, not too long
        word_count = len(response.split())
        if 30 <= word_count <= 120:
            scores["length"] = 1.0
        elif 20 <= word_count < 30 or 120 < word_count <= 160:
            scores["length"] = 0.7
        else:
            scores["length"] = 0.4

        scores["overall"] = round(sum(scores.values()) / len(scores), 2)
        return scores


if __name__ == "__main__":
    generator = ResponseGenerator()

    emotions = ["sadness", "anxiety", "anger", "happiness", "stress", "loneliness", "frustration"]

    for emotion in emotions:
        response = generator.generate(
            emotion, intensity=0.8,
            user_message="I've been feeling really overwhelmed lately",
            intent="emotional_venting",
        )
        score = generator.score_response(response, emotion)
        print(f"\n{emotion.upper()} (strategy=auto, score={score['overall']}):")
        print(response)
        print("Coping strategies:")
        for s in generator.generate_coping_suggestions(emotion, intensity=0.8):
            print(f"  - {s}")
