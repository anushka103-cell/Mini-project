"""
Crisis Detection & Response Service
Date: 2026-03-27
Framework: Python FastAPI
Features: Real-time crisis detection, emergency escalation, resource provision
"""

from fastapi import FastAPI, HTTPException, status, WebSocket
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import os
from enum import Enum
from dotenv import load_dotenv
import asyncio
import json

# =================== SETUP ===================
load_dotenv()

app = FastAPI(
    title="MindSafe Crisis Detection Service",
    version="1.0.0",
    description="Real-time crisis detection and emergency response"
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =================== ENUMS & MODELS ===================

class CrisisLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ResponseAction(str, Enum):
    AUTO_NOTIFY = "auto_notify"
    ALERT_GUARDIAN = "alert_guardian"
    CONTACT_EMERGENCY = "contact_emergency"
    PROVIDE_RESOURCES = "provide_resources"

class CrisisIndicator(BaseModel):
    type: str  # "keyword", "behaviour", "pattern", "user_report"
    severity: CrisisLevel
    confidence: float = Field(..., ge=0, le=1)
    trigger_text: Optional[str] = None
    timestamp: datetime

class CrisisDetectionRequest(BaseModel):
    user_id: str
    indicators: List[CrisisIndicator]
    context: Optional[str] = None
    recent_mood_trend: Optional[str] = None

class EmergencyResource(BaseModel):
    name: str
    type: str  # "hotline", "chat", "location", "resource"
    description: str
    contact: str  # Phone, URL, or address
    available_24_7: bool
    languages: List[str] = ["en"]

class CrisisResponsePlan(BaseModel):
    crisis_id: str
    user_id: str
    detected_level: CrisisLevel
    actions_taken: List[ResponseAction]
    resources_provided: List[EmergencyResource]
    notifications_sent: List[str]
    escalation_status: str
    follow_up_scheduled: Optional[datetime] = None
    timestamp: datetime

class CrisisMonitoringRequest(BaseModel):
    user_id: str
    check_interval_minutes: int = Field(default=5, ge=1, le=60)

# =================== CRISIS DATABASE & CONFIGURATION ===================

# Emergency resources database
EMERGENCY_RESOURCES = {
    "US": [
        EmergencyResource(
            name="National Suicide Prevention Lifeline",
            type="hotline",
            description="Free, confidential support 24/7",
            contact="988",
            available_24_7=True,
            languages=["en"]
        ),
        EmergencyResource(
            name="Crisis Text Line",
            type="chat",
            description="Text HOME to get support",
            contact="741741",
            available_24_7=True,
            languages=["en"]
        ),
        EmergencyResource(
            name="Emergency Services",
            type="emergency",
            description="Immediate emergency response",
            contact="911",
            available_24_7=True,
            languages=["en"]
        ),
        EmergencyResource(
            name="SAMHSA National Helpline",
            type="hotline",
            description="Substance abuse and mental health support",
            contact="1-800-662-4357",
            available_24_7=True,
            languages=["en"]
        ),
        EmergencyResource(
            name="International Association for Suicide Prevention",
            type="resource",
            description="Global crisis resources directory",
            contact="https://www.iasp.info/resources/Crisis_Centres/",
            available_24_7=True,
            languages=["en"]
        )
    ],
    "UK": [
        EmergencyResource(
            name="Samaritans",
            type="hotline",
            description="24/7 emotional support",
            contact="116 123",
            available_24_7=True,
            languages=["en"]
        ),
        EmergencyResource(
            name="Mind",
            type="chat",
            description="Mental health information and support",
            contact="https://www.mind.org.uk/",
            available_24_7=False,
            languages=["en"]
        ),
    ]
}

# Crisis escalation rules
CRISIS_ESCALATION_RULES = {
    CrisisLevel.LOW: {
        "actions": [ResponseAction.PROVIDE_RESOURCES],
        "escalate_if_multiple": 3,
        "check_frequency_hours": 24
    },
    CrisisLevel.MEDIUM: {
        "actions": [ResponseAction.ALERT_GUARDIAN, ResponseAction.PROVIDE_RESOURCES],
        "escalate_if_repeated": True,
        "check_frequency_hours": 2
    },
    CrisisLevel.HIGH: {
        "actions": [ResponseAction.ALERT_GUARDIAN, ResponseAction.PROVIDE_RESOURCES, ResponseAction.AUTO_NOTIFY],
        "escalate_if_repeated": True,
        "check_frequency_hours": 1
    },
    CrisisLevel.CRITICAL: {
        "actions": [ResponseAction.CONTACT_EMERGENCY, ResponseAction.ALERT_GUARDIAN],
        "immediate_response": True,
        "check_frequency_minutes": 5
    }
}

# In-memory crisis tracking (use database in production)
active_crises = {}
crisis_history = []
MAX_CRISIS_HISTORY = 500          # Cap in-memory history
CRISIS_EXPIRY_HOURS = 24          # Auto-expire active crises after this
WEBSOCKET_TIMEOUT_SECONDS = 3600  # Close idle WS connections after 1 hour

# =================== CRISIS DETECTION ENGINE ===================

class CrisisDetectionEngine:
    """Advanced crisis detection and response"""
    
    def __init__(self):
        self.high_risk_patterns = [
            "sudden behavioral change",
            "severe withdrawal",
            "giving away possessions",
            "fixation on death",
            "increased recklessness"
        ]
    
    def determine_crisis_level(self, indicators: List[CrisisIndicator]) -> CrisisLevel:
        """Determine overall crisis level from indicators"""
        if not indicators:
            return CrisisLevel.LOW
        
        # Weight indicators by severity
        weighted_score = sum(
            indicator.confidence * {
                CrisisLevel.CRITICAL: 4,
                CrisisLevel.HIGH: 3,
                CrisisLevel.MEDIUM: 2,
                CrisisLevel.LOW: 1
            }[indicator.severity]
            for indicator in indicators
        )
        
        avg_score = weighted_score / len(indicators)
        
        if avg_score >= 3.5:
            return CrisisLevel.CRITICAL
        elif avg_score >= 2.5:
            return CrisisLevel.HIGH
        elif avg_score >= 1.5:
            return CrisisLevel.MEDIUM
        else:
            return CrisisLevel.LOW
    
    def determine_actions(self, crisis_level: CrisisLevel) -> List[ResponseAction]:
        """Determine response actions based on crisis level"""
        return CRISIS_ESCALATION_RULES[crisis_level]["actions"]
    
    def get_resources(self, region: str = "US") -> List[EmergencyResource]:
        """Get emergency resources for region"""
        return EMERGENCY_RESOURCES.get(region, EMERGENCY_RESOURCES["US"])
    
    def generate_notifications(self, crisis_level: CrisisLevel, 
                             user_id: str) -> List[str]:
        """Generate notifications to send"""
        notifications = []
        
        if crisis_level == CrisisLevel.CRITICAL:
            notifications.extend([
                f"URGENT: Critical crisis detected for user {user_id}",
                "Emergency contact initiated",
                "Parent/guardian notification sent"
            ])
        elif crisis_level == CrisisLevel.HIGH:
            notifications.extend([
                f"HIGH PRIORITY: Serious crisis detected for user {user_id}",
                "Support resources provided",
                "Guardian alert sent"
            ])
        elif crisis_level == CrisisLevel.MEDIUM:
            notifications.extend([
                f"ALERT: Moderate crisis detected for user {user_id}",
                "Support resources offered"
            ])
        
        return notifications
    
    def create_response_plan(self, user_id: str, indicators: List[CrisisIndicator],
                           context: Optional[str] = None) -> CrisisResponsePlan:
        """Create comprehensive crisis response plan"""
        crisis_id = f"crisis_{user_id}_{datetime.now().timestamp()}"
        
        crisis_level = self.determine_crisis_level(indicators)
        actions = self.determine_actions(crisis_level)
        resources = self.get_resources()
        notifications = self.generate_notifications(crisis_level, user_id)
        
        # Schedule follow-up
        follow_up = None
        if crisis_level == CrisisLevel.CRITICAL:
            follow_up = datetime.now() + timedelta(hours=1)
        elif crisis_level == CrisisLevel.HIGH:
            follow_up = datetime.now() + timedelta(hours=24)
        elif crisis_level == CrisisLevel.MEDIUM:
            follow_up = datetime.now() + timedelta(days=3)
        
        return CrisisResponsePlan(
            crisis_id=crisis_id,
            user_id=user_id,
            detected_level=crisis_level,
            actions_taken=actions,
            resources_provided=resources,
            notifications_sent=notifications,
            escalation_status="active" if crisis_level != CrisisLevel.LOW else "resolved",
            follow_up_scheduled=follow_up,
            timestamp=datetime.now()
        )

# Initialize engine
crisis_engine = CrisisDetectionEngine()

# =================== ENDPOINTS ===================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "crisis-detection",
        "active_crises": len(active_crises),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/detect", response_model=CrisisResponsePlan)
async def detect_crisis(request: CrisisDetectionRequest):
    """
    Detect crisis and generate response plan
    
    Args:
        request: CrisisDetectionRequest with indicators
    
    Returns:
        CrisisResponsePlan with actions and resources
    """
    try:
        logger.warning(f"[CRISIS-DETECTION] User: {request.user_id}, "
                      f"Indicators: {len(request.indicators)}")
        
        # Generate response plan
        response_plan = crisis_engine.create_response_plan(
            request.user_id,
            request.indicators,
            request.context
        )
        
        # Track active crisis
        active_crises[response_plan.crisis_id] = response_plan
        crisis_history.append(response_plan)

        # Evict oldest entries when history exceeds cap
        if len(crisis_history) > MAX_CRISIS_HISTORY:
            crisis_history[:] = crisis_history[-MAX_CRISIS_HISTORY:]

        # Expire stale active crises
        cutoff = datetime.now() - timedelta(hours=CRISIS_EXPIRY_HOURS)
        stale_ids = [cid for cid, c in active_crises.items() if c.timestamp < cutoff]
        for cid in stale_ids:
            del active_crises[cid]
        
        # Log crisis event
        logger.error(f"[CRISIS-ALERT] {response_plan.crisis_id}: "
                    f"Level={response_plan.detected_level}, "
                    f"Actions={len(response_plan.actions_taken)}")
        
        # TODO: Send notifications to emergency contacts
        for notification in response_plan.notifications_sent:
            logger.warning(f"[NOTIFICATION] {notification}")
        
        # TODO: Contact emergency services if critical
        if response_plan.detected_level == CrisisLevel.CRITICAL:
            logger.critical(f"[EMERGENCY-ESCALATION] {response_plan.crisis_id}")
        
        return response_plan
        
    except Exception as e:
        logger.error(f"Crisis detection error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Crisis detection failed"
        )

@app.get("/resources/{region}")
async def get_emergency_resources(region: str = "US"):
    """Get emergency resources for a region"""
    try:
        resources = EMERGENCY_RESOURCES.get(region, EMERGENCY_RESOURCES["US"])
        
        return {
            "success": True,
            "region": region,
            "resources": resources,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Resource fetch error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch resources"
        )

@app.get("/active-crises")
async def get_active_crises():
    """Get active crises (admin only)"""
    try:
        return {
            "total_active": len(active_crises),
            "crises": list(active_crises.values()),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching active crises: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch crises"
        )

@app.post("/resolve/{crisis_id}")
async def resolve_crisis(crisis_id: str, notes: Optional[str] = None):
    """Resolve an active crisis"""
    try:
        if crisis_id not in active_crises:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Crisis not found"
            )
        
        crisis = active_crises.pop(crisis_id)
        logger.info(f"[CRISIS-RESOLVED] {crisis_id}")
        
        return {
            "success": True,
            "crisis_id": crisis_id,
            "status": "resolved",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error resolving crisis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve crisis"
        )

