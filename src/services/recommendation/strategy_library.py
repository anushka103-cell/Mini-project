"""
Coping Strategy Knowledge Base

Comprehensive, evidence-based coping strategy library organized by emotion,
intensity level, and category.  Each strategy carries metadata so the
recommendation engine can filter, rank, and explain its picks.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List


class StrategyCategory(str, Enum):
    BREATHING = "breathing"
    GROUNDING = "grounding"
    MINDFULNESS = "mindfulness"
    PHYSICAL = "physical"
    COGNITIVE = "cognitive"
    SOCIAL = "social"
    CREATIVE = "creative"
    SELF_CARE = "self_care"
    JOURNALING = "journaling"
    PROFESSIONAL = "professional"


class IntensityBand(str, Enum):
    LOW = "low"          # 0.0 – 0.39
    MODERATE = "moderate" # 0.4 – 0.69
    HIGH = "high"        # 0.7 – 1.0


@dataclass
class CopingStrategy:
    id: str
    title: str
    description: str
    category: StrategyCategory
    emotions: List[str]            # which emotions this strategy targets
    min_intensity: float = 0.0     # effective range lower bound
    max_intensity: float = 1.0     # effective range upper bound
    duration_minutes: int = 5      # estimated time
    difficulty: int = 1            # 1‑easy  2‑medium  3‑advanced
    evidence_tags: List[str] = field(default_factory=list)  # e.g. ["CBT", "DBT"]
    effectiveness_base: float = 0.7  # base effectiveness score (0‑1)


# ────────────────────────────────────────────────────────
#  Master Strategy Library
# ────────────────────────────────────────────────────────
STRATEGY_LIBRARY: List[CopingStrategy] = [
    # ═══════════ BREATHING ═══════════
    CopingStrategy(
        id="breathing_478",
        title="4‑7‑8 Breathing",
        description="Inhale for 4 counts, hold for 7, exhale for 8. Repeat 4 cycles. Activates the parasympathetic nervous system.",
        category=StrategyCategory.BREATHING,
        emotions=["anxiety", "stress", "anger", "sadness"],
        min_intensity=0.0,
        max_intensity=1.0,
        duration_minutes=3,
        difficulty=1,
        evidence_tags=["relaxation_response", "anxiety_reduction"],
        effectiveness_base=0.85,
    ),
    CopingStrategy(
        id="breathing_box",
        title="Box Breathing",
        description="Breathe in 4 counts, hold 4, out 4, hold 4. Used by first responders to stay calm under pressure.",
        category=StrategyCategory.BREATHING,
        emotions=["anxiety", "stress", "anger"],
        min_intensity=0.3,
        max_intensity=1.0,
        duration_minutes=4,
        difficulty=1,
        evidence_tags=["stress_inoculation"],
        effectiveness_base=0.82,
    ),
    CopingStrategy(
        id="breathing_diaphragmatic",
        title="Belly Breathing",
        description="Place one hand on chest, one on belly. Breathe so only the belly hand moves. 10 slow breaths.",
        category=StrategyCategory.BREATHING,
        emotions=["anxiety", "stress", "sadness"],
        min_intensity=0.0,
        max_intensity=0.7,
        duration_minutes=5,
        difficulty=1,
        evidence_tags=["relaxation_response"],
        effectiveness_base=0.78,
    ),

    # ═══════════ GROUNDING ═══════════
    CopingStrategy(
        id="grounding_54321",
        title="5‑4‑3‑2‑1 Grounding",
        description="Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Anchors you in the present.",
        category=StrategyCategory.GROUNDING,
        emotions=["anxiety", "stress", "sadness", "anger"],
        min_intensity=0.4,
        max_intensity=1.0,
        duration_minutes=3,
        difficulty=1,
        evidence_tags=["CBT", "dissociation_management"],
        effectiveness_base=0.88,
    ),
    CopingStrategy(
        id="grounding_ice",
        title="Ice Cube Reset",
        description="Hold an ice cube in your palm. Focus entirely on the cold sensation. It interrupts spiralling thoughts.",
        category=StrategyCategory.GROUNDING,
        emotions=["anxiety", "anger", "stress"],
        min_intensity=0.6,
        max_intensity=1.0,
        duration_minutes=2,
        difficulty=1,
        evidence_tags=["DBT", "distress_tolerance"],
        effectiveness_base=0.80,
    ),
    CopingStrategy(
        id="grounding_body_scan",
        title="Quick Body Scan",
        description="Close your eyes. Slowly scan from head to toes, noting tension without judgement. Release each area.",
        category=StrategyCategory.GROUNDING,
        emotions=["stress", "anxiety", "sadness"],
        min_intensity=0.2,
        max_intensity=0.8,
        duration_minutes=5,
        difficulty=2,
        evidence_tags=["MBSR", "relaxation_response"],
        effectiveness_base=0.79,
    ),

    # ═══════════ MINDFULNESS ═══════════
    CopingStrategy(
        id="mindfulness_1min",
        title="1‑Minute Mindfulness",
        description="Set a timer for 60 seconds. Focus only on your breath. When your mind wanders, gently return.",
        category=StrategyCategory.MINDFULNESS,
        emotions=["stress", "anxiety", "anger", "sadness"],
        min_intensity=0.0,
        max_intensity=0.7,
        duration_minutes=1,
        difficulty=1,
        evidence_tags=["MBSR", "attention_training"],
        effectiveness_base=0.75,
    ),
    CopingStrategy(
        id="mindfulness_leaves",
        title="Leaves on a Stream",
        description="Visualize a stream. Place each thought on a leaf and watch it float away. Practice non-attachment.",
        category=StrategyCategory.MINDFULNESS,
        emotions=["anxiety", "stress", "sadness"],
        min_intensity=0.3,
        max_intensity=0.8,
        duration_minutes=5,
        difficulty=2,
        evidence_tags=["ACT", "cognitive_defusion"],
        effectiveness_base=0.77,
    ),
    CopingStrategy(
        id="mindfulness_pme",
        title="Progressive Muscle Relaxation",
        description="Tense each muscle group for 5 seconds then release. Start from toes, work up to face.",
        category=StrategyCategory.MINDFULNESS,
        emotions=["stress", "anxiety", "anger"],
        min_intensity=0.4,
        max_intensity=1.0,
        duration_minutes=10,
        difficulty=2,
        evidence_tags=["relaxation_response", "anxiety_reduction"],
        effectiveness_base=0.84,
    ),

    # ═══════════ PHYSICAL ═══════════
    CopingStrategy(
        id="physical_walk",
        title="5‑Minute Walk",
        description="Step outside for a short walk. Focus on your footsteps and surroundings.",
        category=StrategyCategory.PHYSICAL,
        emotions=["sadness", "stress", "anger", "anxiety"],
        min_intensity=0.0,
        max_intensity=0.8,
        duration_minutes=5,
        difficulty=1,
        evidence_tags=["exercise_therapy", "endorphin_release"],
        effectiveness_base=0.80,
    ),
    CopingStrategy(
        id="physical_stretch",
        title="Desk Stretch Routine",
        description="Neck rolls, shoulder shrugs, wrist circles, and a standing hamstring stretch. 30 seconds each.",
        category=StrategyCategory.PHYSICAL,
        emotions=["stress", "anxiety"],
        min_intensity=0.2,
        max_intensity=0.6,
        duration_minutes=3,
        difficulty=1,
        evidence_tags=["ergonomic_wellness"],
        effectiveness_base=0.70,
    ),
    CopingStrategy(
        id="physical_vigorous",
        title="High‑Energy Outlet",
        description="Do jumping jacks, push‑ups, or run in place for 2 minutes. Burns stress hormones fast.",
        category=StrategyCategory.PHYSICAL,
        emotions=["anger", "stress", "anxiety"],
        min_intensity=0.6,
        max_intensity=1.0,
        duration_minutes=3,
        difficulty=2,
        evidence_tags=["exercise_therapy", "catharsis"],
        effectiveness_base=0.82,
    ),

    # ═══════════ COGNITIVE ═══════════
    CopingStrategy(
        id="cognitive_reframe",
        title="Thought Reframing",
        description="Write down the negative thought. Ask: 'Is this 100 % true? What would I tell a friend?' Rewrite it.",
        category=StrategyCategory.COGNITIVE,
        emotions=["sadness", "anxiety", "stress", "anger"],
        min_intensity=0.2,
        max_intensity=0.7,
        duration_minutes=5,
        difficulty=2,
        evidence_tags=["CBT", "cognitive_restructuring"],
        effectiveness_base=0.83,
    ),
    CopingStrategy(
        id="cognitive_worry_time",
        title="Scheduled Worry Time",
        description="Set a 10‑minute 'worry window' later today. Until then, jot worries on a list and move on.",
        category=StrategyCategory.COGNITIVE,
        emotions=["anxiety", "stress"],
        min_intensity=0.3,
        max_intensity=0.7,
        duration_minutes=2,
        difficulty=2,
        evidence_tags=["CBT", "stimulus_control"],
        effectiveness_base=0.76,
    ),
    CopingStrategy(
        id="cognitive_gratitude",
        title="Three Good Things",
        description="Write down three things that went well today and why they happened.",
        category=StrategyCategory.COGNITIVE,
        emotions=["sadness", "stress"],
        min_intensity=0.0,
        max_intensity=0.5,
        duration_minutes=5,
        difficulty=1,
        evidence_tags=["positive_psychology"],
        effectiveness_base=0.74,
    ),

    # ═══════════ SOCIAL ═══════════
    CopingStrategy(
        id="social_reach_out",
        title="Reach Out to Someone",
        description="Text or call one person you trust. You don't have to explain — just connect.",
        category=StrategyCategory.SOCIAL,
        emotions=["sadness", "anxiety", "stress"],
        min_intensity=0.3,
        max_intensity=1.0,
        duration_minutes=5,
        difficulty=2,
        evidence_tags=["social_support"],
        effectiveness_base=0.81,
    ),
    CopingStrategy(
        id="social_kindness",
        title="Micro Act of Kindness",
        description="Do one small kind thing for someone — hold a door, send a compliment. It shifts focus outward.",
        category=StrategyCategory.SOCIAL,
        emotions=["sadness", "anger"],
        min_intensity=0.0,
        max_intensity=0.5,
        duration_minutes=2,
        difficulty=1,
        evidence_tags=["positive_psychology", "prosocial_behaviour"],
        effectiveness_base=0.72,
    ),

    # ═══════════ CREATIVE ═══════════
    CopingStrategy(
        id="creative_draw",
        title="Express Through Drawing",
        description="Grab paper and draw how you feel — abstract colours and shapes count. No skill needed.",
        category=StrategyCategory.CREATIVE,
        emotions=["sadness", "anger", "anxiety"],
        min_intensity=0.2,
        max_intensity=0.8,
        duration_minutes=10,
        difficulty=1,
        evidence_tags=["art_therapy", "emotional_expression"],
        effectiveness_base=0.73,
    ),
    CopingStrategy(
        id="creative_music",
        title="Mood‑Matching Music",
        description="Listen to a song that matches your emotion, then shift to one that moves you toward calm.",
        category=StrategyCategory.CREATIVE,
        emotions=["sadness", "anxiety", "anger", "stress"],
        min_intensity=0.0,
        max_intensity=0.8,
        duration_minutes=6,
        difficulty=1,
        evidence_tags=["music_therapy", "iso_principle"],
        effectiveness_base=0.76,
    ),

    # ═══════════ SELF‑CARE ═══════════
    CopingStrategy(
        id="selfcare_water",
        title="Hydrate & Reset",
        description="Drink a full glass of cool water slowly. Dehydration amplifies fatigue and irritability.",
        category=StrategyCategory.SELF_CARE,
        emotions=["stress", "sadness", "anger"],
        min_intensity=0.0,
        max_intensity=0.5,
        duration_minutes=1,
        difficulty=1,
        evidence_tags=["basic_self_care"],
        effectiveness_base=0.65,
    ),
    CopingStrategy(
        id="selfcare_splash",
        title="Cold Water Splash",
        description="Splash cold water on your face or hold cold hands on your cheeks. Activates the dive reflex to slow heart rate.",
        category=StrategyCategory.SELF_CARE,
        emotions=["anxiety", "anger"],
        min_intensity=0.5,
        max_intensity=1.0,
        duration_minutes=1,
        difficulty=1,
        evidence_tags=["DBT", "TIPP_skills"],
        effectiveness_base=0.79,
    ),

    # ═══════════ JOURNALING ═══════════
    CopingStrategy(
        id="journal_freewrite",
        title="3‑Minute Free‑Write",
        description="Set a timer. Write whatever comes to mind without stopping or editing. Get thoughts out of your head.",
        category=StrategyCategory.JOURNALING,
        emotions=["sadness", "anxiety", "stress", "anger"],
        min_intensity=0.2,
        max_intensity=0.8,
        duration_minutes=3,
        difficulty=1,
        evidence_tags=["expressive_writing", "emotional_processing"],
        effectiveness_base=0.77,
    ),
    CopingStrategy(
        id="journal_letter",
        title="Letter You Won't Send",
        description="Write a letter to the source of your frustration. Be completely honest. Then tear it up.",
        category=StrategyCategory.JOURNALING,
        emotions=["anger", "sadness"],
        min_intensity=0.4,
        max_intensity=1.0,
        duration_minutes=10,
        difficulty=2,
        evidence_tags=["emotional_processing", "catharsis"],
        effectiveness_base=0.75,
    ),

    # ═══════════ PROFESSIONAL ═══════════
    CopingStrategy(
        id="professional_helpline",
        title="Call a Helpline",
        description="Reach out to a trained counsellor. India: iCall 9152987821, Vandrevala 9999666555. Available 24/7.",
        category=StrategyCategory.PROFESSIONAL,
        emotions=["sadness", "anxiety", "stress", "anger"],
        min_intensity=0.7,
        max_intensity=1.0,
        duration_minutes=15,
        difficulty=2,
        evidence_tags=["professional_support"],
        effectiveness_base=0.90,
    ),
    CopingStrategy(
        id="professional_therapy",
        title="Consider Professional Support",
        description="If emotions persist, speaking with a therapist can provide long-term tools. It's a sign of strength.",
        category=StrategyCategory.PROFESSIONAL,
        emotions=["sadness", "anxiety", "stress", "anger"],
        min_intensity=0.5,
        max_intensity=1.0,
        duration_minutes=0,
        difficulty=3,
        evidence_tags=["professional_support"],
        effectiveness_base=0.92,
    ),

    # ═══════════ HAPPINESS MAINTENANCE ═══════════
    CopingStrategy(
        id="happy_savour",
        title="Savour the Moment",
        description="Pause for 30 seconds and fully absorb what feels good right now. Name it out loud.",
        category=StrategyCategory.MINDFULNESS,
        emotions=["happiness"],
        min_intensity=0.0,
        max_intensity=1.0,
        duration_minutes=1,
        difficulty=1,
        evidence_tags=["positive_psychology", "savouring"],
        effectiveness_base=0.80,
    ),
    CopingStrategy(
        id="happy_share",
        title="Share Your Joy",
        description="Tell someone about what made you happy today. Sharing positive events amplifies them.",
        category=StrategyCategory.SOCIAL,
        emotions=["happiness"],
        min_intensity=0.0,
        max_intensity=1.0,
        duration_minutes=2,
        difficulty=1,
        evidence_tags=["positive_psychology", "capitalization"],
        effectiveness_base=0.78,
    ),
    CopingStrategy(
        id="happy_plan",
        title="Plan Something to Look Forward To",
        description="Schedule one small activity in the next 48 hours that you will enjoy. Anticipation sustains happiness.",
        category=StrategyCategory.COGNITIVE,
        emotions=["happiness"],
        min_intensity=0.0,
        max_intensity=1.0,
        duration_minutes=3,
        difficulty=1,
        evidence_tags=["positive_psychology"],
        effectiveness_base=0.74,
    ),
]


# ────────────────────────────────────────────────────────
#  Look‑up helpers
# ────────────────────────────────────────────────────────
_BY_ID: Dict[str, CopingStrategy] = {s.id: s for s in STRATEGY_LIBRARY}
_BY_EMOTION: Dict[str, List[CopingStrategy]] = {}
for _s in STRATEGY_LIBRARY:
    for _e in _s.emotions:
        _BY_EMOTION.setdefault(_e, []).append(_s)


def get_strategy(strategy_id: str) -> CopingStrategy | None:
    return _BY_ID.get(strategy_id)


def get_strategies_for_emotion(emotion: str) -> List[CopingStrategy]:
    return _BY_EMOTION.get(emotion, [])


def get_all_strategy_ids() -> List[str]:
    return list(_BY_ID.keys())


def get_all_emotions() -> List[str]:
    return sorted(_BY_EMOTION.keys())
