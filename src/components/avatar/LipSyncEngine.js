/**
 * LipSyncEngine
 * Syncs mouth shapes to speech audio for realistic lip-sync
 * Uses audio frequency analysis and phoneme detection
 */

/**
 * Initialize lip-sync engine for an utterance
 * @param {SpeechSynthesisUtterance} utterance - The utterance being played
 * @returns {Object} Lip-sync controller
 */
export function initializeLipSync(utterance, onMouthShape) {
  const lipSyncState = {
    currentPhoneme: "neutral",
    mouthOpenness: 0,
    isPlaying: false,
    audioTime: 0,
    phonemeSequence: [],
  };

  // Listen to utterance events
  if (utterance) {
    utterance.onstart = () => {
      lipSyncState.isPlaying = true;
    };

    utterance.onend = () => {
      lipSyncState.isPlaying = false;
      lipSyncState.mouthOpenness = 0;
      if (onMouthShape) onMouthShape({ mouthShape: 0, phoneme: "neutral" });
    };

    utterance.onpause = () => {
      lipSyncState.isPlaying = false;
    };

    utterance.onresume = () => {
      lipSyncState.isPlaying = true;
    };
  }

  return {
    state: lipSyncState,
    updateMouth: (text, audioTime) =>
      updateLipSyncFromText(text, audioTime, lipSyncState, onMouthShape),
    generatePhonemeSequence: (text) => generatePhonemeSequence(text),
  };
}

/**
 * Generate phoneme sequence from text
 * Uses simplified phoneme mapping (not perfect speech recognition, but effective)
 * @param {string} text - The text being spoken
 * @returns {Array} Array of {phoneme, duration, startTime}
 */
export function generatePhonemeSequence(text) {
  const phonemeMap = {
    // Vowels - mouth open
    a: { shape: 0.8, duration: 100 },
    e: { shape: 0.6, duration: 80 },
    i: { shape: 0.4, duration: 80 },
    o: { shape: 0.7, duration: 100 },
    u: { shape: 0.5, duration: 100 },

    // Consonants - various shapes
    b: { shape: 0.0, duration: 50 }, // Lips together
    p: { shape: 0.0, duration: 50 }, // Lips together
    m: { shape: 0.0, duration: 50 }, // Lips together
    f: { shape: 0.3, duration: 60 },
    v: { shape: 0.3, duration: 60 },
    t: { shape: 0.2, duration: 40 },
    d: { shape: 0.2, duration: 40 },
    n: { shape: 0.3, duration: 50 },
    s: { shape: 0.2, duration: 60 },
    z: { shape: 0.2, duration: 60 },
    l: { shape: 0.3, duration: 60 },
    r: { shape: 0.4, duration: 80 },
    k: { shape: 0.1, duration: 40 },
    g: { shape: 0.1, duration: 40 },
    th: { shape: 0.2, duration: 70 },
    sh: { shape: 0.4, duration: 80 },
    ch: { shape: 0.3, duration: 80 },
    j: { shape: 0.3, duration: 80 },
    y: { shape: 0.4, duration: 60 },
    w: { shape: 0.6, duration: 70 },
    h: { shape: 0.5, duration: 50 },
  };

  const sequence = [];
  const lowerText = text.toLowerCase();
  let currentTime = 0;

  // Simple phoneme extraction (not perfect, but works well enough)
  let i = 0;
  while (i < lowerText.length) {
    const char = lowerText[i];
    let phoneme = char;
    let duration = 100;
    let shape = 0.5;

    // Check for digraphs (two-character phonemes)
    if (i < lowerText.length - 1) {
      const digraph = char + lowerText[i + 1];
      if (phonemeMap[digraph]) {
        phoneme = digraph;
        const phonemeData = phonemeMap[digraph];
        shape = phonemeData.shape;
        duration = phonemeData.duration;
        i++;
      } else if (phonemeMap[char]) {
        const phonemeData = phonemeMap[char];
        shape = phonemeData.shape;
        duration = phonemeData.duration;
      } else {
        // Unknown phoneme - slight mouth movement
        shape = 0.2;
        duration = 50;
      }
    } else if (phonemeMap[char]) {
      const phonemeData = phonemeMap[char];
      shape = phonemeData.shape;
      duration = phonemeData.duration;
    } else {
      shape = 0.2;
      duration = 50;
    }

    // Skip spaces and punctuation (treat as neutral)
    if (char === " " || /[.,!?;:]/.test(char)) {
      shape = 0;
      duration = 100;
    }

    sequence.push({
      phoneme,
      shape,
      duration,
      startTime: currentTime,
    });

    currentTime += duration;
    i++;
  }

  return sequence;
}

