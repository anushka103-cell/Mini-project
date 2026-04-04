/**
 * TearsEngine
 * Manages tear generation, rendering, and physics
 * Handles sadness tears, joy tears, tear droplets
 */

/**
 * Initialize tear stream for one eye
 * @param {Object} eyePosition - { x, y } eye center
 * @param {string} type - 'sadness' | 'joy' | 'shock'
 * @returns {Object} Tear stream configuration
 */
export function createTearStream(eyePosition, type = "sadness") {
  const typeConfig = {
    sadness: {
      flowRate: 4, // Tears per second
      tearSize: 3,
      color: "#A0D0FF",
      opacity: 0.7,
      speed: 25, // pixels/second downward
      frequency: 2000, // New tear every Nms
    },
    joy: {
      flowRate: 1,
      tearSize: 2,
      color: "#B0E0FF",
      opacity: 0.6,
      speed: 20,
      frequency: 3000,
    },
    shock: {
      flowRate: 3,
      tearSize: 2.5,
      color: "#A0D0FF",
      opacity: 0.65,
      speed: 35,
      frequency: 1500,
    },
  };

  const config = typeConfig[type] || typeConfig.sadness;

  return {
    eyeX: eyePosition.x,
    eyeY: eyePosition.y,
    active: true,
    type,
    droplets: [],
    nextTearTime: 0,
    ...config,
  };
}

/**
 * Generate new tear droplet
 * @param {number} eyeX - Eye X position
 * @param {number} eyeY - Eye Y position
 * @param {Object} config - Tear stream config
 * @returns {Object} Tear droplet
 */
export function generateTearDroplet(eyeX, eyeY, config) {
  // Slight variation in starting position (around eye corner)
  const xVariation = (Math.random() - 0.5) * 8;
  const yVariation = (Math.random() - 0.5) * 4;

  return {
    x: eyeX + xVariation,
    y: eyeY - 8 + yVariation, // Start slightly above eye
    vx: (Math.random() - 0.5) * 2, // Slight horizontal drift
    vy: config.speed,
    life: 2000, // Milliseconds before fading
    maxLife: 2000,
    size: config.tearSize + (Math.random() - 0.5) * 0.5,
    color: config.color,
  };
}

/**
 * Update tear stream - add new tears, update existing
 * @param {Object} tearStream - Tear stream to update
 * @param {number} deltaMs - Milliseconds since last update
 * @param {number} emotionIntensity - Emotion strength (0-1)
 */
export function updateTearStream(tearStream, deltaMs, emotionIntensity = 0.5) {
  if (!tearStream.active) return;

  // Add new tears based on flow rate and intensity
  tearStream.nextTearTime -= deltaMs * emotionIntensity;
  while (tearStream.nextTearTime < 0) {
    tearStream.droplets.push(
      generateTearDroplet(tearStream.eyeX, tearStream.eyeY, tearStream),
    );
    tearStream.nextTearTime += tearStream.frequency;
  }

  // Update existing droplets
  for (let i = tearStream.droplets.length - 1; i >= 0; i--) {
    const drop = tearStream.droplets[i];

    // Physics
    drop.x += drop.vx;
    drop.y += drop.vy;
    drop.vy += 0.15; // Gravity
    drop.life -= deltaMs;

    // Remove dead droplets
    if (drop.life <= 0) {
      tearStream.droplets.splice(i, 1);
    }
  }
}

/**
 * Render tear droplets on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} tearStream - Tear stream to render
 */
