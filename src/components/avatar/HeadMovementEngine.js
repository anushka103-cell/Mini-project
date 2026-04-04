/**
 * HeadMovementEngine
 * Manages head tilting, nodding, shaking, and other head movements
 * Provides realistic head animations for different emotions and contexts
 */

// Easing functions for smooth animations
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Generate head tilt animation
 * @param {number} intensity - How much to tilt (-30 to 30 degrees)
 * @param {number} duration - Animation duration in ms
 * @returns {Function} Animation function (returns absolute tilt amount)
 */
export function parseHeadTilt(intensity, duration = 500) {
  return (elapsedMs) => {
    const progress = Math.min(elapsedMs / duration, 1);
    const easeProgress = easeInOutCubic(progress);
    return intensity * easeProgress;
  };
}

/**
 * Generate nodding animation (yes confirmation)
 * @param {number} speed - How fast to nod (0.5-2x, 1=normal)
 * @param {number} amplitude - How much to nod (-15 to 15 degrees)
 * @returns {Function} Animation function returning tilt amount each frame
 */
export function generateNodding(speed = 1, amplitude = 15) {
  return (elapsedMs) => {
    const cycleDuration = 600 / speed; // ms per nod cycle
    const cyclePosition = (elapsedMs % cycleDuration) / cycleDuration;

    // Smooth nod pattern: down (0-0.5), up (0.5-1)
    if (cyclePosition < 0.5) {
      // Nodding down
      const downProgress = cyclePosition * 2;
      return -amplitude * easeInOutQuad(downProgress);
    } else {
      // Nodding up
      const upProgress = (cyclePosition - 0.5) * 2;
      return -amplitude + amplitude * easeInOutQuad(upProgress);
    }
  };
}

/**
 * Generate shaking animation (no/disagreement)
 * @param {number} speed - Shake speed (0.5-2x)
 * @param {number} amplitude - Shake amount (5-20 degrees)
 * @returns {Function} Animation function returning tilt amount each frame
 */
export function generateShaking(speed = 1, amplitude = 10) {
  return (elapsedMs) => {
    const cycleTime = (300 / speed) * 2; // One shake cycle
    const cyclePosition = (elapsedMs % cycleTime) / cycleTime;

    // Sinusoidal shake
    const shakeValue = Math.sin(cyclePosition * Math.PI * 2);
    return shakeValue * amplitude;
  };
}

/**
 * Generate head bob animation (to music/beat)
 * @param {number} beatFrequency - BPM or frequency (e.g., 120 for 120 BPM)
 * @param {number} bobbingAmount - How much to bob up/down (5-15)
 * @returns {Function} Animation function returning vertical displacement
 */
export function generateHeadBob(beatFrequency = 120, bobbingAmount = 8) {
  return (elapsedMs) => {
    const beatDuration = (60 / beatFrequency) * 1000; // ms per beat
    const cyclePosition = (elapsedMs % beatDuration) / beatDuration;

    // Bob up and down with the beat
    return bobbingAmount * Math.sin(cyclePosition * Math.PI * 2);
  };
}

/**
 * Generate contemplative head movement (thinking)
 * Slow, gentle side-to-side with occasional downward tilt
 * @returns {Function} Animation function
 */
export function generateContemplative() {
  return (elapsedMs) => {
    const slowCycle = (elapsedMs / 4000) % 1; // 4 second cycle

    // Gentle side-to-side
    let tilt = Math.sin(slowCycle * Math.PI * 2) * 8;

    // Every 2 seconds, add a downward tilt
    const fastCycle = (elapsedMs / 2000) % 1;
    if (fastCycle > 0.7 && fastCycle < 0.85) {
      const tiltProgress = (fastCycle - 0.7) / 0.15;
      tilt -= tiltProgress * 10;
    }

    return tilt;
  };
}

/**
 * Generate confused head movement
 * Series of quick tilts side to side
 * @returns {Function} Animation function
 */
export function generateConfused() {
  return (elapsedMs) => {
    const cycle = (elapsedMs / 200) % 4; // Quick 200ms tilts, repeat 4 times

    if (cycle < 1) {
      // Left
      return -12 * easeInOutQuad(cycle);
    } else if (cycle < 2) {
      // Center
      return -12 + 24 * easeInOutQuad(cycle - 1);
    } else if (cycle < 3) {
      // Right
      return 12 - 12 * easeInOutQuad(cycle - 2);
    } else {
      // Back to center
      return -12 * easeInOutQuad((cycle - 3) * 0.5);
    }
  };
}

