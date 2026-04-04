"""
Example Usage and Integration Guide for Emotion Detection Module

This script demonstrates how to use the emotion_detector module
in various scenarios.
"""

from emotion_detector import (
    EmotionDetector, 
    EmotionResult, 
    detect_emotion,
    get_detector,
    initialize_detector
)
import torch
import json


def example_1_basic_detection():
    """Example 1: Basic emotion detection"""
    print("\n" + "="*60)
    print("Example 1: Basic Single Text Detection")
    print("="*60)
    
    text = "I'm feeling really sad and depressed today."
    
    result = detect_emotion(text)
    
    print(f"Input: {text}")
    print(f"Primary emotion: {result.primary_emotion}")
    print(f"Confidence: {result.confidence:.2%}")
    print(f"Intensity: {result.intensity:.2f}")
    print(f"Latency: {result.latency_ms}ms")
    print(f"\nAll emotions:")
    for emotion, score in result.all_emotions.items():
        print(f"  {emotion}: {score:.4f}")


def example_2_batch_detection():
    """Example 2: Batch emotion detection"""
    print("\n" + "="*60)
    print("Example 2: Batch Multi-Text Detection")
    print("="*60)
    
    texts = [
        "I'm so happy and excited about this!",
        "I'm worried and anxious about tomorrow's exam.",
        "I'm angry at what they did to me.",
        "Everything feels overwhelming and I'm stressed.",
        "I'm okay, just going through the day normally."
    ]
    
    detector = get_detector()
    results = detector.detect_batch(texts)
    
    print(f"Analyzing {len(texts)} texts...\n")
    
    for i, (text, result) in enumerate(zip(texts, results), 1):
        print(f"Text {i}: \"{text}\"")
        print(f"  Emotion: {result.primary_emotion} ({result.confidence:.2%})")
        print(f"  Intensity: {result.intensity:.2f}")
        print()


def example_3_coping_strategies():
    """Example 3: Get coping strategies for detected emotions"""
    print("\n" + "="*60)
    print("Example 3: Emotion-Based Coping Strategies")
    print("="*60)
    
    detector = get_detector()
    test_cases = [
        ("I can't stop crying and feeling empty.", "sadness"),
        ("I'm so worried something bad will happen.", "anxiety"),
        ("I'm furious at this injustice!", "anger"),
        ("I just got promoted! I'm so excited!", "happiness"),
        ("Everything is piling up and I can't cope.", "stress")
    ]
    
    for text, expected_emotion in test_cases:
        result = detector.detect(text)
        strategies = detector.get_coping_strategies(result.primary_emotion, detail_level=3)
        
        print(f"Text: \"{text}\"")
        print(f"Detected: {result.primary_emotion} ({result.confidence:.2%})")
        print(f"Coping strategies:")
        for i, strategy in enumerate(strategies, 1):
            print(f"  {i}. {strategy}")
        print()


def example_4_intensity_analysis():
    """Example 4: Emotional intensity variations"""
    print("\n" + "="*60)
    print("Example 4: Emotional Intensity Analysis")
    print("="*60)
    
    # Same emotion with different intensities
    variations = [
        "I'm sad.",
        "I'm really sad.",
        "I'M SAD!!!!!",
        "I'm SO SAD... I can't do this anymore...",
        "sadness sadness sadness"
    ]
    
    print("Same emotion expressed with different intensities:\n")
    
    for text in variations:
        result = detect_emotion(text)
        intensity_bar = "█" * int(result.intensity * 20) + "░" * (20 - int(result.intensity * 20))
        print(f"Text: \"{text}\"")
        print(f"Intensity: [{intensity_bar}] {result.intensity:.2f}")
        print()


