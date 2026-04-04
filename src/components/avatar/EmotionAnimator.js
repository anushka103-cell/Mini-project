/**
 * EmotionAnimator
 * Handles smooth transitions and blending between emotions
 * Provides keyframe animation for complex emotional expressions
 */

// Easing functions for smooth animations
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animate emotion transition with bezier easing
 * @param {string} fromEmotion - Starting emotion
 * @param {string} toEmotion - Target emotion
 * @param {number} duration - Transition duration in ms
 * @param {Function} onFrame - Callback with blended expression (0-1)
 * @returns {Promise} Resolves when animation complete
 */
export function animateEmotionTransition(
  fromEmotion,
  toEmotion,
  duration = 400,
  onFrame,
) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let animationFrameId = null;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: ease-in-out-cubic
      const easeProgress = easeInOutCubic(progress);

      if (onFrame) {
        onFrame({
          progress: easeProgress,
          fromEmotion,
          toEmotion,
          elapsed,
        });
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        resolve({ fromEmotion, toEmotion, completed: true });
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return {
      cancel: () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      },
    };
  });
}

/**
 * Blend two facial expressions
 * @param {Object} expr1 - First expression (eyeOpenness, eyebrowHeight, etc.)
 * @param {Object} expr2 - Second expression
 * @param {number} blend - Blend amount (0-1, 0=expr1, 1=expr2)
 * @returns {Object} Blended expression
 */
export function blendExpressions(expr1, expr2, blend) {
  if (blend < 0 || blend > 1) {
    throw new Error("Blend must be between 0 and 1");
  }

  const blended = {};
  Object.keys(expr1).forEach((key) => {
    if (typeof expr1[key] === "number" && typeof expr2[key] === "number") {
      blended[key] = expr1[key] * (1 - blend) + expr2[key] * blend;
    } else {
      blended[key] = expr2[key];
    }
  });

  return blended;
}

/**
 * Create a keyframed animation sequence
 * @param {Array} keyframes - Array of {emotion, duration} objects
 * @param {Function} onFrame - Callback for each frame
 * @returns {Promise} Resolves when animation complete
 */
export function playEmotionSequence(keyframes, onFrame) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < keyframes.length - 1; i++) {
      const current = keyframes[i];
      const next = keyframes[i + 1];

      await animateEmotionTransition(
        current.emotion,
        next.emotion,
        current.duration || 500,
        onFrame,
      );
    }

    resolve({ sequenceComplete: true });
  });
}

/**
 * Calculate complex emotion (blend of two emotions)
 * Useful for nuanced feelings like "worried-excited"
 * @param {string} emotion1 - Primary emotion
 * @param {string} emotion2 - Secondary emotion
 * @param {number} ratio - Blend ratio (0-1, 0=emotion1, 1=emotion2)
 * @returns {Object} Complex emotion expression
 */
export function createComplexEmotion(emotion1, emotion2, ratio = 0.5) {
  const { emotionToExpression } = require("@/utils/emotionMap");

  const expr1 = emotionToExpression(emotion1);
  const expr2 = emotionToExpression(emotion2);

  return {
    primary: emotion1,
    secondary: emotion2,
    ratio,
    expression: blendExpressions(expr1, expr2, ratio),
    intensity: calculateEmotionIntensity(expr1, expr2, ratio),
  };
}

/**
 * Generate oscillating animation for nervous/anxious states
 * @param {Object} baseExpression - Starting expression
 * @param {number} amplitude - Amount of oscillation (0-1)
 * @param {number} frequency - Oscillations per second
 * @returns {Function} Animation function to call each frame
 */
export function generateNervousOscillation(
  baseExpression,
  amplitude = 0.1,
  frequency = 3,
) {
  return (timeMs) => {
    const oscillation = Math.sin((timeMs / 1000) * frequency * Math.PI * 2);
    const eyeOpenness = baseExpression.eyeOpenness + oscillation * amplitude;

    return {
      ...baseExpression,
      eyeOpenness: Math.max(0.5, Math.min(1.5, eyeOpenness)),
    };
  };
}

