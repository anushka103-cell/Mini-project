"""
Emotion Detection & NLP Microservice
Date: 2026-03-27
Framework: Python FastAPI
Features: Real-time sentiment analysis, emotion detection, crisis keyword detection
Models: Transformers (BERT for emotions), VADER for sentiment
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List
import logging
from datetime import datetime
from enum import Enum
import os
from dotenv import load_dotenv

# ML Libraries
import numpy as np
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch

# =================== SETUP ===================
load_dotenv()

app = FastAPI(
    title="MindSafe Emotion Detection Service",
    version="1.0.0",
    description="Real-time emotion detection and sentiment analysis"
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =================== MODELS ===================

class SentimentEnum(str, Enum):
    VERY_NEGATIVE = "very_negative"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    POSITIVE = "positive"
    VERY_POSITIVE = "very_positive"

class EmotionEnum(str, Enum):
    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    SURPRISE = "surprise"
    DISGUST = "disgust"
    TRUST = "trust"
    ANTICIPATION = "anticipation"
    NEUTRAL = "neutral"

class CrisisLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# Request models
class AnalyzeTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    
    @validator('text')
    def text_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Text cannot be empty')
        return v.strip()

class BatchAnalysisRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=100)
    user_id: Optional[str] = None

# Response models
class SentimentAnalysis(BaseModel):
    sentiment: SentimentEnum
    score: float = Field(..., ge=-1.0, le=1.0)
    confidence: float = Field(..., ge=0, le=1)

class EmotionAnalysis(BaseModel):
    emotion: EmotionEnum
    confidence: float = Field(..., ge=0, le=1)
    all_emotions: dict[str, float]

class CrisisDetectionResult(BaseModel):
    is_crisis: bool
    crisis_level: CrisisLevel
    crisis_keywords: List[str]
    risk_score: float = Field(..., ge=0, le=1)
    reason: str

class TextAnalysisResponse(BaseModel):
    text: str
    sentiment: SentimentAnalysis
    emotion: EmotionAnalysis
    crisis_detection: CrisisDetectionResult
    language: str
    processing_time_ms: float
    timestamp: datetime

# =================== ML MODELS LOADING ===================

class EmotionDetectionModel:
    """Wrapper for emotion detection models"""
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
        try:
            # Emotion classification model
            self.emotion_model = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                device=0 if self.device == "cuda" else -1
            )
            logger.info("✓ Emotion detection model loaded")
        except Exception as e:
            logger.error(f"Failed to load emotion model: {e}")
            self.emotion_model = None
        
        try:
            # Sentiment analysis model
            self.sentiment_model = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=0 if self.device == "cuda" else -1
            )
            logger.info("✓ Sentiment analysis model loaded")
        except Exception as e:
            logger.error(f"Failed to load sentiment model: {e}")
            self.sentiment_model = None
        
        # Crisis keywords (expanded list)
        self.crisis_keywords = {
            "critical": [
                "suicide", "kill myself", "end my life", "take my life",
                "harm myself", "self harm", "self-harm", "cut myself",
                "OD", "overdose", "poison", "hang myself", "jump",
                "want to die", "wanna die", "should be dead", "better off dead"
            ],
            "high": [
                "depressed", "depression", "anxiety attack", "panic attack",
                "suicidal", "suicidal thoughts", "hopeless", "worthless",
                "can't handle it", "can't take it", "at breaking point",
                "going crazy", "losing control", "everything is falling apart"
            ],
            "medium": [
                "stressed", "overwhelmed", "anxious", "worried", "scared",
                "nervous", "afraid", "terrified", "panicking", "hyperventilating",
                "can't sleep", "having nightmares", "can't focus", "memory loss"
            ]
        }
    
    def analyze_sentiment(self, text: str) -> dict:
        """Analyze sentiment using DistilBERT"""
        if not self.sentiment_model:
            logger.warning("Sentiment model not available")
            return {
                "sentiment": "NEUTRAL",
                "score": 0.0,
                "confidence": 0.0
            }
        
        try:
            result = self.sentiment_model(text[:512])[0]  # Limit to 512 tokens
            
            # Convert to our scale (-1 to 1)
            score = 1.0 if result["label"] == "POSITIVE" else -1.0
            score *= (result["score"] - 0.5) * 2  # Normalize to -1 to 1
            
            # Map to sentiment level
            if score > 0.5:
                sentiment = SentimentEnum.VERY_POSITIVE
            elif score > 0.1:
                sentiment = SentimentEnum.POSITIVE
            elif score > -0.1:
                sentiment = SentimentEnum.NEUTRAL
            elif score > -0.5:
                sentiment = SentimentEnum.NEGATIVE
            else:
                sentiment = SentimentEnum.VERY_NEGATIVE
            
            return {
                "sentiment": sentiment,
                "score": float(score),
                "confidence": float(result["score"])
            }
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return {
                "sentiment": SentimentEnum.NEUTRAL,
                "score": 0.0,
                "confidence": 0.0
            }
    
    def analyze_emotion(self, text: str) -> dict:
        """Analyze emotions using j-hartmann model"""
        if not self.emotion_model:
            logger.warning("Emotion model not available")
            return {
                "emotion": EmotionEnum.NEUTRAL,
                "confidence": 0.0,
                "all_emotions": {}
            }
        
        try:
            results = self.emotion_model(text[:512])
            
            # Map model outputs to our emotion enum
            emotion_mapping = {
                "joy": EmotionEnum.JOY,
                "sadness": EmotionEnum.SADNESS,
                "anger": EmotionEnum.ANGER,
                "fear": EmotionEnum.FEAR,
                "surprise": EmotionEnum.SURPRISE,
                "disgust": EmotionEnum.DISGUST,
                "trust": EmotionEnum.TRUST,
                "anticipation": EmotionEnum.ANTICIPATION
            }
            
            primary_emotion = emotion_mapping.get(
                results[0]["label"].lower(),
                EmotionEnum.SURPRISE
            )
            
            # Get all emotion scores if multiple results
            all_emotions = {
                emotion_mapping.get(r["label"].lower(), "unknown"): r["score"]
                for r in results
            }
            
            return {
                "emotion": primary_emotion,
                "confidence": float(results[0]["score"]),
                "all_emotions": all_emotions
            }
        except Exception as e:
            logger.error(f"Emotion analysis error: {e}")
            return {
                "emotion": EmotionEnum.SURPRISE,
                "confidence": 0.0,
                "all_emotions": {}
            }
    
    def detect_crisis(self, text: str) -> dict:
        """Detect crisis keywords and assess risk"""
        text_lower = text.lower()
        matched_keywords = []
        max_severity = 0  # 0=low, 1=medium, 2=high, 3=critical
        
        for level, keywords in self.crisis_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    matched_keywords.append(keyword)
                    severity_map = {"critical": 3, "high": 2, "medium": 1}
                    max_severity = max(max_severity, severity_map.get(level, 0))
        
        # Risk scoring based on keywords and sentiment
        risk_score = min(1.0, len(matched_keywords) * 0.3 + (max_severity * 0.25))
        
        severity_levels = {
            3: CrisisLevel.CRITICAL,
            2: CrisisLevel.HIGH,
            1: CrisisLevel.MEDIUM,
            0: CrisisLevel.LOW
        }
        
        return {
            "is_crisis": max_severity > 0,
            "crisis_level": severity_levels.get(max_severity, CrisisLevel.LOW),
            "crisis_keywords": list(set(matched_keywords)),  # Unique keywords
            "risk_score": risk_score,
            "reason": f"Detected {len(matched_keywords)} crisis indicator(s)"
        }

# Initialize model
emotion_detector = EmotionDetectionModel()

# =================== HEALTH CHECK ===================
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "emotion-detection",
        "timestamp": datetime.now().isoformat()
    }

# =================== MAIN ENDPOINTS ===================

@app.post("/analyze", response_model=TextAnalysisResponse)
async def analyze_text(request: AnalyzeTextRequest):
    """
    Analyze text for sentiment, emotions, and crisis indicators
    
    Args:
        request: AnalyzeTextRequest with text and optional metadata
    
    Returns:
        TextAnalysisResponse with comprehensive analysis
    """
    start_time = datetime.now()
    
    try:
        text = request.text.strip()
        
        # Run analyses in parallel (conceptually)
        sentiment_result = emotion_detector.analyze_sentiment(text)
        emotion_result = emotion_detector.analyze_emotion(text)
        crisis_result = emotion_detector.detect_crisis(text)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        response = TextAnalysisResponse(
            text=text,
            sentiment=SentimentAnalysis(**sentiment_result),
            emotion=EmotionAnalysis(**emotion_result),
            crisis_detection=CrisisDetectionResult(**crisis_result),
            language="en",  # TODO: Detect language
            processing_time_ms=processing_time,
            timestamp=datetime.now()
        )
        
        logger.info(f"Analyzed text for user {request.user_id}: "
                   f"sentiment={sentiment_result['sentiment']}, "
                   f"crisis={crisis_result['is_crisis']}")
        
        return response
        
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Text analysis failed"
        )

@app.post("/batch-analyze")
async def batch_analyze(request: BatchAnalysisRequest):
    """
    Analyze multiple texts at once
    
    Args:
        request: BatchAnalysisRequest with list of texts
    
    Returns:
        List of analyses
    """
    try:
        results = []
        
        for text in request.texts:
            sentiment = emotion_detector.analyze_sentiment(text)
            emotion = emotion_detector.analyze_emotion(text)
            crisis = emotion_detector.detect_crisis(text)
            
            results.append({
                "text": text[:100],  # Truncate for response size
                "sentiment": sentiment["sentiment"],
                "emotion": emotion["emotion"],
                "is_crisis": crisis["is_crisis"],
                "risk_score": crisis["risk_score"]
            })
        
        return {
            "success": True,
            "count": len(results),
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch analysis failed"
        )

# =================== STATS & MONITORING ===================

@app.get("/stats")
async def get_stats():
    """Get service statistics and model information"""
    return {
        "service": "emotion-detection",
        "models": {
            "sentiment": "distilbert-base-uncased-finetuned-sst-2-english",
            "emotion": "j-hartmann/emotion-english-distilroberta-base"
        },
        "device": emotion_detector.device,
        "crisis_keywords_count": sum(len(k) for k in emotion_detector.crisis_keywords.values()),
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

# =================== ERROR HANDLING ===================

@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