export function drawTears(ctx, tearStream) {
  if (!tearStream.active || tearStream.droplets.length === 0) return;

  for (const drop of tearStream.droplets) {
    const opacity = (drop.life / drop.maxLife) * tearStream.opacity;

    // Draw tear as teardrop shape
    ctx.save();
    ctx.fillStyle = `rgba(${hexToRgbString(drop.color)}, ${opacity})`;
    ctx.globalAlpha = opacity;

    ctx.translate(drop.x, drop.y);

    // Draw teardrop: circle + pointed bottom
    ctx.beginPath();
    ctx.arc(0, 0, drop.size, 0, Math.PI * 2);
    ctx.fill();

    // Point at bottom
    ctx.beginPath();
    ctx.moveTo(-drop.size * 0.3, drop.size);
    ctx.lineTo(0, drop.size * 2);
    ctx.lineTo(drop.size * 0.3, drop.size);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Render with tear trails (optional improved rendering)
 * Shows the path tears take down cheek
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} tearStream - Tear stream
 */
export function drawTearTrails(ctx, tearStream) {
  if (!tearStream.active || tearStream.droplets.length === 0) return;

  for (const drop of tearStream.droplets) {
    if (drop.life > drop.maxLife * 0.5) continue; // Only show trail for older tears

    const opacity = (drop.life / drop.maxLife) * tearStream.opacity * 0.4;

    ctx.save();
    ctx.strokeStyle = `rgba(${hexToRgbString(drop.color)}, ${opacity})`;
    ctx.lineWidth = drop.size * 1.5;
    ctx.lineCap = "round";

    // Draw trail from eye down to current position
    ctx.beginPath();
    ctx.moveTo(tearStream.eyeX, tearStream.eyeY);
    ctx.lineTo(drop.x, drop.y);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Create dual tear streams (both eyes)
 * Used for strong emotional moments
 * @param {Object} eyePositions - { left: {x, y}, right: {x, y} }
 * @param {string} type - Tear type
 * @returns {Object} { left: stream, right: stream }
 */
export function createBothEyeTears(eyePositions, type = "sadness") {
  return {
    left: createTearStream(eyePositions.left, type),
    right: createTearStream(eyePositions.right, type),
  };
}

/**
 * Update both tear streams
 * @param {Object} tearStreams - { left, right }
 * @param {number} deltaMs - Time elapsed
 * @param {number} emotionIntensity - Emotion strength
 */
export function updateBothTearStreams(tearStreams, deltaMs, emotionIntensity) {
  updateTearStream(tearStreams.left, deltaMs, emotionIntensity);
  updateTearStream(tearStreams.right, deltaMs, emotionIntensity);
}

/**
 * Draw both tear streams
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} tearStreams - { left, right }
 */
export function drawBothTears(ctx, tearStreams) {
  drawTears(ctx, tearStreams.left);
  drawTears(ctx, tearStreams.right);
  drawTearTrails(ctx, tearStreams.left);
  drawTearTrails(ctx, tearStreams.right);
}

/**
 * Calculate tear flow based on emotion
 * Sad = heavy tears, Joy = occasional, Shock = rapid
 * @param {string} emotion - Current emotion
 * @param {number} intensity - Emotional intensity (0-1)
 * @returns {Object} Configuration object
 */
export function getTearConfiguration(emotion, intensity) {
  const configs = {
    sad: {
      active: intensity > 0.3,
      type: "sadness",
      intensityMultiplier: intensity,
      includeTrails: intensity > 0.6,
      blinkRate: 0.8, // Faster blinking
    },
    happy: {
      active: intensity > 0.4 && Math.random() > 0.5, // Occasionally
      type: "joy",
      intensityMultiplier: intensity * 0.3,
      includeTrails: false,
      blinkRate: 1.2,
    },
    shocked: {
      active: intensity > 0.5,
      type: "shock",
      intensityMultiplier: intensity * 0.8,
      includeTrails: intensity > 0.7,
      blinkRate: 0.3, // Reduced blinking (eyes wide)
    },
    overwhelmed: {
      active: intensity > 0.4,
      type: "sadness",
      intensityMultiplier: intensity,
      includeTrails: true,
      blinkRate: 0.6,
    },
    moved: {
      active: intensity > 0.5,
      type: "joy",
      intensityMultiplier: intensity * 0.6,
      includeTrails: intensity > 0.7,
      blinkRate: 1.0,
    },
  };

  return configs[emotion] || { active: false };
}

/**
 * Fade out tear stream (stop new tears, let existing ones fall)
 * @param {Object} tearStream - Stream to fade
 * @returns {Object} Updated stream
 */
export function fadeTearStream(tearStream) {
  tearStream.active = false;
  // Droplets continue falling until life expires
  return tearStream;
}

/**
 * Stop tear stream immediately
 * @param {Object} tearStream - Stream to stop
 */
export function stopTearStream(tearStream) {
  tearStream.active = false;
  tearStream.droplets = [];
}

/**
 * Get tear volume (count) for effects
 * Useful for triggering other effects when crying heavily
 * @param {Object} tearStream - Tear stream
 * @returns {number} Number of active droplets
 */
export function getTearVolume(tearStream) {
  return tearStream.droplets.length;
}

/**
 * Heavy crying: increase all droplets
 * @param {Object} tearStream - Stream to intensify
 * @param {number} multiplier - Flow multiplier (default 2.0)
 */
export function intensifyCrying(tearStream, multiplier = 2.0) {
  tearStream.flowRate *= multiplier;
  tearStream.frequency /= multiplier;
  // Add extra droplets immediately
  for (let i = 0; i < 10; i++) {
    tearStream.droplets.push(
      generateTearDroplet(tearStream.eyeX, tearStream.eyeY, tearStream),
    );
  }
}

/**
 * Quiet crying: reduce tear flow
 * @param {Object} tearStream - Stream to reduce
 * @param {number} divisor - Flow divisor (default 2.0)
 */
export function quietenCrying(tearStream, divisor = 2.0) {
  tearStream.flowRate /= divisor;
  tearStream.frequency *= divisor;
}

/**
 * Apply tear effects to eye region
 * Tears pool slightly, making eyes appear wet
 * @param {Object} eyeData - Eye rendering data
 * @param {Object} tearStream - Active tear stream
 * @param {number} emotionIntensity - Intensity (0-1)
 * @returns {Object} Modified eye data
 */
export function applyTearEffectsToEyes(eyeData, tearStream, emotionIntensity) {
  if (!tearStream.active) return eyeData;

  const tearCount = tearStream.droplets.length;
  const wetness = Math.min(tearCount * 0.05, emotionIntensity);

  return {
    ...eyeData,
    scleraOpacity: 1 + wetness * 0.15, // Shinier appearance
    wetness: wetness,
  };
}

// Helper: Convert hex to RGB string for canvas
function hexToRgbString(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "160, 208, 255"; // Default tear blue

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `${r}, ${g}, ${b}`;
}

/**
 * Create tear animation sequence
 * For complex crying scenes (prolonged sadness, etc)
 * @param {Object} eyePositions - Eye coords
 * @param {Object} options - { duration, intensity, type }
 * @returns {Function} Animation function
 */
export function createTearAnimationSequence(eyePositions, options = {}) {
  const {
    duration = 5000, // 5 seconds
    intensity = 1.0,
    type = "sadness",
  } = options;

  const tearStreams = createBothEyeTears(eyePositions, type);
  let elapsedMs = 0;

  return (deltaMs) => {
    elapsedMs += deltaMs;

    // Fade in over first 500ms
    let currentIntensity = Math.min(elapsedMs / 500, intensity);

    // Fade out over last 500ms
    if (elapsedMs > duration - 500) {
      currentIntensity *= 1 - (elapsedMs - (duration - 500)) / 500;
    }

    updateBothTearStreams(tearStreams, deltaMs, currentIntensity);

    return {
      tearStreams,
      complete: elapsedMs >= duration,
      progress: elapsedMs / duration,
    };
  };
}