/**
 * Generate breathing-like animation
 * @param {Object} baseExpression - Base expression
 * @param {number} amplitude - Breathing intensity (0.05-0.15)
 * @param {number} speed - Breathing speed in breaths per minute (10-30)
 * @returns {Function} Animation function
 */
export function generateBreathingAnimation(
  baseExpression,
  amplitude = 0.08,
  speed = 16,
) {
  return (timeMs) => {
    const cycle = (timeMs / 1000 / (60 / speed)) % 1;
    const breathValue = Math.sin(cycle * Math.PI * 2);

    return {
      ...baseExpression,
      eyeOpenness: baseExpression.eyeOpenness + breathValue * amplitude,
    };
  };
}

/**
 * Calculate intensity of emotion based on expression parameters
 */
function calculateEmotionIntensity(expr1, expr2, ratio) {
  const blended = blendExpressions(expr1, expr2, ratio);
  const intensities = [
    Math.abs(blended.eyeOpenness - 1),
    Math.abs(blended.eyebrowHeight),
    Math.abs(blended.mouthShape),
    Math.abs(blended.headTilt) / 30,
  ];

  return Math.min(1, Math.max(...intensities));
}

/**
 * Generate pulse animation (attention/excitement)
 * @param {Object} baseExpression - Base expression
 * @param {number} pulseIntensity - Pulse strength (0-0.3)
 * @returns {Function} Animation function
 */
export function generatePulseAnimation(baseExpression, pulseIntensity = 0.2) {
  return (timeMs) => {
    const pulses = [0.2, 0.5, 0.8]; // Pulse timing
    const cycleDuration = 2000; // 2 seconds
    const cyclePosition = (timeMs % cycleDuration) / cycleDuration;

    let pulse = 0;
    pulses.forEach((pulseTime) => {
      const distance = Math.abs(cyclePosition - pulseTime);
      if (distance < 0.15) {
        const gaussianPulse = Math.exp(
          -((distance * distance) / (2 * 0.05 * 0.05)),
        );
        pulse = Math.max(pulse, gaussianPulse);
      }
    });

    return {
      ...baseExpression,
      eyeOpenness: baseExpression.eyeOpenness + pulse * pulseIntensity,
    };
  };
}

/**
 * Blink animation (natural eye closure)
 * @param {number} timeMs - Current time in milliseconds
 * @param {number} blinkFrequency - Blinks per minute (10-30)
 * @returns {number} Eye openness multiplier (0-1, where 1 = fully open)
 */
export function calculateBlinkAmount(timeMs, blinkFrequency = 17) {
  const blinkDuration = 150; // 150ms per blink
  const cycleTime = (60 / blinkFrequency) * 1000; // In milliseconds
  const positionInCycle = timeMs % cycleTime;

  if (positionInCycle < blinkDuration) {
    // Blink is happening
    const blinkProgress = positionInCycle / blinkDuration;
    // Eyelid closes then opens (bell curve)
    return Math.cos(blinkProgress * Math.PI);
  }

  return 1; // Fully open
}

/**
 * Eye gaze tracking animation
 * Moves eyes toward a specific point
 * @param {number} targetX - Target X position (-1 to 1, center is 0)
 * @param {number} targetY - Target Y position (-1 to 1, center is 0)
 * @param {number} duration - Transition duration in ms
 * @returns {Function} Animation function returning eye direction
 */
export function createGazeAnimation(targetX, targetY, duration = 300) {
  const startTime = Date.now();

  return () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = easeInOutCubic(progress);

    return {
      eyeDirectionX: targetX * easeProgress,
      eyeDirectionY: targetY * easeProgress,
    };
  };
}

/**
 * Micro-expression (brief, involuntary expression)
 * Quickly flashes target emotion then returns to neutral
 * @param {Object} microExpression - Expression to flash
 * @param {number} durationMs - How long to show (100-500ms)
 * @param {Function} onFrame - Frame callback
 * @returns {Promise}
 */
export function playMicroExpression(
  microExpression,
  durationMs = 200,
  onFrame,
) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / durationMs;

      if (progress < 0.5) {
        // Flash in (0-0.5)
        const flashProgress = progress * 2;
        onFrame(flashProgress);
      } else {
        // Flash out (0.5-1)
        const flashProgress = (1 - progress) * 2;
        onFrame(flashProgress);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
}
