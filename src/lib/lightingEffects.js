/**
 * Lighting Effects Library
 * Provides context-aware lighting configurations for each background scene
 * Adjusts avatar visibility, shadow strength, and ambient color based on environment
 */

/**
 * Get lighting configuration for a background scene
 * Affects avatar rendering brightness and quality adapts lighting to scene
 *
 * @param {string} backgroundId - ID of background scene
 * @param {number} baseBrightness - Base brightness multiplier (0-1)
 * @returns {Object} Lighting configuration object
 */
export function getLightingConfig(backgroundId, baseBrightness = 1.0) {
  const configs = {
    living_room: {
      intensity: 0.8 * baseBrightness,
      overlayColor: "rgba(255, 200, 100, 0.02)", // Warm overlay
      overlayOpacity: 0.08,
      ambientColor: "rgba(255, 200, 100, 0.03)", // Warm ambient
      ambientOpacity: 0.1,
      blendMode: "screen",
      shadowIntensity: 0.3,
      shadowColor: "rgba(100, 60, 20, 0.4)",
      avatarFilter: "brightness(1) contrast(1.05)",
    },

    office: {
      intensity: 0.95 * baseBrightness,
      overlayColor: "rgba(200, 200, 200, 0.01)", // Cool overlay
      overlayOpacity: 0.05,
      ambientColor: "rgba(230, 230, 230, 0.04)", // Bright ambient
      ambientOpacity: 0.08,
      blendMode: "overlay",
      shadowIntensity: 0.25,
      shadowColor: "rgba(100, 100, 100, 0.3)",
      avatarFilter: "brightness(1.1) contrast(1.1) saturate(0.95)",
    },

    garden: {
      intensity: 1.0 * baseBrightness,
      overlayColor: "rgba(150, 220, 180, 0.02)", // Natural overlay
      overlayOpacity: 0.06,
      ambientColor: "rgba(150, 200, 150, 0.04)", // Green ambient
      ambientOpacity: 0.12,
      blendMode: "multiply",
      shadowIntensity: 0.35,
      shadowColor: "rgba(34, 139, 34, 0.3)",
      avatarFilter: "brightness(1.05) contrast(1) saturate(1.1)",
    },

    abstract: {
      intensity: 0.7 * baseBrightness,
      overlayColor: "rgba(107, 76, 225, 0.03)", // Purple overlay
      overlayOpacity: 0.1,
      ambientColor: "rgba(100, 150, 255, 0.05)", // Blue ambient
      ambientOpacity: 0.15,
      blendMode: "color-dodge",
      shadowIntensity: 0.4,
      shadowColor: "rgba(107, 76, 225, 0.4)",
      avatarFilter: "brightness(0.95) contrast(1.15) hue-rotate(-10deg)",
    },

    space: {
      intensity: 0.5 * baseBrightness,
      overlayColor: "rgba(65, 105, 225, 0.04)", // Blue overlay
      overlayOpacity: 0.12,
      ambientColor: "rgba(100, 150, 255, 0.06)", // Cosmic ambient
      ambientOpacity: 0.2,
      blendMode: "screen",
      shadowIntensity: 0.5,
      shadowColor: "rgba(65, 105, 225, 0.5)",
      avatarFilter: "brightness(0.9) contrast(1.2) saturate(1.2)",
    },
  };

  return configs[backgroundId] || configs.living_room;
}

/**
 * Calculate dynamic shadow based on lighting and position
 * Creates realistic shadows that respond to scene lighting
 *
 * @param {Object} lightingConfig - Lighting configuration
 * @param {number} avatarX - Avatar X position (normalized 0-1)
 * @param {number} avatarY - Avatar Y position (normalized 0-1)
 * @returns {Object} Shadow style object
 */
export function calculateDynamicShadow(
  lightingConfig,
  avatarX = 0.5,
  avatarY = 0.5,
) {
  const shadowBlur = 20 + avatarY * 15;
  const shadowSpread = 5 + avatarY * 8;

  return {
    boxShadow: `
      0 ${shadowBlur}px ${shadowSpread + 10}px ${shadowSpread}px ${lightingConfig.shadowColor}
    `,
    filter: `drop-shadow(0 ${shadowBlur}px ${shadowSpread}px ${lightingConfig.shadowColor})`,
  };
}

