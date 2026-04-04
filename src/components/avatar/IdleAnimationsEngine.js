/**
 * IdleAnimationsEngine
 * Manages idle animations: fidgeting, eye wandering, micro-expressions
 * Prevents avatar from appearing static during pauses
 */

/**
 * Generate fidgeting animation
 * Subtle hand/body movements while standing still
 * @param {number} elapsedMs - Time since animation start
 * @param {string} fidgetType - 'hands' | 'shoulders' | 'weight_shift'
 * @param {number} intensity - Animation intensity (0-1)
 * @returns {Object} { x, y, z, scale } transformation
 */
export function generateFidgeting(
  elapsedMs,
  fidgetType = "hands",
  intensity = 0.3,
) {
  const phase = (elapsedMs / 1000) * Math.PI * 2; // Normalized phase

  const fidgetMaps = {
    hands: {
      // Fingers twitching, hands adjusting
      x: Math.sin(phase * 1.5) * intensity * 3,
      y: Math.cos(phase * 2.1) * intensity * 2,
      z: Math.sin(phase * 0.8 + Math.PI / 4) * intensity * 2,
      rotation: Math.sin(phase * 1.3) * intensity * 5,
    },
    shoulders: {
      // Shoulder shrugging, shifting
      x: Math.sin(phase * 0.7) * intensity * 4,
      y: Math.cos(phase * 1.1) * intensity * 3,
      rotation: Math.sin(phase * 0.9) * intensity * 8,
    },
    weight_shift: {
      // Shifting weight from foot to foot
      x: Math.sin(phase * 0.5) * intensity * 6,
      y: Math.cos(phase * 0.3) * intensity * 2,
    },
    nervous: {
      // Fast, jittery movements
      x: Math.sin(phase * 3.0) * intensity * 2,
      y: Math.cos(phase * 3.5) * intensity * 2,
      z: Math.sin(phase * 2.8) * intensity * 1.5,
      scale: 1 + Math.sin(phase * 2.5) * intensity * 0.05,
    },
  };

  return fidgetMaps[fidgetType] || fidgetMaps.hands;
}

/**
 * Generate eye wandering animation
 * Eyes look around without head movement
 * @param {number} elapsedMs - Time since animation start
 * @param {number} intensity - How much to wander (0-1)
 * @returns {Object} { gazeDirX, gazeDirY, blinkChance }
 */
export function generateEyeWandering(elapsedMs, intensity = 0.5) {
  const timeInSeconds = elapsedMs / 1000;

  // Slow, smooth wandering using sine waves at different frequencies
  const gazeDirX =
    Math.sin(timeInSeconds * 0.3) * intensity * 0.4 +
    Math.sin(timeInSeconds * 0.7) * intensity * 0.2;

  const gazeDirY =
    Math.cos(timeInSeconds * 0.25) * intensity * 0.3 +
    Math.cos(timeInSeconds * 0.6) * intensity * 0.15;

  // Occasional upward glance
  const upwardGlance = Math.sin(timeInSeconds * 0.15) > 0.9 ? 0.3 : 0;

  // Occasional focus (pupils focus tighter) - happens every ~8 seconds
  const focusPhase = (elapsedMs / 8000) % 1;
  const isFocused = focusPhase < 0.2; // Focus for first 1.6 seconds of each 8 second cycle

  return {
    gazeDirX: gazeDirX + upwardGlance * 0.1,
    gazeDirY: gazeDirY + upwardGlance,
    pupilSize: isFocused ? 0.8 : 1.0, // Slightly constricted when focused
    wanderIntensity: intensity,
  };
}

/**
 * Generate idle gaze target
 * Eyes look at random points in field of view
 * Used periodically to break up continuous wandering
 * @param {number} elapsedMs - Time since targets changed
 * @param {number} targetChangePeriod - How often to change target (ms)
 * @returns {Object} { x, y, confidence } where x,y are -1 to 1 normalized screen coords
 */
export function generateIdleGazeTarget(elapsedMs, targetChangePeriod = 4000) {
  const cyclePhase = (elapsedMs / targetChangePeriod) % 1;

  // Use cycle to determine target
  const targetIndex = Math.floor(cyclePhase * 8); // 8 possible targets

  const gazeTargets = [
    { x: -0.3, y: -0.2, name: "upper_left" },
    { x: 0.3, y: -0.2, name: "upper_right" },
    { x: -0.2, y: 0.2, name: "lower_left" },
    { x: 0.2, y: 0.2, name: "lower_right" },
    { x: -0.1, y: 0, name: "left" },
    { x: 0.1, y: 0, name: "right" },
    { x: 0, y: -0.1, name: "up" },
    { x: 0, y: 0, name: "center" },
  ];

  const target = gazeTargets[targetIndex];

  // Smooth transition to target over target period
  const transitionPhase = cyclePhase % (1 / 8);
  const transitionProgress = (transitionPhase * 8) % 1;

  return {
    ...target,
    transitionProgress, // 0-1, 0 = just switched target, 1 = about to switch
    nextSwitchIn: (1 - transitionProgress) * (targetChangePeriod / 8),
  };
}