/**
 * Update lip-sync based on utterance progress
 * @param {string} text - The spoken text
 * @param {number} audioTime - Current playback time (0-1, where 1 = fully played)
 * @param {Object} state - Lip-sync state
 * @param {Function} onMouthShape - Callback for mouth shape updates
 */
export function updateLipSyncFromText(text, audioTime, state, onMouthShape) {
  const phonemeSequence = generatePhonemeSequence(text);
  const totalDuration = phonemeSequence.reduce((sum, p) => sum + p.duration, 0);
  const currentTime = audioTime * totalDuration;

  // Find current phoneme
  let currentPhoneme = null;
  for (const phoneme of phonemeSequence) {
    if (
      currentTime >= phoneme.startTime &&
      currentTime < phoneme.startTime + phoneme.duration
    ) {
      currentPhoneme = phoneme;
      break;
    }
  }

  if (currentPhoneme) {
    // Interpolate between resting and phoneme shape during duration
    const positionInPhoneme =
      (currentTime - currentPhoneme.startTime) / currentPhoneme.duration;

    // Use easing for smoother transitions
    const easedProgress = easeInOutQuad(Math.min(positionInPhoneme, 1));

    // Blend from previous shape to target shape
    const mouthShape = currentPhoneme.shape * (easedProgress * 0.8 + 0.2);

    state.currentPhoneme = currentPhoneme.phoneme;
    state.mouthOpenness = mouthShape;

    if (onMouthShape) {
      onMouthShape({
        mouthShape: mouthShape * 2 - 1, // Convert to -1 to 1 range
        phoneme: currentPhoneme.phoneme,
        intensity: easedProgress,
      });
    }
  }

  return state;
}

/**
 * Calculate mouth shape for continuous audio stream
 * Uses frequency analysis for real-time response
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {AnalyserNode} analyser - Audio analyser node
 * @returns {Function} Function that returns current mouth shape (0-1)
 */
export function createAudioAnalysisMouthShape(audioContext, analyser) {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  return () => {
    analyser.getByteFrequencyData(dataArray);

    // Analyze frequency bands
    const lowBand = dataArray.slice(0, dataArray.length / 4);
    const midBand = dataArray.slice(
      dataArray.length / 4,
      (dataArray.length / 4) * 3,
    );
    const highBand = dataArray.slice((dataArray.length / 4) * 3);

    const lowEnergy = lowBand.reduce((a, b) => a + b) / lowBand.length / 255;
    const midEnergy = midBand.reduce((a, b) => a + b) / midBand.length / 255;
    const highEnergy = highBand.reduce((a, b) => a + b) / highBand.length / 255;

    // Map energy to mouth opening
    // Vowels have more mid-low energy, consonants have more high energy
    const vowelScore = (lowEnergy * 0.4 + midEnergy * 0.6) * 0.8;

    // Return normalized mouth shape
    return Math.min(1, Math.max(0, vowelScore));
  };
}

/**
 * Create natural blink-and-mouth coordination
 * Eyes and mouth move together for realistic expression
 * @param {number} audioIntensity - Audio energy (0-1)
 * @returns {Object} Coordinated eye and mouth values
 */
export function getCoordinatedFacialMovement(
  mouthShape,
  audioIntensity,
  currentEmotion,
) {
  // More open mouth often correlates with wider eyes
  const mouthOpenness = mouthShape; // -1 to 1

  // Calculate eye opening based on mouth and emotion
  let eyeOpenness = 1.0;
  if (mouthOpenness > 0.5) {
    // Wide smile or O-shape = wider eyes
    eyeOpenness = 1.0 + mouthOpenness * 0.15;
  } else if (mouthOpenness < -0.5) {
    // Frown or closed mouth = slightly narrower eyes
    eyeOpenness = 1.0 - Math.abs(mouthOpenness) * 0.1;
  }

  // Audio intensity affects eyebrow height
  const eyebrowHeight = audioIntensity * 0.3 - 0.15;

  return {
    eyeOpenness: Math.max(0.5, Math.min(1.5, eyeOpenness)),
    mouthShape: mouthOpenness,
    eyebrowHeight,
    audioIntensity,
  };
}

