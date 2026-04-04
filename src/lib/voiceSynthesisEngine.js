"use client";

/**
 * Voice Synthesis Engine
 * Advanced text-to-speech with emotion awareness, rate control, and prosody
 * Includes integrated voice caching for performance optimization
 */

import { voiceCache } from "./performanceOptimizations";

// ==================== VOICE PROFILES ====================

export const VOICE_PROFILES = {
  ana_calm: {
    id: "ana_calm",
    name: "Ana (Calm)",
    pitch: 1.0,
    rate: 0.9,
    emotion: "calm",
    gender: "female",
    characteristics: "Relaxed, soothing tone",
  },
  ana_friendly: {
    id: "ana_friendly",
    name: "Ana (Friendly)",
    pitch: 1.1,
    rate: 1.0,
    emotion: "happy",
    gender: "female",
    characteristics: "Warm, approachable tone",
  },
  ana_energetic: {
    id: "ana_energetic",
    name: "Ana (Energetic)",
    pitch: 1.2,
    rate: 1.1,
    emotion: "excited",
    gender: "female",
    characteristics: "Upbeat, enthusiastic tone",
  },
  alex_calm: {
    id: "alex_calm",
    name: "Alex (Calm)",
    pitch: 0.9,
    rate: 0.9,
    emotion: "calm",
    gender: "male",
    characteristics: "Deep, steady tone",
  },
  alex_friendly: {
    id: "alex_friendly",
    name: "Alex (Friendly)",
    pitch: 1.0,
    rate: 1.0,
    emotion: "happy",
    gender: "male",
    characteristics: "Warm, genial tone",
  },
  alex_energetic: {
    id: "alex_energetic",
    name: "Alex (Energetic)",
    pitch: 1.1,
    rate: 1.15,
    emotion: "excited",
    gender: "male",
    characteristics: "Energetic, dynamic tone",
  },
  casey_calm: {
    id: "casey_calm",
    name: "Casey (Calm)",
    pitch: 1.0,
    rate: 0.85,
    emotion: "calm",
    gender: "non-binary",
    characteristics: "Neutral, balanced tone",
  },
  casey_friendly: {
    id: "casey_friendly",
    name: "Casey (Friendly)",
    pitch: 1.05,
    rate: 0.95,
    emotion: "happy",
    gender: "non-binary",
    characteristics: "Pleasant, friendly tone",
  },
};

// ==================== EMOTION PROSODY MAPS ====================

/**
 * Prosody adjustments based on emotion
 * Controls: pitch, rate, emphasis
 */
export const EMOTION_PROSODY = {
  happy: {
    pitchMultiplier: 1.15,
    rateMultiplier: 1.1,
    emphasis: "strong",
    breathingPauses: true,
  },
  sad: {
    pitchMultiplier: 0.85,
    rateMultiplier: 0.8,
    emphasis: "soft",
    breathingPauses: true,
  },
  calm: {
    pitchMultiplier: 1.0,
    rateMultiplier: 0.85,
    emphasis: "gentle",
    breathingPauses: true,
  },
  anxious: {
    pitchMultiplier: 1.2,
    rateMultiplier: 1.2,
    emphasis: "strong",
    breathingPauses: false,
  },
  excited: {
    pitchMultiplier: 1.25,
    rateMultiplier: 1.3,
    emphasis: "very-strong",
    breathingPauses: true,
  },
  neutral: {
    pitchMultiplier: 1.0,
    rateMultiplier: 1.0,
    emphasis: "normal",
    breathingPauses: true,
  },
  confident: {
    pitchMultiplier: 0.95,
    rateMultiplier: 0.95,
    emphasis: "strong",
    breathingPauses: true,
  },
  uncertain: {
    pitchMultiplier: 1.05,
    rateMultiplier: 0.9,
    emphasis: "soft",
    breathingPauses: true,
  },
  supportive: {
    pitchMultiplier: 1.0,
    rateMultiplier: 0.9,
    emphasis: "gentle",
    breathingPauses: true,
  },
  curious: {
    pitchMultiplier: 1.1,
    rateMultiplier: 1.05,
    emphasis: "normal",
    breathingPauses: true,
  },
};

// ==================== TTS ENGINE ====================