/**
 * Micro-expression generator
 * Tiny, involuntary facial expressions
 * @param {number} elapsedMs - Time since animation start
 * @param {number} emotionValence - Emotion from -1 (sad) to 1 (happy)
 * @returns {Object} { expression, intensity }
 */
export function generateMicroExpression(elapsedMs, emotionValence = 0) {
  const phase = elapsedMs / 1000;

  // Micro-expressions happen roughly every 4-5 seconds, last ~300ms
  const microExprCycle = (phase / 4.5) % 1;

  // Trigger micro-expression
  const triggering = microExprCycle < 0.15; // Triggered in first 15% of cycle
  const intensity = triggering
    ? Math.sin(microExprCycle * Math.PI * 20) * 0.3 // Rapid pulse
    : 0;

  // Choose micro-expression based on emotion
  let expression;

  if (emotionValence > 0.3) {
    // Positive emotion: micro-smile
    expression = emotionValence > 0.6 ? "slight_smile" : "neutral";
  } else if (emotionValence < -0.3) {
    // Negative emotion: fleeting frown
    expression = emotionValence < -0.6 ? "slight_frown" : "neutral";
  } else {
    // Neutral: occasional raise eyebrow
    expression = microExprCycle < 0.05 ? "raise_eyebrow" : "neutral";
  }

  return {
    expression,
    intensity: Math.max(0, intensity),
    nextMicroExpr: (1 - microExprCycle) * 4500, // Milliseconds until next
  };
}

/**
 * Generate idle breathing animation
 * Subtle chest/body expansion/contraction
 * @param {number} elapsedMs - Time since animation start
 * @param {number} breathRate - Breaths per minute (default 12 - relaxed)
 * @returns {Object} { scale, amplitude }
 */
export function generateIdleBreathing(elapsedMs, breathRate = 12) {
  const cycleTimeMs = (60 / breathRate) * 1000;
  const phase = (elapsedMs / cycleTimeMs) * Math.PI * 2;

  // Use smoother sine curve for breathing
  const breathAmount = Math.sin(phase) * 0.02; // ±2% scale

  return {
    scale: 1 + breathAmount,
    amplitude: Math.abs(Math.sin(phase)),
    direction: Math.sin(phase) > 0 ? "inhale" : "exhale",
    cycleProgress: (phase / (Math.PI * 2)) % 1,
  };
}

/**
 * Generate eye closure animation (blink)
 * Natural blink pattern during idle time
 * @param {number} elapsedMs - Time since last blink
 * @param {number} blinkRate - Blinks per minute (default 17)
 * @returns {Object} { eyeOpenness, isBlink }
 */
export function generateIdleBlink(elapsedMs, blinkRate = 17) {
  const cycleTimeMs = (60 / blinkRate) * 1000;
  const phaseInCycle = (elapsedMs % cycleTimeMs) / cycleTimeMs;

  // Blink happens around 80-95% through cycle (quick 200ms blink)
  const isBlink = phaseInCycle > 0.8;
  let eyeOpenness = 1;

  if (isBlink) {
    const blinkPhase = (phaseInCycle - 0.8) / 0.15; // Normalize blink duration
    if (blinkPhase < 0.5) {
      // Closing eye
      eyeOpenness = 1 - blinkPhase * 2;
    } else {
      // Opening eye
      eyeOpenness = (blinkPhase - 0.5) * 2;
    }
  }

  return {
    eyeOpenness: Math.max(0, Math.min(1, eyeOpenness)),
    isBlink,
    nextBlinkIn: cycleTimeMs - (elapsedMs % cycleTimeMs),
  };
}

/**
 * Idle head micro-movements
 * Tiny head tilts and rolls
 * @param {number} elapsedMs - Time since animation start
 * @param {number} intensity - Movement intensity (0-1, 0.3 default)
 * @returns {Object} { tilt, roll, nod }
 */
export function generateIdleHeadMicro(elapsedMs, intensity = 0.3) {
  const phase = (elapsedMs / 1000) * Math.PI * 2;

  // Slow, gentle head movements
  const tilt = Math.sin(phase * 0.5) * intensity * 5; // ±5 degrees * intensity
  const roll = Math.sin(phase * 0.3 + Math.PI / 3) * intensity * 3;
  const nod = Math.cos(phase * 0.4) * intensity * 2;

  return {
    tilt,
    roll,
    nod,
    intensity,
  };
}

/**
 * Mouth idle movements (pursing, etc)
 * Subtle mouth adjustments
 * @param {number} elapsedMs - Time since animation start
 * @returns {Object} { mouthOpen, pursing, corner }
 */
