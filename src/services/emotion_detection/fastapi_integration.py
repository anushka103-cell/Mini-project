"""
Emotion Detection Integration with FastAPI Service

Shows how to integrate the emotion_detector module with the existing
FastAPI emotion detection microservice.

Usage:
    1. Add this to src/services/emotion_detection/main.py
    2. Restart the service: docker compose up -d --build emotion_detection
    3. Test: curl -X POST http://localhost:8001/api/emotions/detect \
            -H "Content-Type: application/json" \
            -d '{"text": "I am feeling sad"}'
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import logging
from emotion_detector import (
    EmotionDetector,
    EmotionResult,
    initialize_detector,
    get_detector
)
import torch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Emotion Detection Service",
    description="AI-powered emotion detection from text",
    version="1.0.0"
)


# ============================================================================
# Pydantic Models (API Request/Response schemas)
# ============================================================================

class EmotionDetectionRequest(BaseModel):
    """Request model for emotion detection"""
    text: str = Field(..., min_length=1, max_length=2000, description="User text to analyze")
    return_intensity: bool = Field(True, description="Calculate emotional intensity")
    return_strategies: bool = Field(True, description="Include coping strategies")


class EmotionDetectionResponse(BaseModel):
    """Response model for emotion detection"""
    primary_emotion: str = Field(..., description="Dominant detected emotion")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score (0-1)")
    intensity: float = Field(..., ge=0, le=1, description="Emotional intensity (0-1)")
    all_emotions: dict = Field(..., description="All emotions with scores")
    suggested_strategies: Optional[List[str]] = Field(None, description="Recommended coping strategies")
    latency_ms: float = Field(..., description="Processing time in milliseconds")


class BatchEmotionRequest(BaseModel):
    """Request model for batch emotion detection"""
    texts: List[str] = Field(..., min_items=1, max_items=100, description="List of texts to analyze")
    batch_size: int = Field(32, ge=1, le=128, description="Processing batch size")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model: str
    device: str
    gpu_available: bool


# ============================================================================
# Global Detector Instance
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize emotion detector on app startup"""
    logger.info("Starting Emotion Detection Service...")
    try:
        initialize_detector()
        detector = get_detector()
        logger.info(f"✓ Emotion detector ready on {detector.device}")
    except Exception as e:
        logger.error(f"Failed to initialize detector: {str(e)}")
        raise


# ============================================================================
# API Endpoints
# ============================================================================

