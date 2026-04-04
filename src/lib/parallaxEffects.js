/**
 * Parallax Effects Library
 * Utilities for creating depth and motion effects in backgrounds
 * Different parallax speeds for various layers create visual depth
 */

/**
 * Calculate parallax offset for a layer based on depth
 * Closer layers move more, distant layers move less
 *
 * @param {number} baseOffset - Base parallax offset
 * @param {number} depth - Depth multiplier (0-1, where 1 is closest)
 * @param {number} maxOffset - Maximum offset in pixels
 * @returns {number} Adjusted parallax offset
 */
export function getLayerParallax(baseOffset, depth = 0.5, maxOffset = 50) {
  return baseOffset * depth * (maxOffset / 50);
}

/**
 * Create multi-layer parallax effect
 * Returns offsets for multiple background layers
 *
 * @param {number} baseOffset - Base parallax offset
 * @param {number} layerCount - Number of parallax layers
 * @returns {Array<number>} Array of offsets for each layer
 */
export function getMultiLayerParallax(baseOffset, layerCount = 5) {
  const layers = [];
  for (let i = 0; i < layerCount; i++) {
    const depth = i / layerCount; // 0 to 1
    layers.push(getLayerParallax(baseOffset, depth));
  }
  return layers;
}

/**
 * Calculate parallax offset based on mouse position
 * Creates realistic depth based on cursor movement
 *
 * @param {number} mouseX - Mouse X position (normalized -1 to 1)
 * @param {number} mouseY - Mouse Y position (normalized -1 to 1)
 * @param {number} intensity - How strong the effect is (0-1)
 * @returns {Object} Parallax offsets for X and Y
 */
export function getMouseParallax(mouseX, mouseY, intensity = 0.5) {
  const maxOffset = 100;
  return {
    x: mouseX * maxOffset * intensity,
    y: mouseY * maxOffset * intensity * 0.5, // Y effect reduced
  };
}

/**
 * Apply parallax to canvas drawing
 * Translates canvas context based on parallax offset
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} parallaxX - X parallax offset
 * @param {number} parallaxY - Y parallax offset
 * @param {Function} drawFunction - Function that draws on ctx
 */
export function drawWithParallax(ctx, parallaxX, parallaxY, drawFunction) {
  ctx.save();
  ctx.translate(parallaxX, parallaxY);
  drawFunction(ctx);
  ctx.restore();
}

/**
 * Create parallax gradient that moves with offset
 * Useful for animated backgrounds that shift with parallax
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} parallaxOffset - Parallax offset amount
 * @param {string} colorStart - Starting gradient color
 * @param {string} colorEnd - Ending gradient color
 * @returns {CanvasGradient} Parallax-adjusted gradient
 */
export function createParallaxGradient(
  ctx,
  width,
  height,
  parallaxOffset,
  colorStart,
  colorEnd,
) {
  const adjustedX = (parallaxOffset % width) * 0.5;
  const gradient = ctx.createLinearGradient(
    adjustedX,
    0,
    adjustedX + width,
    height,
  );
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

/**
 * Generate random parallax layers for procedural backgrounds
 * Creates natural-looking depth variation
 *
 * @param {number} layerCount - Number of layers to generate
 * @param {number} maxOffset - Maximum offset for each layer
 * @returns {Array<Object>} Array of layer configurations
 */
export function generateParallaxLayers(layerCount = 5, maxOffset = 50) {
  const layers = [];
  for (let i = 0; i < layerCount; i++) {
    const depth = i / layerCount;
    const speedVariation = 0.8 + Math.random() * 0.4;
    const offsetVariation = Math.random() * 20 - 10;

    layers.push({
      depth,
      speed: depth * speedVariation,
      offset: offsetVariation,
      maxOffset: maxOffset * depth,
    });
  }
  return layers;
}

/**
 * Apply parallax to SVG/DOM elements
 * Returns CSS transform string for parallax effect
 *
 * @param {number} parallaxOffset - Base parallax offset
 * @param {number} depth - Layer depth (0-1)
 * @param {boolean} perspective3D - Use 3D perspective
 * @returns {string} CSS transform string
 */
export function getParallaxTransform(
  parallaxOffset,
  depth = 0.5,
  perspective3D = false,
) {
  const offset = parallaxOffset * depth;

  if (perspective3D) {
    const zDepth = depth * 500;
    return `translate3d(${offset}px, 0, ${zDepth}px)`;
  }

  return `translateX(${offset}px)`;
}

/**
 * Create horizontal parallax scrolling effect
 * Loops the background seamlessly
 *
 * @param {number} parallaxOffset - Current parallax offset
 * @param {number} imageWidth - Width of repeating image
 * @param {number} depth - Layer depth
 * @returns {number} Adjusted position for seamless looping
 */
export function getLoopingParallaxPosition(
  parallaxOffset,
  imageWidth,
  depth = 0.5,
) {
  const adjustedOffset = (parallaxOffset * depth) % imageWidth;
  return adjustedOffset;
}

/**
 * Smooth parallax animation between values
 * Reduces jitter and creates smooth motion
 *
 * @param {number} currentOffset - Current parallax offset
 * @param {number} targetOffset - Target parallax offset
 * @param {number} smoothing - Smoothing factor (0-1, higher = smoother)
 * @returns {number} Smoothed parallax offset
 */
export function smoothParallax(currentOffset, targetOffset, smoothing = 0.1) {
  return currentOffset + (targetOffset - currentOffset) * smoothing;
}

/**
 * Parallax easing function
 * Creates more natural parallax motion curves
 *
 * @param {number} offset - Raw parallax offset
 * @param {string} easeType - Type of easing: 'linear', 'easeIn', 'easeOut', 'easeInOut'
 * @returns {number} Eased parallax offset
 */
export function easeParallax(offset, easeType = "easeInOut") {
  const t = Math.min(Math.max(Math.abs(offset) / 100, 0), 1); // Normalize 0-1
  const sign = offset < 0 ? -1 : 1;

  let easedT;
  switch (easeType) {
    case "easeIn":
      easedT = t * t; // Quadratic in
      break;
    case "easeOut":
      easedT = t * (2 - t); // Quadratic out
      break;
    case "easeInOut":
      easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Quadratic inOut
      break;
    default:
      easedT = t;
  }

  return easedT * 100 * sign;
}

/**
 * Calculate parallax for circular/radial motion
 * Creates orbital parallax effects
 *
 * @param {number} time - Animation time
 * @param {number} radius - Orbit radius
 * @param {number} depth - Layer depth
 * @returns {Object} X and Y parallax offsets
 */
export function getOrbitalParallax(time, radius = 50, depth = 0.5) {
  const angle = time * 0.5;
  return {
    x: Math.cos(angle) * radius * depth,
    y: Math.sin(angle) * radius * depth * 0.5, // Reduce Y effect
  };
}

export default {
  getLayerParallax,
  getMultiLayerParallax,
  getMouseParallax,
  drawWithParallax,
  createParallaxGradient,
  generateParallaxLayers,
  getParallaxTransform,
  getLoopingParallaxPosition,
  smoothParallax,
  easeParallax,
  getOrbitalParallax,
};