export function generateIdleMouthMovement(elapsedMs) {
  const phase = (elapsedMs / 1000) * Math.PI * 2;

  // Very slight mouth opening/closing
  const mouthOpen = Math.sin(phase * 0.3) * 0.05; // ±0.05 (minimal)

  // Occasional lip pursing (every ~8 seconds)
  const pursingCycle = (elapsedMs / 8000) % 1;
  const isPursing = pursingCycle > 0.9; // Last 10% of cycle
  const pursing = isPursing
    ? Math.sin((pursingCycle - 0.9) * Math.PI * 10) * 0.08
    : 0;

  // Mouth corner slightly up or down (micro-expression)
  const corner = Math.sin(phase * 0.25) * 0.04;

  return {
    mouthOpen: Math.max(-0.1, Math.min(0.1, mouthOpen)),
    pursing: Math.max(0, Math.min(0.1, pursing)),
    cornerHeight: corner,
  };
}

/**
 * Composable idle animation manager
 * Combines multiple idle animations into coherent behavior
 * @param {number} elapsedMs - Time since idle started
 * @param {Object} options - Configuration
 * @returns {Object} Complete idle animation state
 */
export function generateCompleteIdleAnimation(elapsedMs, options = {}) {
  const {
    fidgetType = "hands",
    fidgetIntensity = 0.3,
    wanderIntensity = 0.4,
    breathRate = 12,
    blinkRate = 17,
    emotionValence = 0,
  } = options;

  return {
    fidgeting: generateFidgeting(elapsedMs, fidgetType, fidgetIntensity),
    eyeWander: generateEyeWandering(elapsedMs, wanderIntensity),
    gazeTarget: generateIdleGazeTarget(elapsedMs, 4000),
    microExpr: generateMicroExpression(elapsedMs, emotionValence),
    breathing: generateIdleBreathing(elapsedMs, breathRate),
    blink: generateIdleBlink(elapsedMs, blinkRate),
    headMicro: generateIdleHeadMicro(elapsedMs),
    mouthMovement: generateIdleMouthMovement(elapsedMs),
    totalElapsed: elapsedMs,
  };
}

/**
 * Reduce idle intensity when user is speaking/interacting
 * Smooth transition from idle to active
 * @param {Object} idleState - Current idle animation state
 * @param {number} fadeOutMs - Milliseconds to fade
 * @param {number} elapsedMs - Time into fade
 * @returns {Object} Modified idle state with reduced intensity
 */
export function fadeOutIdleAnimation(idleState, fadeOutMs, elapsedMs) {
  const fadeRatio = Math.max(0, 1 - elapsedMs / fadeOutMs);

  return {
    ...idleState,
    fidgeting: {
      ...idleState.fidgeting,
      x: idleState.fidgeting.x * fadeRatio,
      y: idleState.fidgeting.y * fadeRatio,
      z: idleState.fidgeting.z * fadeRatio,
    },
    eyeWander: {
      ...idleState.eyeWander,
      gazeDirX: idleState.eyeWander.gazeDirX * fadeRatio,
      gazeDirY: idleState.eyeWander.gazeDirY * fadeRatio,
    },
    headMicro: {
      ...idleState.headMicro,
      tilt: idleState.headMicro.tilt * fadeRatio,
      roll: idleState.headMicro.roll * fadeRatio,
      nod: idleState.headMicro.nod * fadeRatio,
    },
  };
}

/**
 * Emotion-aware fidgeting
 * Different emotions fidget differently
 * @param {string} emotion - Current emotion
 * @param {number} elapsedMs - Animation time
 * @returns {Object} Emotion-specific fidgeting
 */
export function getEmotionAwareFidgeting(emotion, elapsedMs) {
  const emotionFidgets = {
    anxious: {
      type: "nervous",
      intensity: 0.6,
      frequency: 2.5,
    },
    excited: {
      type: "weight_shift",
      intensity: 0.4,
      frequency: 1.5,
    },
    calm: {
      type: "shoulders",
      intensity: 0.15,
      frequency: 0.8,
    },
    tired: {
      type: "weight_shift",
      intensity: 0.2,
      frequency: 0.5,
    },
    focused: {
      type: "hands",
      intensity: 0.2,
      frequency: 1.0,
    },
  };

  const config = emotionFidgets[emotion] || emotionFidgets.calm;

  return generateFidgeting(
    elapsedMs * config.frequency,
    config.type,
    config.intensity,
  );
}

/**
 * Check if enough time has passed for a random idle action
 * Used to trigger occasional animations
 * @param {number} elapsedMs - Time since idle started
 * @param {number} minIntervalMs - Minimum time between actions
 * @param {number} maxIntervalMs - Maximum time between actions
 * @param {string} actionKey - Unique key for this action
 * @returns {boolean} Should trigger action
 */
export function shouldTriggerRandomIdleAction(
  elapsedMs,
  minIntervalMs = 3000,
  maxIntervalMs = 8000,
  actionKey = "idle",
) {
  // Use hash of action key to get deterministic pseudo-random interval
  const hashCode = actionKey.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const interval =
    minIntervalMs +
    ((Math.abs(hashCode) % (maxIntervalMs - minIntervalMs)) /
      Math.abs(hashCode)) *
      (maxIntervalMs - minIntervalMs);

  return elapsedMs % interval < 500; // Trigger for 500ms window
}
