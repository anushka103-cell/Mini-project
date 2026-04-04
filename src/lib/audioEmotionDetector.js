"use client";

/**
 * Audio Emotion Detector
 * Analyzes audio for emotion detection from speech tone and characteristics
 */

// ==================== FREQUENCY RANGES ====================

const FREQUENCY_BANDS = {
  very_low: { min: 0, max: 250, description: "Sub-bass" },
  low: { min: 250, max: 500, description: "Bass" },
  low_mid: { min: 500, max: 2000, description: "Low-mid" },
  mid: { min: 2000, max: 4000, description: "Mid" },
  high_mid: { min: 4000, max: 8000, description: "High-mid" },
  high: { min: 8000, max: 16000, description: "High" },
};

// ==================== EMOTION AUDIO SIGNATURES ====================

/**
 * Audio characteristics for different emotions
 */
const EMOTION_SIGNATURES = {
  happy: {
    frequencyProfile: "high_energy",
    pitchRange: "wide",
    energyLevel: "high",
    tempo: "fast",
    voiceQuality: "clear",
  },
  sad: {
    frequencyProfile: "low_energy",
    pitchRange: "narrow",
    energyLevel: "low",
    tempo: "slow",
    voiceQuality: "breathy",
  },
  calm: {
    frequencyProfile: "balanced",
    pitchRange: "medium",
    energyLevel: "medium",
    tempo: "slow",
    voiceQuality: "smooth",
  },
  anxious: {
    frequencyProfile: "high_energy",
    pitchRange: "very_wide",
    energyLevel: "high",
    tempo: "fast",
    voiceQuality: "tense",
  },
  angry: {
    frequencyProfile: "sharp",
    pitchRange: "wide",
    energyLevel: "very_high",
    tempo: "very_fast",
    voiceQuality: "harsh",
  },
  neutral: {
    frequencyProfile: "balanced",
    pitchRange: "medium",
    energyLevel: "medium",
    tempo: "normal",
    voiceQuality: "clear",
  },
  confident: {
    frequencyProfile: "balanced",
    pitchRange: "stable",
    energyLevel: "high",
    tempo: "moderate",
    voiceQuality: "resonant",
  },
};

// ==================== AUDIO ANALYZER ====================

