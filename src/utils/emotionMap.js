/**
 * emotionMap.js
 * Emotion detection and mapping utilities
 * Converts conversation text to avatar emotions with weighted scoring
 */

import { EMOTIONS } from "@/components/avatar/avatarPresets";

// Comprehensive keyword sets for each emotion
const EMOTION_KEYWORDS = {
  happy: {
    keywords: [
      "happy",
      "joy",
      "joyful",
      "glad",
      "cheerful",
      "delighted",
      "thrilled",
      "wonderful",
      "great",
      "amazing",
      "awesome",
      "fantastic",
      "excellent",
      "love",
      "wonderful",
      "brilliant",
      "perfect",
    ],
    weight: 1.0,
    eyeOpenness: 1.15,
    mouthShape: 0.85,
  },

  sad: {
    keywords: [
      "sad",
      "unhappy",
      "depressed",
      "down",
      "upset",
      "miserable",
      "sorry",
      "lonely",
      "loss",
      "pain",
      "hurt",
      "heartbroken",
      "crying",
      "tears",
      "don't want",
      "cannot",
      "stuck",
    ],
    weight: 1.0,
    eyeOpenness: 0.75,
    mouthShape: -0.6,
  },

  excited: {
    keywords: [
      "excited",
      "thrilled",
      "amazed",
      "awed",
      "impressed",
      "wow",
      "yay",
      "awesome",
      "incredible",
      "unbelievable",
      "shocked",
      "surprise",
      "surprised",
      "woot",
      "woo",
    ],
    weight: 0.95,
    eyeOpenness: 1.2,
    mouthShape: 0.8,
    eyebrowHeight: 0.3,
  },

  curious: {
    keywords: [
      "curious",
      "wondering",
      "question",
      "what",
      "how",
      "why",
      "interesting",
      "fascinated",
      "intrigued",
      "puzzled",
      "hmm",
      "huh",
      "really",
      "tell me",
      "show me",
      "explain",
    ],
    weight: 0.85,
    eyeOpenness: 1.0,
    eyebrowHeight: 0.2,
    eyeDirection: 0.5,
  },

  concerned: {
    keywords: [
      "worried",
      "concerned",
      "anxious",
      "scared",
      "afraid",
      "scared",
      "frightened",
      "nervous",
      "uneasy",
      "stressed",
      "tension",
      "crisis",
      "stress",
      "pressure",
      "help",
      "emergency",
    ],
    weight: 1.0,
    eyeOpenness: 1.1,
    eyebrowHeight: -0.4,
    mouthShape: -0.3,
  },

  compassionate: {
    keywords: [
      "care",
      "comfort",
      "support",
      "help",
      "understand",
      "empathy",
      "feel",
      "feeling",
      "sorry",
      "there for you",
      "i understand",
      "listen",
      "together",
      "therapy",
      "support",
      "love",
      "cherish",
    ],
    weight: 0.95,
    eyeOpenness: 0.9,
    mouthShape: 0.3,
    eyebrowHeight: -0.1,
  },

  thinking: {
    keywords: [
      "think",
      "consider",
      "hmm",
      "let me",
      "maybe",
      "perhaps",
      "wonder",
      "contemplate",
      "reflect",
      "process",
      "analyzing",
      "analyzing",
      "evaluate",
      "decide",
      "choose",
      "think about",
    ],
    weight: 0.85,
    eyeOpenness: 0.85,
    mouthShape: -0.2,
    eyebrowHeight: 0.1,
    headTilt: -10,
  },

  neutral: {
    keywords: [],
    weight: 0.5,
    eyeOpenness: 1.0,
    mouthShape: 0.0,
    eyebrowHeight: 0.0,
    headTilt: 0,
    eyeDirection: 0,
  },
};

/**
 * Detect emotion from text using weighted keyword matching
 *
 * @param {string} text - The text to analyze
 * @param {Object} options - Detection options
 * @param {number} options.threshold - Minimum score to trigger emotion (0-1)
 * @param {number} options.maxEmotions - Max emotions to consider
 * @param {boolean} options.includeHistory - Include historical context
 * @returns {Object} Detection result with emotion, confidence, and metadata
 */
export function detectEmotionFromText(text, options = {}) {
  const { threshold = 0.3, maxEmotions = 3, includeHistory = false } = options;

  if (!text || typeof text !== "string") {
    return {
      emotion: "neutral",
      confidence: 0,
      scores: {},
      keywords: [],
    };
  }

  const lowerText = text.toLowerCase();
  const scores = {};
  const matchedKeywords = {};

  // Calculate scores for each emotion
  Object.entries(EMOTION_KEYWORDS).forEach(([emotion, data]) => {
    let score = 0;
    const matched = [];

    data.keywords.forEach((keyword) => {
      if (lowerText.includes(keyword)) {
        score += data.weight;
        matched.push(keyword);
      }
    });

    if (score > 0) {
      scores[emotion] = score;
      matchedKeywords[emotion] = matched;
    }
  });

  // Normalize scores
  const maxScore = Math.max(...Object.values(scores), 0);
  const normalizedScores = {};
  Object.entries(scores).forEach(([emotion, score]) => {
    normalizedScores[emotion] = maxScore > 0 ? score / maxScore : 0;
  });

  // Find top emotion(s)
  const sortedEmotions = Object.entries(normalizedScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxEmotions);

  if (sortedEmotions.length === 0 || sortedEmotions[0][1] < threshold) {
    return {
      emotion: "neutral",
      confidence: 0,
      scores: normalizedScores,
      keywords: [],
      reasoning: "No emotion detected above threshold",
    };
  }

  const [topEmotion, confidence] = sortedEmotions[0];
  const topKeywords = matchedKeywords[topEmotion] || [];

  return {
    emotion: topEmotion,
    confidence: Math.round(confidence * 100) / 100,
    scores: normalizedScores,
    keywords: topKeywords,
    alternatives: sortedEmotions.slice(1).map(([emotion, conf]) => ({
      emotion,
      confidence: Math.round(conf * 100) / 100,
    })),
  };
}

