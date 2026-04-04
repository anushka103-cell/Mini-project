"""
Unit Tests for Emotion Detection Module

Tests for emotion_detector.py
Run with: pytest test_emotion_detector.py -v
"""

import pytest
import torch
from emotion_detector import (
    EmotionDetector,
    EmotionResult,
    detect_emotion,
    initialize_detector,
    get_detector
)


class TestEmotionDetector:
    """Test EmotionDetector class"""
    
    @pytest.fixture
    def detector(self):
        """Create detector instance for tests"""
        return EmotionDetector(device='cpu')  # Use CPU for testing
    
    # ========================================================================
    # Test Basic Detection
    # ========================================================================
    
    def test_initialization(self):
        """Test detector initialization"""
        detector = EmotionDetector(device='cpu')
        assert detector is not None
        assert detector.device == 'cpu'
        assert len(detector.EMOTION_LABELS) == 6
    
    def test_detect_sadness(self, detector):
        """Test sadness detection"""
        result = detector.detect("I'm feeling really sad and depressed.")
        assert result.primary_emotion == "sadness"
        assert result.confidence > 0.7
        assert isinstance(result.intensity, float)
        assert 0 <= result.intensity <= 1
    
    def test_detect_anxiety(self, detector):
        """Test anxiety detection"""
        result = detector.detect("I'm so worried and anxious about everything.")
        assert result.primary_emotion == "anxiety"
        assert result.confidence > 0.6
    
    def test_detect_anger(self, detector):
        """Test anger detection"""
        result = detector.detect("I'm absolutely furious at this injustice!")
        assert result.primary_emotion == "anger"
        assert result.confidence > 0.6
    
    def test_detect_happiness(self, detector):
        """Test happiness detection"""
        result = detector.detect("I'm so happy and excited about this wonderful news!")
        assert result.primary_emotion == "happiness"
        assert result.confidence > 0.7
    
    def test_detect_stress(self, detector):
        """Test stress detection"""
        result = detector.detect("Everything is overwhelming and I'm stressed out.")
        assert result.primary_emotion in ["stress", "anxiety"]  # Can be close
    
    # ========================================================================
    # Test Response Format
    # ========================================================================
    
    def test_response_format(self, detector):
        """Test EmotionResult format"""
        result = detector.detect("I'm happy")
        
        assert isinstance(result, EmotionResult)
        assert isinstance(result.primary_emotion, str)
        assert isinstance(result.confidence, float)
        assert isinstance(result.all_emotions, dict)
        assert isinstance(result.intensity, float)
        assert isinstance(result.timestamp, str)
        assert isinstance(result.latency_ms, float)
    
    def test_emotion_scores_sum_to_one(self, detector):
        """Test that all emotion scores sum to approximately 1.0"""
        result = detector.detect("I'm okay")
        total = sum(result.all_emotions.values())
        assert 0.99 <= total <= 1.01  # Allow small floating point error
    
    def test_confidence_in_valid_range(self, detector):
        """Test confidence is between 0 and 1"""
        result = detector.detect("Hello")
        assert 0 <= result.confidence <= 1
        assert result.confidence == result.all_emotions[result.primary_emotion]
    
    # ========================================================================
    # Test Intensity Calculation
    # ========================================================================
    
    def test_intensity_increases_with_emphasis(self, detector):
        """Test that intensity increases with emphasis markers"""
        # Normal text
        result1 = detector.detect("I'm sad")
        
        # Text with emphasis
        result2 = detector.detect("I'M SAD!!!")
        
        assert result2.intensity > result1.intensity
    
    def test_intensity_with_repetition(self, detector):
        """Test intensity with word repetition"""
        result = detector.detect("sad sad sad sad sad")
        assert result.intensity > 0.5
    
    def test_intensity_with_ellipsis(self, detector):
        """Test intensity with ellipsis"""
        result = detector.detect("I don't know... nothing makes sense anymore...")
        assert result.intensity > 0.3
    
    # ========================================================================
    # Test Batch Processing
    # ========================================================================
    
    def test_batch_detection(self, detector):
        """Test batch emotion detection"""
        texts = [
            "I'm happy",
            "I'm sad",
            "I'm angry"
        ]
        results = detector.detect_batch(texts)
        
        assert len(results) == 3
        assert all(isinstance(r, EmotionResult) for r in results)
    
    def test_batch_with_error(self, detector):
        """Test batch handles errors gracefully"""
        texts = ["I'm fine", "I'm upset"]
        results = detector.detect_batch(texts)
        
        assert len(results) == 2
        assert all(r is not None for r in results)
    
    # ========================================================================
    # Test Error Handling
    # ========================================================================
    
    def test_empty_string_raises_error(self, detector):
        """Test empty string input"""
        with pytest.raises(ValueError):
            detector.detect("")
    
    def test_whitespace_only_raises_error(self, detector):
        """Test whitespace-only input"""
        with pytest.raises(ValueError):
            detector.detect("   ")
    
    def test_none_raises_error(self, detector):
        """Test None input"""
        with pytest.raises(ValueError):
            detector.detect(None)
    
    def test_non_string_raises_error(self, detector):
        """Test non-string input"""
        with pytest.raises(ValueError):
            detector.detect(12345)
    
    def test_very_long_text_truncated(self, detector):
        """Test very long text is truncated"""
        long_text = "I'm happy " * 1000  # Very long text
        result = detector.detect(long_text)
        assert result is not None  # Should still work (text truncated)
    
    # ========================================================================
    # Test Coping Strategies
    # ========================================================================
    
    def test_coping_strategies_sadness(self, detector):
        """Test coping strategies for sadness"""
        strategies = detector.get_coping_strategies("sadness")
        assert len(strategies) > 0
        assert all(isinstance(s, str) for s in strategies)
    
    def test_coping_strategies_count(self, detector):
        """Test coping strategies with specific count"""
        strategies = detector.get_coping_strategies("anxiety", detail_level=2)
        assert len(strategies) == 2
    
    def test_coping_strategies_all_emotions(self, detector):
        """Test coping strategies for all emotions"""
        for emotion in detector.EMOTION_LABELS.keys():
            strategies = detector.get_coping_strategies(emotion)
            assert len(strategies) > 0
    
    # ========================================================================
    # Test Caching
    # ========================================================================
    
    def test_cache_functionality(self, detector):
        """Test prediction caching"""
        text = "I'm feeling great!"
        
        # First detection
        result1 = detector.detect(text)
        cache_size_after_first = len(detector._cache)
        
        # Second detection (should be cached)
        result2 = detector.detect(text)
        cache_size_after_second = len(detector._cache)
        
        # Should be cached now
        assert cache_size_after_first > 0
        assert cache_size_after_first == cache_size_after_second
        assert result1.primary_emotion == result2.primary_emotion
    
    def test_clear_cache(self, detector):
        """Test cache clearing"""
        text = "I'm feeling great!"
        detector.detect(text)
        
        assert len(detector._cache) > 0
        detector.clear_cache()
        assert len(detector._cache) == 0
    
    # ========================================================================
    # Test Convenience Functions
    # ========================================================================
    
    def test_detect_emotion_function(self):
        """Test convenience function"""
        result = detect_emotion("I'm happy")
        assert result.primary_emotion == "happiness"
    
    def test_get_detector_singleton(self):
        """Test singleton detector pattern"""
        detector1 = get_detector()
        detector2 = get_detector()
        assert detector1 is detector2
    
    def test_initialize_detector(self):
        """Test detector initialization"""
        detector = initialize_detector(device='cpu')
        assert detector is not None
        assert detector.device == 'cpu'