def example_5_chatbot_integration():
    """Example 5: Integration with chatbot (realistic scenario)"""
    print("\n" + "="*60)
    print("Example 5: Chatbot Integration")
    print("="*60)
    
    class SimpleChatbot:
        """Minimal chatbot that responds based on detected emotion"""
        
        def __init__(self):
            self.detector = get_detector()
            self.conversation_history = []
        
        def respond(self, user_message: str) -> dict:
            """Generate response based on emotion analysis"""
            
            # Detect emotion
            emotion_result = self.detector.detect(user_message)
            
            # Get coping strategies
            strategies = self.detector.get_coping_strategies(
                emotion_result.primary_emotion,
                detail_level=2
            )
            
            # Build empathetic response
            responses = {
                "sadness": "I sense you're feeling down. That's valid, and I'm here to listen.",
                "anxiety": "It sounds like you're worried about something. Let's take this one step at a time.",
                "anger": "I can tell you're frustrated. It's okay to feel angry—let's work through this.",
                "happiness": "That's wonderful! Your joy is contagious. Tell me more!",
                "stress": "You sound overwhelmed. Let's break this down into manageable pieces.",
                "neutral": "How can I support you today?"
            }
            
            response_text = responses.get(
                emotion_result.primary_emotion,
                "I'm listening. How can I help?"
            )
            
            # Store in conversation history
            self.conversation_history.append({
                "user_message": user_message,
                "emotion": emotion_result.primary_emotion,
                "confidence": emotion_result.confidence,
                "intensity": emotion_result.intensity
            })
            
            all_emotions_formatted = {
                k: round(float(v), 4) for k, v in emotion_result.all_emotions.items()
            }
            return {
                "response": response_text,
                "emotion_analysis": {
                    "primary_emotion": emotion_result.primary_emotion,
                    "confidence": f"{emotion_result.confidence:.2%}",
                    "intensity": f"{emotion_result.intensity:.2f}",
                    "all_emotions": all_emotions_formatted
                },
                "suggested_strategies": strategies
            }
    
    # Simulate chatbot conversation
    chatbot = SimpleChatbot()
    
    user_inputs = [
        "Hey, I'm really struggling today. Everything feels heavy.",
        "I've been having trouble sleeping because of anxiety.",
        "Actually, I had a great moment today! My therapy session went really well."
    ]
    
    for user_input in user_inputs:
        print(f"User: {user_input}")
        response = chatbot.respond(user_input)
        print(f"Chatbot: {response['response']}")
        emotion_info = response['emotion_analysis']
        print(f"Emotion: {emotion_info['primary_emotion']} ({emotion_info['confidence']})")
        print(f"Suggested strategies: {', '.join(response['suggested_strategies'])}")
        print()


def example_6_json_response():
    """Example 6: JSON response format for API integration"""
    print("\n" + "="*60)
    print("Example 6: JSON Response Format (for APIs)")
    print("="*60)
    
    result = detect_emotion("I'm overwhelmed with everything going on right now.")
    
    # Convert to JSON-serializable dict
    json_response = {
        "status": "success",
        "data": {
            "primary_emotion": result.primary_emotion,
            "confidence": round(float(result.confidence), 4),
            "intensity": round(float(result.intensity), 4),
            "all_emotions": {
                k: round(float(v), 4) 
                for k, v in result.all_emotions.items()
            },
            "timestamp": result.timestamp,
            "latency_ms": result.latency_ms
        },
        "meta": {
            "model": "j-hartmann/emotion-english-roberta-large",
            "device": "cuda" if torch.cuda.is_available() else "cpu"
        }
    }
    
    print(json.dumps(json_response, indent=2))


def example_7_caching_performance():
    """Example 7: Demonstrate caching performance improvement"""
    print("\n" + "="*60)
    print("Example 7: Caching Performance Impact")
    print("="*60)
    
    import time
    
    detector = get_detector()
    test_text = "I'm feeling great today!"
    
    # First detection (cache miss)
    start = time.time()
    result1 = detector.detect(test_text)
    time1 = time.time() - start
    
    # Second detection (cache hit)
    start = time.time()
    result2 = detector.detect(test_text)
    time2 = time.time() - start
    
    print(f"Text: \"{test_text}\"")
    print(f"First detection (cache miss): {result1.latency_ms:.2f}ms")
    print(f"Second detection (cache hit): {time2*1000:.2f}ms")
    print(f"Speed improvement: {result1.latency_ms / (time2*1000):.1f}x faster")
    
    # Show cache stats
    print(f"\nCache size: {len(detector._cache)} items")
    
    # Clear cache
    detector.clear_cache()
    print("Cache cleared")


def example_8_error_handling():
    """Example 8: Error handling"""
    print("\n" + "="*60)
    print("Example 8: Error Handling")
    print("="*60)
    
    detector = get_detector()
    
    error_cases = [
        ("", "Empty string"),
        ("   ", "Only whitespace"),
        (None, "None value"),
        (123, "Non-string input")
    ]
    
    for test_input, description in error_cases:
        print(f"Testing: {description} ({repr(test_input)})")
        try:
            result = detector.detect(test_input)
            print(f"  Result: {result.primary_emotion}")
        except (ValueError, TypeError) as e:
            print(f"  ✓ Handled gracefully: {type(e).__name__}")
        print()


def example_9_system_info():
    """Example 9: System information and model details"""
    print("\n" + "="*60)
    print("Example 9: System Information")
    print("="*60)
    
    detector = get_detector()
    
    print(f"Model: {detector.model_name}")
    print(f"Device: {detector.device}")
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    print(f"Emotion labels: {list(detector.EMOTION_LABELS.keys())}")
    print(f"Cache size limit: {detector.cache_size} items")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("MindSafe Emotion Detector - Example Usage")
    print("="*60)
    
    # Initialize detector (downloads model on first run)
    print("\nInitializing emotion detector...")
    initialize_detector()
    print("✓ Ready!\n")
    
    # Run examples
    example_1_basic_detection()
    example_2_batch_detection()
    example_3_coping_strategies()
    example_4_intensity_analysis()
    example_5_chatbot_integration()
    example_6_json_response()
    example_7_caching_performance()
    example_8_error_handling()
    example_9_system_info()
    
    print("\n" + "="*60)
    print("All examples completed!")
    print("="*60 + "\n")