/**
 * Smooth mouth transitions using cubic interpolation
 * @param {number} from - Starting mouth shape
 * @param {number} to - Target mouth shape
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated mouth shape
 */
export function smoothMouthTransition(from, to, t) {
  return from + (to - from) * easeInOutCubic(t);
}

/**
 * Ease-in-out-quad easing function
 */
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Ease-in-out-cubic easing function
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Language-specific phoneme adjustments
 * (Extensible for different languages)
 * @param {string} language - Language code (en, es, fr, etc.)
 * @returns {Object} Language-specific phoneme map adjustments
 */
export function getLanguagePhonemeMap(language = "en") {
  const baseMaps = {
    en: {
      // English-specific adjustments
      th: { shape: 0.2, duration: 70 },
    },
    es: {
      // Spanish-specific
      r: { shape: 0.4, duration: 100 },
      rr: { shape: 0.4, duration: 150 },
    },
    fr: {
      // French-specific
      r: { shape: 0.35, duration: 90 },
      u: { shape: 0.3, duration: 100 },
    },
  };

  return baseMaps[language] || baseMaps.en;
}

/* ─── React Hook ─────────────────────────────────────────────── */

import { useRef, useCallback } from "react";

/**
 * Phoneme → VRM mouth-shape expression map.
 * Values are weights for VRM standard mouth expressions: aa, ih, ou, ee, oh.
 */
const PHONEME_TO_VRM_MOUTH = {
  a: { aa: 0.8 },
  e: { ee: 0.7 },
  i: { ih: 0.6 },
  o: { oh: 0.7 },
  u: { ou: 0.6 },
  b: {},
  p: {},
  m: {},
  f: { ih: 0.3 },
  v: { ih: 0.3 },
  t: { ee: 0.2 },
  d: { ee: 0.2 },
  n: { aa: 0.2 },
  s: { ih: 0.2 },
  l: { aa: 0.3 },
  r: { oh: 0.3 },
  k: { aa: 0.1 },
  w: { ou: 0.5 },
  h: { aa: 0.4 },
  " ": {},
};

/**
 * useLipSync — React hook for frame-by-frame lip-sync driving VRM mouth expressions.
 *
 * Usage in useFrame:
 *   const overrides = lipSync.updateLipSync();
 *   expressionEngine.setOverrides(overrides);
 */
export function useLipSync() {
  const sequenceRef = useRef([]);
  const startTimeRef = useRef(0);
  const totalDurRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(1);

  const startLipSync = useCallback((text, rate = 1) => {
    if (!text) return;
    const seq = generatePhonemeSequence(text);
    sequenceRef.current = seq;
    totalDurRef.current = seq.reduce((s, p) => s + p.duration, 0);
    startTimeRef.current = performance.now();
    rateRef.current = rate;
    playingRef.current = true;
  }, []);

  const stopLipSync = useCallback(() => {
    playingRef.current = false;
    sequenceRef.current = [];
  }, []);

  /** Call every frame from useFrame. Returns VRM expression overrides object. */
  const updateLipSync = useCallback(() => {
    if (!playingRef.current || sequenceRef.current.length === 0) {
      return {};
    }

    const elapsed =
      (performance.now() - startTimeRef.current) * rateRef.current;
    const totalMs = totalDurRef.current;

    if (elapsed >= totalMs) {
      playingRef.current = false;
      return {};
    }

    // Find current phoneme
    let currentPhoneme = null;
    for (const p of sequenceRef.current) {
      if (elapsed >= p.startTime && elapsed < p.startTime + p.duration) {
        currentPhoneme = p;
        break;
      }
    }

    if (!currentPhoneme) return {};

    const posInPhoneme =
      (elapsed - currentPhoneme.startTime) / currentPhoneme.duration;
    const easedT = easeInOutQuad(Math.min(posInPhoneme, 1));

    // Map phoneme character → VRM mouth expressions
    const mapping =
      PHONEME_TO_VRM_MOUTH[currentPhoneme.phoneme] ||
      PHONEME_TO_VRM_MOUTH[currentPhoneme.phoneme[0]] ||
      {};

    const overrides = {};
    for (const [expr, weight] of Object.entries(mapping)) {
      overrides[expr] = weight * currentPhoneme.shape * (easedT * 0.8 + 0.2);
    }

    return overrides;
  }, []);

  return { startLipSync, stopLipSync, updateLipSync };
}