@app.post("/api/emotions/detect", response_model=EmotionDetectionResponse)
async def detect_emotion_endpoint(request: EmotionDetectionRequest):
    """
    Detect emotion from user text.
    
    Example request:
    {
        "text": "I'm feeling really sad today",
        "return_intensity": true,
        "return_strategies": true
    }
    
    Example response:
    {
        "primary_emotion": "sadness",
        "confidence": 0.92,
        "intensity": 0.78,
        "all_emotions": {
            "sadness": 0.92,
            "anxiety": 0.05,
            "anger": 0.02,
            "happiness": 0.01,
            "stress": 0.00,
            "neutral": 0.00
        },
        "suggested_strategies": [
            "Reach out to someone you trust",
            "Engage in activities you enjoy",
            "Practice self-compassion"
        ],
        "latency_ms": 145.32
    }
    """
    try:
        detector = get_detector()
        result: EmotionResult = detector.detect(
            request.text,
            return_intensity=request.return_intensity
        )
        
        strategies = None
        if request.return_strategies:
            strategies = detector.get_coping_strategies(
                result.primary_emotion,
                detail_level=3
            )
        
        return EmotionDetectionResponse(
            primary_emotion=result.primary_emotion,
            confidence=result.confidence,
            intensity=result.intensity,
            all_emotions=result.all_emotions,
            suggested_strategies=strategies,
            latency_ms=result.latency_ms
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Detection error: {str(e)}")
        raise HTTPException(status_code=500, detail="Emotion detection failed")


@app.post("/api/emotions/detect-batch")
async def detect_batch_endpoint(request: BatchEmotionRequest):
    """
    Detect emotions from multiple texts efficiently.
    
    Example request:
    {
        "texts": [
            "I'm happy",
            "I'm sad",
            "I'm angry"
        ],
        "batch_size": 32
    }
    
    Example response:
    {
        "results": [
            {
                "text": "I'm happy",
                "primary_emotion": "happiness",
                "confidence": 0.95,
                ...
            },
            ...
        ],
        "processing_time_ms": 450.12
    }
    """
    import time
    
    start_time = time.time()
    
    try:
        detector = get_detector()
        results = detector.detect_batch(request.texts, batch_size=request.batch_size)
        
        # Format results
        formatted_results = []
        for text, result in zip(request.texts, results):
            if result is not None:
                formatted_results.append({
                    "text": text,
                    "primary_emotion": result.primary_emotion,
                    "confidence": result.confidence,
                    "intensity": result.intensity,
                    "all_emotions": result.all_emotions,
                    "latency_ms": result.latency_ms
                })
            else:
                formatted_results.append({
                    "text": text,
                    "error": "Processing failed"
                })
        
        return {
            "status": "success",
            "count": len(request.texts),
            "results": formatted_results,
            "processing_time_ms": round((time.time() - start_time) * 1000, 2)
        }
    
    except Exception as e:
        logger.error(f"Batch processing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Batch processing failed")


@app.get("/api/emotions/strategies/{emotion}")
async def get_strategies(emotion: str, count: int = 3):
    """
    Get coping strategies for a specific emotion.
    
    Example: GET /api/emotions/strategies/anxiety?count=5
    
    Response:
    {
        "emotion": "anxiety",
        "strategies": [
            "Practice deep breathing exercises",
            "Use the 5-4-3-2-1 grounding technique",
            ...
        ]
    }
    """
    detector = get_detector()
    valid_emotions = list(detector.EMOTION_LABELS.keys())
    
    if emotion.lower() not in valid_emotions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid emotion. Must be one of: {valid_emotions}"
        )
    
    strategies = detector.get_coping_strategies(emotion.lower(), detail_level=count)
    
    return {
        "emotion": emotion.lower(),
        "strategies": strategies
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for load balancer"""
    detector = get_detector()
    return HealthResponse(
        status="healthy",
        model=detector.model_name,
        device=detector.device,
        gpu_available=torch.cuda.is_available()
    )


@app.get("/api/emotions/labels")
async def get_available_emotions():
    """Get all supported emotion labels"""
    detector = get_detector()
    return {
        "emotions": list(detector.EMOTION_LABELS.keys()),
        "total": len(detector.EMOTION_LABELS)
    }


# ============================================================================
# Chatbot Integration Example
# ============================================================================

class ChatbotIntegration:
    """
    Example integration of emotion detection with a chatbot.
    
    Usage in your chatbot code:
    
    from main import ChatbotIntegration
    
    chatbot = ChatbotIntegration()
    response = chatbot.generate_response("I'm feeling sad")
    """
    
    def __init__(self):
        self.detector = get_detector()
    
    def generate_response(self, user_message: str) -> dict:
        """
        Generate a chatbot response based on emotion analysis.
        
        Args:
            user_message (str): User's message
            
        Returns:
            dict: Response with emotion context
        """
        # Detect emotion
        emotion_result = self.detector.detect(user_message)
        
        # Empathetic responses based on emotion
        response_templates = {
            "sadness": (
                "I hear that you're feeling down. That's a real and valid emotion. "
                "Remember that these feelings can change, and talking about them is a positive step. "
                "Would you like to share what's making you feel this way?"
            ),
            "anxiety": (
                "It sounds like anxiety is affecting you right now. That's more common than you might think. "
                "Let's take this one step at a time. Sometimes breaking things down into smaller pieces helps. "
                "What's worrying you the most?"
            ),
            "anger": (
                "I can sense your frustration, and your feelings are justified. "
                "Anger often signals that something important to you has been affected. "
                "It's okay to feel this way. What triggered this?"
            ),
            "happiness": (
                "That's wonderful! Your joy and excitement are contagious. "
                "It's great to celebrate the good moments. Keep riding this wave of positivity!"
            ),
            "stress": (
                "You sound like you're carrying a lot right now. Feeling overwhelmed is a sign "
                "that you might need to lighten the load a bit. Let's work through this together. "
                "What feels most pressing to you?"
            ),
            "neutral": (
                "Thank you for sharing that. I'm here to listen and support you however I can. "
                "How are you really feeling today?"
            )
        }
        
        base_response = response_templates.get(
            emotion_result.primary_emotion,
            "I'm listening. Tell me more about what you're experiencing."
        )
        
        # Get coping strategies
        strategies = self.detector.get_coping_strategies(
            emotion_result.primary_emotion,
            detail_level=2
        )
        
        return {
            "response": base_response,
            "emotion": {
                "primary": emotion_result.primary_emotion,
                "confidence": f"{emotion_result.confidence:.1%}",
                "intensity": f"{emotion_result.intensity:.2f}",
            },
            "suggestions": {
                "type": "coping_strategies",
                "items": strategies
            },
            "metadata": {
                "model": self.detector.model_name,
                "processing_time_ms": emotion_result.latency_ms
            }
        }


# ============================================================================
# Testing Endpoint (for development only)
# ============================================================================

@app.post("/test/detect")
async def test_detect(text: str):
    """
    Quick test endpoint (development only).
    
    Usage: curl "http://localhost:8001/test/detect?text=I%20am%20sad"
    """
    detector = get_detector()
    result = detector.detect(text)
    
    return {
        "input": text,
        "emotion": result.primary_emotion,
        "confidence": f"{result.confidence:.2%}",
        "intensity": f"{result.intensity:.2f}"
    }


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Emotion Detection Service on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001, workers=1)