export class VoiceSynthesisEngine {
  constructor() {
    this.synth =
      typeof window !== "undefined" ? window.speechSynthesis || null : null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.currentVoice = VOICE_PROFILES.ana_friendly;
    this.currentEmotion = "neutral";
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.voicesLoaded = false;
    this.cachedVoices = [];
    this.listeners = {
      start: [],
      end: [],
      pause: [],
      resume: [],
      error: [],
    };

    // Pre-load voices — Chrome loads them asynchronously
    if (this.synth) {
      this.cachedVoices = this.synth.getVoices();
      if (this.cachedVoices.length > 0) {
        this.voicesLoaded = true;
      }
      this.synth.addEventListener("voiceschanged", () => {
        this.cachedVoices = this.synth.getVoices();
        this.voicesLoaded = true;
      });
    }
  }

  /**
   * Check if speech synthesis is available
   */
  isAvailable() {
    return this.synth !== null;
  }

  /**
   * Get available voices
   */
  getAvailableVoices() {
    if (!this.synth) return [];
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    this.cachedVoices = this.synth.getVoices();
    return this.cachedVoices;
  }

  /**
   * Set voice profile
   */
  setVoiceProfile(profileId) {
    const profile = VOICE_PROFILES[profileId];
    if (!profile) {
      console.warn(`Voice profile not found: ${profileId}`);
      return false;
    }
    this.currentVoice = profile;
    this.rate = profile.rate;
    this.pitch = profile.pitch;
    return true;
  }

  /**
   * Set emotion for prosody adjustment
   */
  setEmotion(emotion) {
    if (EMOTION_PROSODY[emotion]) {
      this.currentEmotion = emotion;
      return true;
    }
    console.warn(`Emotion not found: ${emotion}`);
    return false;
  }