/**
 * Convert emotion to facial expression parameters
 *
 * @param {string} emotion - Emotion name
 * @returns {Object} Facial expression parameters for canvas rendering
 */
export function emotionToExpression(emotion) {
  const emotionData = EMOTION_KEYWORDS[emotion];

  if (!emotionData) {
    return EMOTION_KEYWORDS.neutral;
  }

  return {
    eyeOpenness: emotionData.eyeOpenness || 1.0,
    eyebrowHeight: emotionData.eyebrowHeight || 0.0,
    mouthShape: emotionData.mouthShape || 0.0,
    headTilt: emotionData.headTilt || 0,
    eyeDirection: emotionData.eyeDirection || 0,
  };
}

/**
 * Get emotion metadata
 *
 * @param {string} emotion - Emotion name
 * @returns {Object} Emotion metadata (color, description, intensity)
 */
export function getEmotionMetadata(emotion) {
  const emotionMetadata = {
    happy: {
      color: "#FFD700",
      intensity: "high",
      description: "Positive, joyful, content",
    },
    sad: {
      color: "#4169E1",
      intensity: "high",
      description: "Down, unhappy, sorrowful",
    },
    excited: {
      color: "#FF6347",
      intensity: "high",
      description: "Energetic, thrilled, amazed",
    },
    curious: {
      color: "#9370DB",
      intensity: "medium",
      description: "Interested, wondering, engaged",
    },
    concerned: {
      color: "#FF4500",
      intensity: "high",
      description: "Worried, anxious, stressed",
    },
    compassionate: {
      color: "#FF69B4",
      intensity: "medium",
      description: "Empathetic, caring, supportive",
    },
    thinking: {
      color: "#D3D3D3",
      intensity: "low",
      description: "Processing, considering, reflecting",
    },
    neutral: {
      color: "#808080",
      intensity: "low",
      description: "Calm, neutral, baseline",
    },
  };

  return emotionMetadata[emotion] || emotionMetadata.neutral;
}

/**
 * Blend two emotions smoothly for animation transitions
 *
 * @param {string} emotion1 - First emotion
 * @param {string} emotion2 - Second emotion
 * @param {number} blendAmount - Blend factor (0-1, 0 = emotion1, 1 = emotion2)
 * @returns {Object} Blended emotion expression
 */
export function blendEmotions(emotion1, emotion2, blendAmount) {
  if (blendAmount < 0 || blendAmount > 1) {
    throw new Error("blendAmount must be between 0 and 1");
  }

  const expr1 = emotionToExpression(emotion1);
  const expr2 = emotionToExpression(emotion2);

  return {
    eyeOpenness:
      expr1.eyeOpenness * (1 - blendAmount) + expr2.eyeOpenness * blendAmount,
    eyebrowHeight:
      expr1.eyebrowHeight * (1 - blendAmount) +
      expr2.eyebrowHeight * blendAmount,
    mouthShape:
      expr1.mouthShape * (1 - blendAmount) + expr2.mouthShape * blendAmount,
    headTilt: expr1.headTilt * (1 - blendAmount) + expr2.headTilt * blendAmount,
    eyeDirection:
      expr1.eyeDirection * (1 - blendAmount) + expr2.eyeDirection * blendAmount,
  };
}

/**
 * Get recommended emotion based on conversation context
 * Used for real-time emotion suggestions
 *
 * @param {string[]} recentTexts - Array of recent conversation texts
 * @returns {Object} Recommended emotion with reasoning
 */
export function recommendEmotion(recentTexts) {
  if (!Array.isArray(recentTexts) || recentTexts.length === 0) {
    return { emotion: "neutral", reasoning: "No context provided" };
  }

  const emotionScores = {};
  const allMatches = [];

  recentTexts.forEach((text, index) => {
    const result = detectEmotionFromText(text);
    if (result.emotion !== "neutral") {
      const recencyWeight = 1 - index * 0.1; // Recent texts weighted higher
      emotionScores[result.emotion] =
        (emotionScores[result.emotion] || 0) +
        result.confidence * recencyWeight;
      allMatches.push({
        text: text.substring(0, 50),
        emotion: result.emotion,
        confidence: result.confidence,
      });
    }
  });

  if (Object.keys(emotionScores).length === 0) {
    return {
      emotion: "neutral",
      reasoning: "No emotions detected in conversation history",
      matches: allMatches,
    };
  }

  const topEmotion = Object.entries(emotionScores).sort(
    ([, a], [, b]) => b - a,
  )[0][0];

  return {
    emotion: topEmotion,
    reasoning: `Based on recent conversation context, ${topEmotion} is the most prevalent emotion`,
    matches: allMatches,
    scores: emotionScores,
  };
}

/**
 * Validate emotion name
 *
 * @param {string} emotion - Emotion to validate
 * @returns {boolean} True if valid emotion
 */
export function isValidEmotion(emotion) {
  return Object.prototype.hasOwnProperty.call(EMOTION_KEYWORDS, emotion);
}

/**
 * Get all available emotions
 *
 * @returns {string[]} Array of emotion names
 */
export function getAllEmotions() {
  return Object.keys(EMOTION_KEYWORDS);
}