/**
 * Get CSS filter string for avatar based on lighting
 * Applied directly to avatar element for color correction
 *
 * @param {Object} lightingConfig - Lighting configuration
 * @param {number} additionalBrightness - Additional brightness adjustment
 * @returns {string} CSS filter string
 */
export function getAvatarFilter(lightingConfig, additionalBrightness = 0) {
  const baseBrightness = parseInt(
    lightingConfig.avatarFilter.match(/brightness\(([0-9.]+)/)[1],
  );
  const adjustedBrightness = Math.max(
    0.5,
    Math.min(1.5, baseBrightness + additionalBrightness),
  );
  return lightingConfig.avatarFilter.replace(
    /brightness\([0-9.]+\)/,
    `brightness(${adjustedBrightness})`,
  );
}

/**
 * Apply lighting effects to avatar canvas
 * More advanced lighting that responds to scene properties
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} lightingConfig - Lighting configuration
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
export function applyLightingEffects(ctx, lightingConfig, width, height) {
  // Create subtle lighting gradient overlay
  const lightingGradient = ctx.createRadialGradient(
    width / 2,
    height * 0.35,
    100,
    width / 2,
    height * 0.35,
    500,
  );

  const overlayColor = lightingConfig.overlayColor;
  lightingGradient.addColorStop(0, overlayColor);
  lightingGradient.addColorStop(
    0.5,
    overlayColor.replace(/[\d.]+\)/, "0.5)"), // Mid opacity
  );
  lightingGradient.addColorStop(1, overlayColor.replace(/[\d.]+\)/, "0)")); // Fade to transparent

  ctx.fillStyle = lightingGradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Create time-based lighting animation
 * Puls and flicker for dynamic lighting effects
 *
 * @param {number} time - Current animation time
 * @param {string} type - Animation type: 'pulse', 'flicker', 'breathe'
 * @returns {number} Brightness multiplier (0-1)
 */
export function getAnimatedLighting(time, type = "pulse") {
  switch (type) {
    case "pulse":
      // Smooth pulsing effect
      return 0.8 + Math.sin(time * 2) * 0.2;

    case "flicker":
      // Random flicker (torch/fire like)
      const flicker = Math.random() * 0.3 + 0.7;
      return Math.max(
        0.6,
        Math.min(1, 0.85 + Math.sin(time * 3) * 0.15 + (flicker - 0.85) * 0.2),
      );

    case "breathe":
      // Smooth breathing effect
      return 0.9 + Math.sin(time * 1.5) * 0.1;

    default:
      return 1;
  }
}

/**
 * Combine multiple lighting effects
 * Layers multiple lighting calculations for complex scenes
 *
 * @param {Object} ambientLight - Ambient lighting config
 * @param {Object} dynamicLight - Dynamic lighting config
 * @param {number} intensity - How much to apply effects (0-1)
 * @returns {Object} Combined lighting configuration
 */
export function combineLightingEffects(
  ambientLight,
  dynamicLight,
  intensity = 0.5,
) {
  return {
    intensity:
      ambientLight.intensity * (1 - intensity) +
      dynamicLight.intensity * intensity,
    overlayColor: ambientLight.overlayColor, // Use ambient base
    overlayOpacity:
      ambientLight.overlayOpacity * (1 - intensity) +
      dynamicLight.overlayOpacity * intensity,
    ambientColor: dynamicLight.ambientColor,
    ambientOpacity: dynamicLight.ambientOpacity * intensity,
    blendMode: ambientLight.blendMode,
    shadowIntensity: Math.max(
      ambientLight.shadowIntensity,
      dynamicLight.shadowIntensity,
    ),
    shadowColor: ambientLight.shadowColor,
  };
}

export default {
  getLightingConfig,
  calculateDynamicShadow,
  getAvatarFilter,
  applyLightingEffects,
  getAnimatedLighting,
  combineLightingEffects,
};