@app.get("/history/{user_id}")
async def get_crisis_history(user_id: str, limit: int = 10):
    """Get crisis history for a user"""
    try:
        user_crises = [
            c for c in crisis_history 
            if c.user_id == user_id
        ][-limit:]
        
        return {
            "user_id": user_id,
            "total_incidents": len(user_crises),
            "crises": user_crises,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching crisis history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch history"
        )

@app.get("/stats")
async def get_stats():
    """Service statistics"""
    critical_count = sum(
        1 for c in crisis_history 
        if c.detected_level == CrisisLevel.CRITICAL
    )
    
    return {
        "service": "crisis-detection",
        "version": "1.0.0",
        "active_crises": len(active_crises),
        "total_detected": len(crisis_history),
        "critical_incidents": critical_count,
        "regions_supported": list(EMERGENCY_RESOURCES.keys()),
        "timestamp": datetime.now().isoformat()
    }

# =================== WEBSOCKET FOR REAL-TIME MONITORING ===================

@app.websocket("/ws/monitor/{user_id}")
async def websocket_monitor(websocket: WebSocket, user_id: str):
    """WebSocket for real-time crisis monitoring (auto-closes after timeout)"""
    await websocket.accept()
    start_time = asyncio.get_event_loop().time()

    try:
        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > WEBSOCKET_TIMEOUT_SECONDS:
                await websocket.send_json({
                    "type": "timeout",
                    "message": "Connection timed out. Please reconnect.",
                    "timestamp": datetime.now().isoformat()
                })
                await websocket.close()
                break

            # Check for active crises for user
            user_crises = [
                c for c in active_crises.values()
                if c.user_id == user_id
            ]
            
            if user_crises:
                await websocket.send_json({
                    "type": "crisis_alert",
                    "crises": [c.dict() for c in user_crises],
                    "timestamp": datetime.now().isoformat()
                })
            
            await asyncio.sleep(10)  # Check every 10 seconds
            
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8003))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