  /**
   * Set speech rate (0.5 - 2.0)
   */
  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
    return this.rate;
  }

  /**
   * Set pitch (0.5 - 2.0)
   */
  setPitch(pitch) {
    this.pitch = Math.max(0.5, Math.min(2.0, pitch));
    return this.pitch;
  }

  /**
   * Set volume (0 - 1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    return this.volume;
  }

  /**
   * Get calculated prosody for current emotion
   */
  getEmotionalProsody() {
    const prosody =
      EMOTION_PROSODY[this.currentEmotion] || EMOTION_PROSODY.neutral;
    return {
      rate: this.rate * prosody.rateMultiplier,
      pitch: this.pitch * prosody.pitchMultiplier,
      emphasis: prosody.emphasis,
    };
  }

  /**
   * Wait for voices to be available (Chrome loads them async)
   */
  _waitForVoices(timeout = 3000) {
    if (this.cachedVoices.length > 0) return Promise.resolve(this.cachedVoices);
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const voices = this.synth.getVoices();
        if (voices.length > 0) {
          this.cachedVoices = voices;
          this.voicesLoaded = true;
          resolve(voices);
        } else if (Date.now() - start > timeout) {
          resolve([]);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * Pick the best voice from available system voices
   */
  _pickVoice(voices) {
    if (!voices || voices.length === 0) return null;
    const profileGender = this.currentVoice.gender;
    const englishVoices = voices.filter(
      (v) => v.lang && v.lang.startsWith("en"),
    );
    const pool = englishVoices.length > 0 ? englishVoices : voices;
    const genderMatch = pool.find((v) => {
      const name = v.name.toLowerCase();
      if (profileGender === "female")
        return (
          name.includes("female") ||
          name.includes("zira") ||
          name.includes("samantha") ||
          name.includes("karen")
        );
      if (profileGender === "male")
        return (
          name.includes("male") ||
          name.includes("david") ||
          name.includes("mark") ||
          name.includes("daniel")
        );
      return false;
    });
    return genderMatch || pool[0];
  }

  /**
   * Speak text with emotion awareness
   */
  async speak(text, options = {}) {
    if (!this.synth) {
      console.error("Speech synthesis not available");
      return false;
    }

    // Check voice cache first (if enabled)
    if (options.useCache !== false) {
      const cached = voiceCache.get(
        this.currentVoice.id,
        this.currentEmotion,
        text,
      );

      if (cached) {
        console.log("[VoiceCache] Cache hit - playing cached audio");
        this._emit("cache-hit", { text });
      }
    }

    // Cancel any ongoing speech and wait a tick (Chrome bug workaround)
    if (this.isPlaying) {
      this.synth.cancel();
      this._clearKeepAlive();
      await new Promise((r) => setTimeout(r, 50));
    }

    // Ensure voices are loaded before speaking
    const voices = await this._waitForVoices();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Apply voice
    const voice = this._pickVoice(voices);
    if (voice) utterance.voice = voice;

    // Get emotional prosody
    const prosody = this.getEmotionalProsody();

    // Apply settings
    utterance.rate = prosody.rate;
    utterance.pitch = prosody.pitch;
    utterance.volume = this.volume;

    // Apply custom options
    if (options.rate) utterance.rate = options.rate;
    if (options.pitch) utterance.pitch = options.pitch;
    if (options.volume) utterance.volume = options.volume;

    // Set up event handlers
    utterance.onstart = () => {
      this.isPlaying = true;
      this._startKeepAlive();
      this._emit("start", { text });
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this._clearKeepAlive();
      this._emit("end", { text });

      // Cache synthesis for future use if enabled
      if (options.useCache !== false) {
        voiceCache.set(this.currentVoice.id, this.currentEmotion, text, {
          timestamp: Date.now(),
          settings: {
            rate: utterance.rate,
            pitch: utterance.pitch,
            volume: utterance.volume,
          },
        });
      }
    };

    utterance.onerror = (event) => {
      this.isPlaying = false;
      this._clearKeepAlive();
      this._emit("error", { error: event.error });
    };

    utterance.onpause = () => {
      this._emit("pause", {});
    };

    utterance.onresume = () => {
      this._emit("resume", {});
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    return true;
  }

  /**
   * Chrome workaround: long utterances silently stop after ~15s.
   * Periodically pause/resume to keep synthesis alive.
   */
  _startKeepAlive() {
    this._clearKeepAlive();
    this._keepAliveTimer = setInterval(() => {
      if (this.synth && this.isPlaying && this.synth.speaking) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10000);
  }

  _clearKeepAlive() {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
  }

  /**
   * Speak with emotion context
   */
  speakWithEmotion(text, emotion, options = {}) {
    this.setEmotion(emotion);
    return this.speak(text, options);
  }

  /**
   * Speak with voice profile
   */
  speakWithVoice(text, profileId, options = {}) {
    this.setVoiceProfile(profileId);
    return this.speak(text, options);
  }

  /**
   * Pause current speech
   */
  pause() {
    if (this.synth && this.isPlaying) {
      this.synth.pause();
      return true;
    }
    return false;
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      return true;
    }
    return false;
  }

  /**
   * Stop current speech
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isPlaying = false;
      this._clearKeepAlive();
      return true;
    }
    return false;
  }

  /**
   * Get current cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: voiceCache.getSize(),
      method: "memory",
      description: "In-memory LRU cache for voice synthesis",
    };
  }

  /**
   * Clear voice cache
   */
  clearCache() {
    voiceCache.clear();
    this._emit("cache-cleared", {});
    return true;
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
      return () => {
        this.listeners[event] = this.listeners[event].filter(
          (cb) => cb !== callback,
        );
      };
    }
  }

  /**
   * Emit event to listeners
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      voice: this.currentVoice,
      emotion: this.currentEmotion,
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      prosody: this.getEmotionalProsody(),
    };
  }

  /**
   * Get available voice profiles
   */
  getVoiceProfiles() {
    return Object.values(VOICE_PROFILES);
  }

  /**
   * Get available emotions
   */
  getAvailableEmotions() {
    return Object.keys(EMOTION_PROSODY);
  }

  /**
   * Generate speech benchmark (testing)
   */
  benchmark() {
    const testPhrases = [
      "Hello, I am happy",
      "I feel sad today",
      "Let us stay calm",
      "This is exciting",
      "I am uncertain",
    ];

    const emotions = ["happy", "sad", "calm", "excited", "uncertain"];

    return {
      testPhrases,
      emotions,
      supportedVoices: this.getVoiceProfiles().length,
      availableSystemVoices: this.getAvailableVoices().length,
    };
  }
}

// ==================== SINGLETON INSTANCE ====================

let engineInstance = null;

export function getVoiceSynthesisEngine() {
  if (!engineInstance) {
    engineInstance = new VoiceSynthesisEngine();
  }
  return engineInstance;
}

export default getVoiceSynthesisEngine;