/**
 * Generate head tilt from emotion
 * Maps emotions to natural head tilts
 * @param {string} emotion - Emotion name
 * @returns {number} Natural head tilt for this emotion (-20 to 20)
 */
export function getEmotionHeadTilt(emotion) {
  const emotionTilts = {
    happy: 5, // Slight head tilt when happy
    sad: -10, // Head down when sad
    curious: 15, // Head tilt to the side when curious
    thinking: -8, // Slight downward tilt when thinking
    concerned: -5, // Slight downward tilt when concerned
    excited: 0, // Head straight when excited (dynamic movement)
    compassionate: -3, // Slight empathetic tilt
    neutral: 0,
  };

  return emotionTilts[emotion] || 0;
}

/**
 * Blend head movements together
 * @param {number} movement1 - First movement value
 * @param {number} movement2 - Second movement value
 * @param {number} blend - Blend amount (0-1)
 * @returns {number} Blended movement
 */
export function blendHeadMovements(movement1, movement2, blend) {
  return movement1 * (1 - blend) + movement2 * blend;
}

/**
 * Generate head wobble (tired/drowsy)
 * Head that keeps wanting to drop but fights it
 * @returns {Function} Animation function
 */
export function generateTiredWobble() {
  return (elapsedMs) => {
    const cycle = (elapsedMs / 3000) % 1; // 3 second cycle

    let tilt = 0;

    // Main wobble
    tilt += Math.sin(cycle * Math.PI * 2) * 8;

    // Occasional drops (like nodding off)
    const dropCycle = (elapsedMs / 8000) % 1;
    if (dropCycle > 0.8) {
      const dropProgress = (dropCycle - 0.8) / 0.2;
      tilt -= dropProgress * 15;
    }

    return tilt;
  };
}

/**
 * Generate emphatic head gesture
 * Strong nod or shake for emphasis
 * @param {string} type - 'nod' or 'shake'
 * @param {number} intensity - 1-3 for single to triple
 * @returns {Function} One-time gesture function
 */
export function generateEmphatic(type = "nod", intensity = 1) {
  return (elapsedMs) => {
    const totalDuration = 600 * intensity;
    if (elapsedMs > totalDuration) return 0;

    const progress = elapsedMs / totalDuration;

    if (type === "nod") {
      // Multiple nods
      const nodIndex = Math.floor(progress * intensity * 2);
      const nodProgress = (progress * intensity * 2) % 1;

      if (nodIndex % 2 === 0) {
        // Down phase
        return -15 * easeInOutQuad(nodProgress);
      } else {
        // Up phase
        return -15 + 15 * easeInOutQuad(nodProgress);
      }
    } else {
      // Shake
      const shakeCount = Math.floor(progress * intensity * 3);
      const shakeProgress = (progress * intensity * 3) % 1;
      const shakeValue = Math.sin(shakeProgress * Math.PI * 2);
      return shakeValue * 12;
    }
  };
}

/**
 * Create head movement sequence
 * Chain multiple movements together
 * @param {Array} sequence - Array of {type, duration, intensity}
 * @returns {Function} Orchestrated animation function
 */
export function createHeadSequence(sequence) {
  const durations = sequence.map((s) => s.duration || 500);
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  return (elapsedMs) => {
    if (elapsedMs > totalDuration) return 0;

    let currentTime = 0;
    for (let i = 0; i < sequence.length; i++) {
      const segment = sequence[i];
      const segmentDuration = durations[i];

      if (elapsedMs < currentTime + segmentDuration) {
        const relativeTime = elapsedMs - currentTime;

        // Get animation function for this segment
        let animFunc;
        if (segment.type === "nod") {
          animFunc = generateNodding(1, segment.intensity || 15);
        } else if (segment.type === "shake") {
          animFunc = generateShaking(1, segment.intensity || 10);
        } else if (segment.type === "tilt") {
          animFunc = parseHeadTilt(segment.intensity || 15, segmentDuration);
        } else if (segment.type === "bob") {
          animFunc = generateHeadBob(segment.intensity || 120);
        } else if (segment.type === "rest") {
          return 0;
        }

        return animFunc ? animFunc(relativeTime) : 0;
      }

      currentTime += segmentDuration;
    }

    return 0;
  };
}
