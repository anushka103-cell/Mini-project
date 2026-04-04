/**
 * FacialColorSystem
 * Manages dynamic skin tone changes for emotions and effects
 * Handles blushing, flushing, pallor, and emotional color shifts
 */

/**
 * Get base skin tone for preset
 * @param {Object} preset - Avatar preset
 * @returns {string} Base skin tone hex color
 */
export function getBaseSkinTone(preset) {
  return preset.skinTone || "#E8B4A0";
}

/**
 * Calculate blush effect (cheek reddening)
 * Returns color overlay adjustment
 * @param {string} emotion - Current emotion
 * @param {number} intensity - Emotion intensity (0-1)
 * @returns {Object} { colorOverlay, opacity, area }
 */
export function calculateBlush(emotion, intensity = 0.5) {
  const blushMap = {
    happy: { color: "#FF6B9D", baseOpacity: 0.15 },
    excited: { color: "#FF5C7C", baseOpacity: 0.2 },
    embarrassed: { color: "#FF9999", baseOpacity: 0.35 },
    compassionate: { color: "#FFB3D9", baseOpacity: 0.1 },
    concerned: { color: "#FF8888", baseOpacity: 0.08 },
    sad: { color: "#E0E0E0", baseOpacity: 0.0 }, // No blush when sad
    angry: { color: "#FF4444", baseOpacity: 0.15 },
  };

  const blushData = blushMap[emotion] || { color: "#FF69B4", baseOpacity: 0 };

  return {
    color: blushData.color,
    opacity: blushData.baseOpacity * intensity,
    area: "cheeks", // Applied to cheek areas
    radius: 50 + intensity * 30,
  };
}

/**
 * Calculate flushing effect (overall facial redness)
 * Used for embarrassment, fever, anger
 * @param {string} emotion - Current emotion
 * @param {number} intensity - Emotion intensity (0-1)
 * @returns {Object} { colorShift, opacity }
 */
export function calculateFlushing(emotion, intensity = 0.5) {
  const flushMap = {
    embarrassed: { color: "#FF8888", baseOpacity: 0.2 },
    angry: { color: "#FF6666", baseOpacity: 0.15 },
    excited: { color: "#FFB0B0", baseOpacity: 0.1 },
    sad: { color: "#E8E8E8", baseOpacity: 0.0 },
    sick: { color: "#FFCC99", baseOpacity: 0.15 },
  };

  const flushData = flushMap[emotion] || { color: "#FFB0B0", baseOpacity: 0 };

  return {
    color: flushData.color,
    opacity: flushData.baseOpacity * intensity,
    affectArea: "face", // Applied to entire face
  };
}

/**
 * Calculate pallor effect (pale/whitened face)
 * Used for sadness, fear, shock, sickness
 * @param {string} emotion - Current emotion
 * @param {number} intensity - How pale (0-1)
 * @returns {Object} { colorShift, white overlay opacity }
 */
export function calculatePallor(emotion, intensity = 0.5) {
  const pallorMap = {
    sad: { baseOpacity: 0.08 },
    scared: { baseOpacity: 0.25 },
    shocked: { baseOpacity: 0.3 },
    sick: { baseOpacity: 0.2 },
    thinking: { baseOpacity: 0.02 },
    concerned: { baseOpacity: 0.05 },
  };

  const pallorData = pallorMap[emotion] || { baseOpacity: 0 };

  return {
    color: "#FFFFFF",
    opacity: pallorData.baseOpacity * intensity,
    desaturate: intensity * 0.3, // Reduce color saturation
  };
}

/**
 * Blend skin tone colors smoothly
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @param {number} blend - Blend factor (0-1)
 * @returns {string} Blended hex color
 */
export function blendSkinTones(color1, color2, blend) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = Math.round(c1.r * (1 - blend) + c2.r * blend);
  const g = Math.round(c1.g * (1 - blend) + c2.g * blend);
  const b = Math.round(c1.b * (1 - blend) + c2.b * blend);

  return rgbToHex(r, g, b);
}

/**
 * Get emotional skin tone shift
 * Different emotions change perceived skin tone slightly
 * @param {string} emotion - Emotion name
 * @param {number} intensity - Emotion intensity (0-1)
 * @returns {string} Shifted hex color
 */
