"""
MindSafe Emotion Detection Module

A production-ready emotion detection system using HuggingFace transformers.
Supports multiple detection strategies with caching and confidence scoring.

Author: MindSafe Team
License: MIT
"""

import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from functools import lru_cache
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress HuggingFace Hub unauthenticated warnings (non-blocking)
logging.getLogger('huggingface_hub.utils._http').setLevel(logging.ERROR)


@dataclass
class EmotionResult:
    """
    Structured result from emotion detection.
    
    Attributes:
        primary_emotion (str): Dominant detected emotion
        confidence (float): Confidence score of primary emotion (0-1)
        all_emotions (Dict[str, float]): All emotions with scores
        intensity (float): Overall emotional intensity (0-1)
        timestamp (str): ISO format timestamp of detection
        latency_ms (float): Processing time in milliseconds
    """
    primary_emotion: str
    confidence: float
    all_emotions: Dict[str, float]
    intensity: float
    timestamp: str
    latency_ms: float


class EmotionDetector:
    """
    Main emotion detection class using multiple HuggingFace models.
    
    Supported emotions: sadness, anxiety, anger, happiness, stress, neutral
    
    Example:
        >>> detector = EmotionDetector(device='cuda' if torch.cuda.is_available() else 'cpu')
        >>> result = detector.detect("I'm feeling really sad today")
        >>> print(result.primary_emotion)  # Output: "sadness"
        >>> print(result.confidence)        # Output: 0.92
    """
    
    # Emotion mapping: maps model outputs to our target emotions
    EMOTION_LABELS = {
        "sadness": ["sadness", "sad", "depressed", "discouraged", "disheartened"],
        "anxiety": ["anxiety", "anxious", "worried", "nervous", "fear"],
        "anger": ["anger", "angry", "frustrated", "irritated", "enraged"],
        "happiness": ["happiness", "happy", "joy", "joyful", "delighted"],
        "stress": ["stress", "stressed", "overwhelmed", "tense", "pressured"],
        "neutral": ["neutral", "calm", "composed", "relaxed"]
    }
    
    def __init__(
        self,
        model_name: str = "j-hartmann/emotion-english-roberta-large",
        device: str = None,
        cache_size: int = 128
    ):
        """
        Initialize the emotion detector.
        
        Args:
            model_name (str): HuggingFace model identifier
            device (str): 'cuda' or 'cpu'. Auto-detects if None
            cache_size (int): LRU cache size for predictions
            
        Raises:
            RuntimeError: If model download fails
        """
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model_name = model_name
        self.cache_size = cache_size
        
        logger.info(f"Initializing EmotionDetector with {model_name}")
        logger.info(f"Using device: {self.device}")
        
        try:
            # Load tokenizer and model from HuggingFace
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name
            ).to(self.device)
            
            # Set model to evaluation mode (no dropout, batch norm frozen)
            self.model.eval()
            
            # Create pipeline for easier inference
            self.pipeline = pipeline(
                "text-classification",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if self.device == 'cuda' else -1,
                top_k=None
            )
            
            logger.info("EmotionDetector initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize EmotionDetector: {str(e)}")
            raise RuntimeError(f"Model initialization failed: {str(e)}")
        
        # Initialize cache
        self._cache = {}
    
    def detect(
        self,
        text: str,
        return_intensity: bool = True,
        max_length: int = 512
    ) -> EmotionResult:
        """
        Detect emotion from input text.
        
        Args:
            text (str): Input text to analyze (required)
            return_intensity (bool): Calculate emotional intensity (default: True)
            max_length (int): Maximum text length to process (default: 512)
            
        Returns:
            EmotionResult: Emotion prediction with confidence scores
            
        Example:
            >>> result = detector.detect("I'm so happy!")
            >>> print(f"Emotion: {result.primary_emotion}")
            >>> print(f"Confidence: {result.confidence:.2%}")
            >>> print(f"All emotions: {result.all_emotions}")
        """
        import time
        start_time = time.time()
        
        # Input validation
        if not text or not isinstance(text, str):
            logger.warning("Invalid input: text must be non-empty string")
            raise ValueError("Text must be a non-empty string")
        
        # Clean and truncate text
        text = text.strip()[:max_length]
        if not text:
            logger.warning("Invalid input: text cannot be whitespace only")
            raise ValueError("Text must be a non-empty string")
        
        # Check cache
        cache_key = hash(text)
        if cache_key in self._cache:
            logger.debug(f"Cache hit for text: {text[:50]}...")
            return self._cache[cache_key]
        
        try:
            # Get model predictions
            predictions = self.pipeline(text)
            
            # Process predictions (pipeline returns list of dicts)
            emotion_scores = self._process_predictions(predictions)
            emotion_scores = self._apply_text_signal(emotion_scores, text)
            
            # Get primary emotion and confidence
            primary_emotion = max(emotion_scores, key=emotion_scores.get)
            confidence = emotion_scores[primary_emotion]
            
            # Calculate intensity if requested
            intensity = (
                self._calculate_intensity(text, emotion_scores)
                if return_intensity else 0.5
            )
            
            # Create result object
            result = EmotionResult(
                primary_emotion=primary_emotion,
                confidence=float(confidence),
                all_emotions=emotion_scores,
                intensity=float(intensity),
                timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                latency_ms=round((time.time() - start_time) * 1000, 2)
            )
            
            # Cache result
            if len(self._cache) < self.cache_size:
                self._cache[cache_key] = result
            
            logger.info(
                f"Emotion detected: {primary_emotion} "
                f"(confidence: {confidence:.2%}, latency: {result.latency_ms}ms)"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Emotion detection failed: {str(e)}")
            raise RuntimeError(f"Detection failed: {str(e)}")
    
    def detect_batch(
        self,
        texts: List[str],
        batch_size: int = 32
    ) -> List[EmotionResult]:
        """
        Detect emotions from multiple texts efficiently.
        
        Args:
            texts (List[str]): List of input texts
            batch_size (int): Number of texts to process at once (default: 32)
            
        Returns:
            List[EmotionResult]: Emotion predictions for each text
            
        Example:
            >>> texts = ["I'm happy", "I'm sad", "I'm angry"]
            >>> results = detector.detect_batch(texts)
            >>> for result in results:
            ...     print(f"{result.primary_emotion}: {result.confidence:.2%}")
        """
        logger.info(f"Processing batch of {len(texts)} texts")
        results = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            for text in batch:
                try:
                    result = self.detect(text)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Failed to detect emotion in batch: {str(e)}")
                    results.append(None)
        
        logger.info(f"Batch processing complete. Results: {len(results)}")
        return results
    
    def _process_predictions(
        self,
        predictions: List[Dict]
    ) -> Dict[str, float]:
        """
        Convert model predictions to our emotion labels.
        
        Args:
            predictions (List[Dict]): Raw model predictions
            
        Returns:
            Dict[str, float]: Normalized emotion scores (sum = 1.0)
        """
        # Initialize emotion scores
        emotion_scores = {emotion: 0.0 for emotion in self.EMOTION_LABELS.keys()}

        # Newer transformers may return nested lists for single inputs.
        if predictions and isinstance(predictions[0], list):
            predictions = predictions[0]

        label_map = {
            "sadness": "sadness",
            "fear": "anxiety",
            "anger": "anger",
            "joy": "happiness",
            "neutral": "neutral",
            "disgust": "stress",
            "surprise": "anxiety"
        }
        
        # Map model outputs to our emotions
        for pred in predictions:
            if not isinstance(pred, dict):
                continue

            label = str(pred.get('label', '')).lower()
            score = float(pred.get('score', 0.0))

            if label in label_map:
                emotion_scores[label_map[label]] += score
                continue
            
            # Find matching emotion
            for emotion, keywords in self.EMOTION_LABELS.items():
                if label in keywords or any(kw in label for kw in keywords):
                    emotion_scores[emotion] += score
        
        # Normalize scores to sum to 1.0
        total = sum(emotion_scores.values()) or 1.0
        emotion_scores = {
            emotion: score / total 
            for emotion, score in emotion_scores.items()
        }
        
        return emotion_scores

    def _apply_text_signal(
        self,
        emotion_scores: Dict[str, float],
        text: str
    ) -> Dict[str, float]:
        """Blend lexical cues with model scores for better domain behavior."""
        lower_text = text.lower()

        keyword_weights = {
            "stress": {
                "stress": 0.35,
                "stressed": 0.45,
                "overwhelmed": 0.65,
                "pressure": 0.30,
                "pressured": 0.35,
                "burned out": 0.50,
                "exhausted": 0.40
            },
            "anxiety": {
                "anxiety": 0.35,
                "anxious": 0.40,
                "worried": 0.35,
                "nervous": 0.30,
                "panic": 0.45,
                "terrified": 0.55,
                "fear": 0.35
            },
            "happiness": {
                "happy": 0.35,
                "happiness": 0.35,
                "excited": 0.50,
                "joy": 0.40,
                "joyful": 0.45,
                "thrilled": 0.50,
                "wonderful": 0.35
            },
            "sadness": {
                "sad": 0.35,
                "sadness": 0.35,
                "down": 0.30,
                "depressed": 0.50,
                "empty": 0.35,
                "crying": 0.40,
                "hopeless": 0.45
            },
            "anger": {
                "angry": 0.35,
                "anger": 0.35,
                "furious": 0.55,
                "mad": 0.30,
                "irritated": 0.30,
                "frustrated": 0.35,
                "rage": 0.40
            },
            "neutral": {
                "okay": 0.20,
                "fine": 0.20,
                "normal": 0.20,
                "neutral": 0.20,
                "calm": 0.25
            }
        }

        for emotion, weighted_terms in keyword_weights.items():
            boost = 0.0
            for term, weight in weighted_terms.items():
                if term in lower_text:
                    boost += weight
            if boost > 0.0:
                emotion_scores[emotion] += min(1.2, boost)

        # Phrase-level balancing for common mental-health expressions.
        if "overwhelmed" in lower_text:
            emotion_scores["stress"] += 0.45

        if "excited" in lower_text and "nervous" in lower_text:
            emotion_scores["happiness"] += 0.15

        total = sum(emotion_scores.values()) or 1.0
        return {
            emotion: score / total
            for emotion, score in emotion_scores.items()
        }
    
    def _calculate_intensity(
        self,
        text: str,
        emotion_scores: Dict[str, float]
    ) -> float:
        """
        Calculate emotional intensity based on text features and confidence.
        
        Factors considered:
        - Uppercase letters (shouting)
        - Exclamation marks (emphasis)
        - Word repetition
        - Model confidence score
        
        Args:
            text (str): Input text
            emotion_scores (Dict[str, float]): Emotion confidence scores
            
        Returns:
            float: Intensity score (0-1)
        """
        intensity = 0.0
        lower_text = text.lower()
        
        # 1. Uppercase analysis
        uppercase_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
        if uppercase_ratio > 0.2:
            intensity += min(0.25, uppercase_ratio * 0.9)
        
        # 2. Exclamation marks (caps lock equivalent for punctuation)
        exclamation_count = text.count('!')
        if exclamation_count > 0:
            intensity += min(0.25, exclamation_count * 0.08)
        
        # 3. Repetition (e.g., "no no no" or "...")
        words = text.split()
        if len(words) > 1:
            word_freq = {}
            for word in words:
                word_freq[word] = word_freq.get(word, 0) + 1
            
            max_freq = max(word_freq.values())
            if max_freq >= 2:
                intensity += min(0.3, max_freq * 0.08)
        
        # 4. Ellipsis or dashes (trailing off or emphasis)
        ellipsis_count = text.count("...")
        if ellipsis_count > 0 or "---" in text or "***" in text:
            intensity += min(0.2, 0.1 * max(ellipsis_count, 1))
        
        # 5. Intensifier terms
        intensifiers = ["very", "really", "so", "extremely", "terrified", "furious", "overwhelmed"]
        if any(term in lower_text for term in intensifiers):
            intensity += 0.08

        # 6. Model confidence (primary emotion strength)
        max_confidence = max(emotion_scores.values()) if emotion_scores else 0.5
        intensity += max_confidence * 0.35
        
        # Ensure intensity is in valid range
        intensity = max(0.0, min(1.0, intensity))
        
        return intensity
    
    def get_coping_strategies(
        self,
        emotion: str,
        detail_level: int = 3
    ) -> List[str]:
        """
        Get coping strategies for detected emotion.
        
        Args:
            emotion (str): Emotion type (e.g., "sadness")
            detail_level (int): Number of strategies to return (default: 3)
            
        Returns:
            List[str]: Recommended coping strategies
            
        Example:
            >>> strategies = detector.get_coping_strategies("anxiety")
            >>> print(strategies)
            ['Deep breathing exercises', 'Grounding technique', ...]
        """
        coping_db = {
            "sadness": [
                "Reach out to someone you trust",
                "Engage in activities you enjoy",
                "Practice self-compassion",
                "Get physical exercise",
                "Spend time in nature",
                "Write in a journal"
            ],
            "anxiety": [
                "Practice deep breathing exercises",
                "Use the 5-4-3-2-1 grounding technique",
                "Progressive muscle relaxation",
                "Limit caffeine intake",
                "Try meditation or mindfulness",
                "Establish a bedtime routine"
            ],
            "anger": [
                "Take a time-out to cool down",
                "Practice deep breathing",
                "Physical exercise or sports",
                "Identify what triggered your anger",
                "Talk to someone calmly",
                "Creative expression (art, music)"
            ],
            "happiness": [
                "Share your joy with others",
                "Savor the moment mindfully",
                "Do something kind for someone",
                "Document this positive moment",
                "Continue the positive activity",
                "Celebrate your win"
            ],
            "stress": [
                "Break tasks into smaller steps",
                "Practice time management",
                "Take regular breaks",
                "Practice relaxation techniques",
                "Exercise or stretch",
                "Get adequate sleep"
            ],
            "neutral": [
                "Maintain your current routine",
                "Practice self-care regularly",
                "Set realistic goals",
                "Balance work and leisure",
                "Stay socially connected",
                "Reflect on your well-being"
            ]
        }
        
        strategies = coping_db.get(emotion, coping_db["neutral"])
        return strategies[:detail_level]
    
    def clear_cache(self) -> None:
        """Clear the prediction cache to free memory."""
        self._cache.clear()
        logger.info("Prediction cache cleared")


# Convenience functions for direct usage
_detector: Optional[EmotionDetector] = None


def initialize_detector(
    model_name: str = "j-hartmann/emotion-english-roberta-large",
    device: str = None
) -> EmotionDetector:
    """
    Initialize global emotion detector instance.
    
    Args:
        model_name (str): HuggingFace model to use
        device (str): 'cuda' or 'cpu'
        
    Returns:
        EmotionDetector: Initialized detector instance
    """
    global _detector
    _detector = EmotionDetector(model_name=model_name, device=device)
    return _detector


def get_detector() -> EmotionDetector:
    """
    Get global emotion detector instance (returns singleton).
    Initializes if not already created.
    
    Returns:
        EmotionDetector: Detector instance
    """
    global _detector
    if _detector is None:
        _detector = EmotionDetector()
    return _detector


def detect_emotion(text: str) -> EmotionResult:
    """
    Simple function interface for one-off emotion detection.
    
    Args:
        text (str): Input text to analyze
        
    Returns:
        EmotionResult: Emotion prediction with scores
        
    Example:
        >>> result = detect_emotion("I'm feeling great!")
        >>> print(result.primary_emotion)
    """
    detector = get_detector()
    return detector.detect(text)
