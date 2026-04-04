/**
 * Avatar Presets - 4 diverse, gender-neutral presets
 * Each preset defines facial features, proportions, and colors
 */

export const AVATAR_PRESETS = {
  neutral_light: {
    id: "neutral_light",
    name: "Serene Light",
    description: "Light skin, straight hair, calm features",
    backgroundColor: "#F5F0EB",
    skinTone: "#E8B4A0",
    skinToneAccent: "#D49080",
    hairColor: "#3D2817",
    hairStyle: "straight", // straight, wavy, curly
    eyeColor: "#6B4423",
    eyeHighlight: "#FFFFFF",
    eyebrowColor: "#4A352A",
    noseShade: "#D49080",
    mouthColor: "#C89080",
    faceShape: "oval", // oval, round, square
    jawWidth: 0.35,
    faceWidth: 280,
    faceHeight: 350,
  },

  neutral_dark: {
    id: "neutral_dark",
    name: "Bold Dark",
    description: "Dark skin, curly hair, warm features",
    backgroundColor: "#2A2520",
    skinTone: "#6B4423",
    skinToneAccent: "#5A3A1C",
    hairColor: "#2A1810",
    hairStyle: "curly",
    eyeColor: "#3D2817",
    eyeHighlight: "#FFFFFF",
    eyebrowColor: "#1C0F0A",
    noseShade: "#5A3A1C",
    mouthColor: "#8B5A3C",
    faceShape: "round",
    jawWidth: 0.32,
    faceWidth: 280,
    faceHeight: 350,
  },

  neutral_olive: {
    id: "neutral_olive",
    name: "Gentle Olive",
    description: "Olive skin, wavy hair, expressive features",
    backgroundColor: "#E8F1E0",
    skinTone: "#C9A885",
    skinToneAccent: "#B89875",
    hairColor: "#2F2415",
    hairStyle: "wavy",
    eyeColor: "#5C4033",
    eyeHighlight: "#FFFFFF",
    eyebrowColor: "#402F20",
    noseShade: "#B89875",
    mouthColor: "#B87555",
    faceShape: "oval",
    jawWidth: 0.36,
    faceWidth: 280,
    faceHeight: 350,
  },

  neutral_diverse: {
    id: "neutral_diverse",
    name: "Vibrant Diverse",
    description: "Mixed tones, dynamic features, unique style",
    backgroundColor: "#F0EAE0",
    skinTone: "#9B6B4D",
    skinToneAccent: "#8A5C42",
    hairColor: "#1A1410",
    hairStyle: "wavy",
    eyeColor: "#4A3428",
    eyeHighlight: "#FFFFFF",
    eyebrowColor: "#2C1F18",
    noseShade: "#8A5C42",
    mouthColor: "#A86455",
    faceShape: "square",
    jawWidth: 0.38,
    faceWidth: 290,
    faceHeight: 360,
  },
};

/**
 * Emotion to expression mapping
 * Each emotion defines facial feature adjustments
 */
export const EMOTIONS = {
  neutral: {
    id: "neutral",
    eyeOpenness: 1.0, // 0-1, how open eyes are
    eyebrowHeight: 0, // -1 to 1, -1 = furrowed, 1 = raised
    mouthShape: 0, // -1 = frown, 0 = neutral, 1 = smile
    headTilt: 0, // -30 to 30 degrees
    eyeDirection: 0, // -1 = left, 0 = center, 1 = right
  },

  happy: {
    id: "happy",
    eyeOpenness: 0.95,
    eyebrowHeight: 0.2,
    mouthShape: 0.8, // big smile
    headTilt: 5,
    eyeDirection: 0,
  },

  sad: {
    id: "sad",
    eyeOpenness: 0.7,
    eyebrowHeight: -0.4,
    mouthShape: -0.6, // frown
    headTilt: -10,
    eyeDirection: -0.3,
  },

  thinking: {
    id: "thinking",
    eyeOpenness: 0.9,
    eyebrowHeight: 0.3, // raised in thought
    mouthShape: 0.1,
    headTilt: 15, // head tilt suggests contemplation
    eyeDirection: 0.5, // looking up/away
  },

  curious: {
    id: "curious",
    eyeOpenness: 1.1, // eyes wider
    eyebrowHeight: 0.5, // raised
    mouthShape: 0.2, // slight smile
    headTilt: -20, // head tilt/lean
    eyeDirection: 0.3,
  },

  concerned: {
    id: "concerned",
    eyeOpenness: 1.0,
    eyebrowHeight: -0.3, // furrowed but not frowning
    mouthShape: -0.2,
    headTilt: -5,
    eyeDirection: 0.2,
  },

  compassionate: {
    id: "compassionate",
    eyeOpenness: 0.95,
    eyebrowHeight: 0.15,
    mouthShape: 0.3, // warm smile
    headTilt: 8,
    eyeDirection: 0, // direct eye contact
  },

  excited: {
    id: "excited",
    eyeOpenness: 1.15, // eyes very wide
    eyebrowHeight: 0.8, // raised high
    mouthShape: 1.0, // biggest smile
    headTilt: -15,
    eyeDirection: 0,
  },
};

// Background scene options
export const BACKGROUNDS = {
  living_room: {
    id: "living_room",
    name: "Living Room",
    backgroundColor: "#E8D4C0",
    accentColor: "#8B6F47",
    lightingIntensity: 0.8,
    description: "Warm, cozy home environment",
  },

  office: {
    id: "office",
    name: "Office",
    backgroundColor: "#D3D3D3",
    accentColor: "#4A4A4A",
    lightingIntensity: 0.9,
    description: "Professional workspace",
  },

  garden: {
    id: "garden",
    name: "Garden",
    backgroundColor: "#A8D5BA",
    accentColor: "#2D6A4F",
    lightingIntensity: 1.0,
    description: "Natural outdoor setting",
  },

  abstract: {
    id: "abstract",
    name: "Abstract",
    backgroundColor: "#1F1F3D",
    accentColor: "#6B4CE1",
    lightingIntensity: 0.7,
    description: "Modern gradient background",
  },

  space: {
    id: "space",
    name: "Space",
    backgroundColor: "#0A0E27",
    accentColor: "#4A90E2",
    lightingIntensity: 0.5,
    description: "Cosmic environment",
  },

  none: {
    id: "none",
    name: "None",
    backgroundColor: "#FFFFFF",
    accentColor: "#F0F0F0",
    lightingIntensity: 1.0,
    description: "Simple white background",
  },
};

// Voice options
export const VOICE_OPTIONS = {
  default: {
    id: "default",
    name: "Default",
    description: "Natural balanced voice",
  },

  warm: {
    id: "warm",
    name: "Warm",
    description: "Soft, comforting tone",
  },

  professional: {
    id: "professional",
    name: "Professional",
    description: "Clear, confident tone",
  },
};

export default {
  AVATAR_PRESETS,
  EMOTIONS,
  BACKGROUNDS,
  VOICE_OPTIONS,
};