export function getEmotionalSkinToneShift(baseTone, emotion, intensity = 0.5) {
  const emotionShifts = {
    happy: { hueShift: 5, saturation: 1.1 }, // Slightly warmer, more saturated
    sad: { hueShift: -10, saturation: 0.8 }, // Cooler, less saturated
    excited: { hueShift: 8, saturation: 1.15 }, // Warmer
    angry: { hueShift: 15, saturation: 1.2 }, // Much warmer (reddish)
    calm: { hueShift: -2, saturation: 0.95 }, // Slightly cooler
    scared: { hueShift: -15, saturation: 0.7 }, // Much cooler (pale)
  };

  const shift = emotionShifts[emotion];
  if (!shift) return baseTone;

  // Convert base color to HSL for manipulation
  const hsl = hexToHsl(baseTone);
  hsl.h = (hsl.h + shift.hueShift * intensity) % 360;
  hsl.s = Math.max(0, Math.min(100, hsl.s * shift.saturation));

  return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Eye white color (sclera) changes
 * Bloodshot eyes for anger/tiredness, yellowing for sickness
 * @param {string} emotion - Emotion name
 * @param {number} intensity - Intensity (0-1)
 * @returns {Object} { baseColor, redness, yellowness }
 */
export function getEyeScleraColor(emotion, intensity = 0.3) {
  const scleraMap = {
    angry: { baseColor: "#FFE8E8", redness: intensity * 0.4 },
    tired: { baseColor: "#FFE8E8", redness: intensity * 0.2 },
    sick: { baseColor: "#FFFACD", yellowness: intensity * 0.3 },
    bloodshot: { baseColor: "#FFE8E8", redness: intensity * 0.5 },
    crying: { baseColor: "#FFE8E8", redness: intensity * 0.15 },
  };

  const scleraData = scleraMap[emotion] || {
    baseColor: "#FFFFFF",
    redness: 0,
    yellowness: 0,
  };

  return {
    color: scleraData.baseColor,
    redness: scleraData.redness,
    yellowness: scleraData.yellowness || 0,
  };
}

/**
 * Pupil dilation effect
 * Pupils dilate with excitement/attraction, constrict with fear
 * @param {string} emotion - Current emotion
 * @param {number} intensity - Emotional intensity (0-1)
 * @returns {number} Pupil size multiplier (0.6 to 1.4, where 1 = normal)
 */
export function calculatePupilDilation(emotion, intensity = 0.5) {
  const dilationMap = {
    excited: 1 + intensity * 0.4, // Up to 1.4x larger
    happy: 1 + intensity * 0.2,
    attracted: 1 + intensity * 0.35,
    scared: 1 - intensity * 0.3, // Down to 0.7x (constricted)
    angry: 1 - intensity * 0.15,
    thinking: 1 + intensity * 0.15,
    calm: 1 - intensity * 0.1,
  };

  const dilation = dilationMap[emotion];
  if (!dilation) return 1.0;

  // Clamp between 0.6 and 1.4
  return Math.max(0.6, Math.min(1.4, dilation));
}

/**
 * Calculate lip color changes
 * Lips get darker when excited/happy, paler when sad/scared
 * @param {string} baseLipColor - Original hex color
 * @param {string} emotion - Current emotion
 * @param {number} intensity - Intensity (0-1)
 * @returns {string} Adjusted hex color
 */
export function calculateLipColor(baseLipColor, emotion, intensity = 0.5) {
  const emotionLipMods = {
    happy: { saturation: 1.2, lightness: 1.05 }, // Brighter, more saturated
    excited: { saturation: 1.3, lightness: 1.1 },
    sad: { saturation: 0.7, lightness: 0.85 }, // Darker, duller
    scared: { saturation: 0.6, lightness: 0.8 },
    calm: { saturation: 0.95, lightness: 0.95 },
  };

  const mod = emotionLipMods[emotion];
  if (!mod) return baseLipColor;

  const hsl = hexToHsl(baseLipColor);
  hsl.s = Math.max(
    0,
    Math.min(100, hsl.s * (mod.saturation - (1 - intensity))),
  );
  hsl.l = Math.max(0, Math.min(100, hsl.l * mod.lightness));

  return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Combine all color effects into final skin tone
 * Blends: base tone, blush, flushing, pallor, emotion shift
 * @param {Object} preset - Avatar preset
 * @param {string} emotion - Current emotion
 * @param {number} intensity - Emotional intensity (0-1)
 * @returns {Object} Final color values
 */
export function getCombinedSkinTone(preset, emotion, intensity = 0.5) {
  const baseTone = getBaseSkinTone(preset);

  // Calculate all effects
  const emotionalShift = getEmotionalSkinToneShift(
    baseTone,
    emotion,
    intensity,
  );
  const blush = calculateBlush(emotion, intensity);
  const flush = calculateFlushing(emotion, intensity);
  const pallor = calculatePallor(emotion, intensity);

  return {
    base: baseTone,
    emotional: emotionalShift,
    blush,
    flush,
    pallor,
    combined: emotionalShift, // Primary color for rendering
  };
}

// Color conversion utilities
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 232, g: 180, b: 160 }; // Default skin tone
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToHex(h, s, l) {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return rgbToHex(
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  );
}