export class AudioEmotionDetector {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isRecording = false;
    this.confidenceThreshold = 0.6;
    this.emotionHistory = [];
    this.listeners = {
      emotion: [],
      confidence: [],
      error: [],
    };
  }

  /**
   * Initialize audio context and analyzer
   */
  async initialize() {
    try {
      const audioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioContext) {
        throw new Error("AudioContext not supported");
      }

      this.audioContext = new audioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      return true;
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      this._emit("error", { error: error.message });
      return false;
    }
  }

  /**
   * Start recording and analyzing audio
   */
  async startRecording() {
    try {
      if (!this.audioContext) {
        await this.initialize();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      this.isRecording = true;
      this._analyzeAudioStream();
      return true;
    } catch (error) {
      console.error("Failed to start recording:", error);
      this._emit("error", { error: error.message });
      return false;
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    this.isRecording = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    return true;
  }

  /**
   * Analyze audio stream continuously
   */
  _analyzeAudioStream() {
    if (!this.isRecording) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate features
    const features = this._extractAudioFeatures(dataArray);

    // Detect emotion
    const emotion = this._detectEmotion(features);

    // Store in history
    this.emotionHistory.push({
      emotion,
      confidence: emotion.confidence,
      timestamp: Date.now(),
      features,
    });

    // Keep history limited
    if (this.emotionHistory.length > 100) {
      this.emotionHistory.shift();
    }

    // Emit emotion
    this._emit("emotion", emotion);

    // Continue analyzing
    requestAnimationFrame(() => this._analyzeAudioStream());
  }

  /**
   * Extract audio features from frequency data
   */
  _extractAudioFeatures(dataArray) {
    const features = {
      totalEnergy: 0,
      energyByBand: {},
      spectralCentroid: 0,
      zerocrossingRate: 0,
      dynamicRange: 0,
    };

    // Calculate total energy and energy by band
    for (let i = 0; i < dataArray.length; i++) {
      features.totalEnergy += dataArray[i];
    }
    features.totalEnergy /= dataArray.length;

    // Energy in frequency bands
    const bandEntries = Object.entries(FREQUENCY_BANDS);
    for (const [bandName, bandRange] of bandEntries) {
      let bandEnergy = 0;
      const startBin = Math.floor((bandRange.min * dataArray.length) / 22050);
      const endBin = Math.floor((bandRange.max * dataArray.length) / 22050);

      for (let i = startBin; i < endBin && i < dataArray.length; i++) {
        bandEnergy += dataArray[i];
      }
      features.energyByBand[bandName] = bandEnergy / (endBin - startBin);
    }

    // Spectral centroid (frequency distribution)
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const frequency = (i * 22050) / dataArray.length;
      numerator += frequency * dataArray[i];
      denominator += dataArray[i];
    }
    features.spectralCentroid = denominator > 0 ? numerator / denominator : 0;

    // Dynamic range
    const maxEnergy = Math.max(...dataArray);
    const minEnergy = Math.min(...dataArray);
    features.dynamicRange = maxEnergy - minEnergy;

    return features;
  }

  /**
   * Detect emotion from audio features
   */
  _detectEmotion(features) {
    const scores = {};

    // Calculate emotion scores
    for (const [emotion, signature] of Object.entries(EMOTION_SIGNATURES)) {
      scores[emotion] = this._calculateEmotionScore(features, signature);
    }

    // Find highest score
    const emotions = Object.entries(scores).sort(([_, a], [__, b]) => b - a);
    const [detectedEmotion, confidence] = emotions[0];

    return {
      emotion: detectedEmotion,
      confidence: Math.min(1, Math.max(0, confidence)),
      topEmotions: emotions.slice(0, 3).map(([e, s]) => ({
        emotion: e,
        score: s,
      })),
      features,
    };
  }

  /**
   * Calculate emotion score based on audio features
   */
  _calculateEmotionScore(features, signature) {
    let score = 0;
    let weights = 0;

    // Energy level assessment
    const energyScore = this._scoreEnergyLevel(features, signature);
    score += energyScore * 0.25;
    weights += 0.25;

    // Frequency profile assessment
    const frequencyScore = this._scoreFrequencyProfile(features, signature);
    score += frequencyScore * 0.3;
    weights += 0.3;

    // Dynamic range assessment
    const dynamicScore = this._scoreDynamicRange(features, signature);
    score += dynamicScore * 0.2;
    weights += 0.2;

    // Spectral centroid assessment
    const spectralScore = this._scoreSpectralCharacteristics(
      features,
      signature,
    );
    score += spectralScore * 0.25;
    weights += 0.25;

    return weights > 0 ? score / weights : 0;
  }

  /**
   * Score energy level match
   */
  _scoreEnergyLevel(features, signature) {
    const energyLevel = features.totalEnergy / 128;

    const energyLevelMap = {
      very_high: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3,
    };

    const signatureEnergy = energyLevelMap[signature.energyLevel] || 0.5;
    return 1 - Math.abs(energyLevel - signatureEnergy);
  }

  /**
   * Score frequency profile match
   */
  _scoreFrequencyProfile(features, signature) {
    const highMidEnergy = features.energyByBand.high_mid || 0;
    const lowEnergy = features.energyByBand.low || 0;

    switch (signature.frequencyProfile) {
      case "high_energy":
        return highMidEnergy / 256;
      case "low_energy":
        return lowEnergy / 256;
      case "sharp":
        return (highMidEnergy + features.energyByBand.high) / 512;
      case "balanced":
        const mid = features.energyByBand.mid || 128;
        return mid / 256;
      default:
        return 0.5;
    }
  }

  /**
   * Score dynamic range match
   */
  _scoreDynamicRange(features, signature) {
    const dynamicRatio = features.dynamicRange / 255;

    switch (signature.frequencyProfile) {
      case "sharp":
      case "high_energy":
        return dynamicRatio; // High dynamic range desired
      case "low_energy":
        return 1 - dynamicRatio; // Low dynamic range desired
      default:
        return dynamicRatio * 0.7 + 0.3; // Moderate
    }
  }

  /**
   * Score spectral characteristics
   */
  _scoreSpectralCharacteristics(features, signature) {
    const centroid = features.spectralCentroid / 8000; // Normalize to 0-1

    switch (signature.voiceQuality) {
      case "clear":
      case "bright":
        return centroid; // Prefer higher frequencies
      case "breathy":
      case "dull":
        return 1 - centroid; // Prefer lower frequencies
      case "resonant":
      case "smooth":
        return 1 - Math.abs(centroid - 0.5) * 2; // Prefer mid frequencies
      default:
        return centroid;
    }
  }

  /**
   * Get emotion trend from history
   */
  getEmotionTrend(windowSize = 10) {
    if (this.emotionHistory.length < windowSize) {
      return null;
    }

    const recentHistory = this.emotionHistory.slice(-windowSize);
    const emotionCounts = {};

    recentHistory.forEach((entry) => {
      emotionCounts[entry.emotion] =
        (emotionCounts[entry.emotion] || 0) + entry.confidence;
    });

    return emotionCounts;
  }

  /**
   * Get dominant emotion from history
   */
  getDominantEmotion(windowSize = 10) {
    const trend = this.getEmotionTrend(windowSize);
    if (!trend) return null;

    const dominantEmotion = Object.entries(trend).sort(([_, a], [__, b]) =>
      b - a ? [0][0] : null,
    );

    return {
      emotion: dominantEmotion[0],
      confidence: dominantEmotion[1] / windowSize,
    };
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
   * Emit event
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  /**
   * Get detection state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      historySize: this.emotionHistory.length,
      lastDetection:
        this.emotionHistory.length > 0
          ? this.emotionHistory[this.emotionHistory.length - 1]
          : null,
      trend: this.getEmotionTrend(),
    };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.emotionHistory = [];
  }

  /**
   * Get full history
   */
  getHistory() {
    return JSON.parse(JSON.stringify(this.emotionHistory));
  }
}

// ==================== SINGLETON INSTANCE ====================

let detectorInstance = null;

export function getAudioEmotionDetector() {
  if (!detectorInstance) {
    detectorInstance = new AudioEmotionDetector();
  }
  return detectorInstance;
}

export default getAudioEmotionDetector;