class TestIntegration:
    """Integration tests for the emotion detector"""
    
    @pytest.fixture
    def detector(self):
        """Create detector instance"""
        return EmotionDetector(device='cpu')
    
    def test_realistic_conversation(self, detector):
        """Test with realistic conversation sequence"""
        messages = [
            "Hey, how are you today?",
            "Actually, I'm feeling a bit down.",
            "Work has been really stressful.",
            "But I have some good news - I got a promotion!",
            "I'm so excited about it!"
        ]
        
        results = detector.detect_batch(messages)
        
        # Should detect progression from neutral -> sadness -> stress -> happiness
        assert len(results) == 5
        assert results[1].primary_emotion == "sadness"
        assert results[3].primary_emotion in ["happiness", "stress"]
        assert results[4].primary_emotion == "happiness"
    
    def test_emotion_intensity_consistency(self, detector):
        """Test intensity consistency within emotion families"""
        mild_anxiety = detector.detect("I'm a bit worried")
        severe_anxiety = detector.detect("I'M TERRIFIED!!!")
        
        # Both should be anxiety, but intensity differs
        assert mild_anxiety.primary_emotion == "anxiety"
        assert severe_anxiety.intensity > mild_anxiety.intensity
    
    def test_mixed_emotional_content(self, detector):
        """Test with mixed emotional content"""
        # Emotion mix: happiness + some concern
        result = detector.detect("I'm so excited but also a little nervous")
        
        # Primary emotion likely happiness due to explicit mention
        assert result.primary_emotion in ["happiness", "anxiety"]
        # But happiness should score high
        assert result.all_emotions["happiness"] > 0.3


class TestPerformance:
    """Performance tests"""
    
    @pytest.fixture
    def detector(self):
        """Create detector instance"""
        return EmotionDetector(device='cpu')
    
    def test_inference_speed(self, detector):
        """Test inference doesn't take too long"""
        result = detector.detect("I'm happy")
        # Should complete in reasonable time (even on CPU)
        assert result.latency_ms < 5000  # 5 seconds max
    
    def test_batch_efficiency(self, detector):
        """Test batch processing is efficient"""
        texts = ["I'm happy"] * 10
        results = detector.detect_batch(texts)
        
        assert len(results) == 10
        # All results should be valid
        assert all(r is not None for r in results)


# ============================================================================
# Parametrized Tests
# ============================================================================

class TestParametrized:
    """Parametrized test cases"""
    
    @pytest.fixture
    def detector(self):
        """Create detector instance"""
        return EmotionDetector(device='cpu')
    
    @pytest.mark.parametrize("text,expected_emotion", [
        ("I'm crying and feeling empty", "sadness"),
        ("I'm so worried about the future", "anxiety"),
        ("I'm furious at this unfair treatment", "anger"),
        ("I'm thrilled and joyful", "happiness"),
        ("I'm overwhelmed by everything", "stress"),
        ("Just going about my day", "neutral"),
    ])
    def test_emotion_detection(self, detector, text, expected_emotion):
        """Test various emotions are correctly detected"""
        result = detector.detect(text)
        assert result.primary_emotion == expected_emotion
        assert result.confidence > 0.5
    
    @pytest.mark.parametrize("emotion", [
        "sadness", "anxiety", "anger", "happiness", "stress", "neutral"
    ])
    def test_all_emotions_have_strategies(self, detector, emotion):
        """Test all emotions have coping strategies"""
        strategies = detector.get_coping_strategies(emotion, detail_level=3)
        assert len(strategies) >= 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
