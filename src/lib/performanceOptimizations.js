/**
 * Performance & Optimization Utilities
 * Includes caching, lazy loading, and rendering optimizations
 */

import { useRef, useCallback, useEffect } from "react";

/**
 * Voice File Cache
 * Stores synthesized speech audio in memory to avoid re-synthesis
 * Keyed by: `${voiceProfile}_${emotion}_${text.substr(0,50)}`
 */
class VoiceCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * Generate cache key from voice parameters
   */
  static generateKey(voiceProfile, emotion, text) {
    const textHash = text.substring(0, 50); // First 50 chars
    return `${voiceProfile}_${emotion}_${textHash}`;
  }

  /**
   * Get cached audio
   */
  get(voiceProfile, emotion, text) {
    const key = VoiceCache.generateKey(voiceProfile, emotion, text);
    if (this.cache.has(key)) {
      // Move to end (recently used)
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return null;
  }

  /**
   * Set cached audio
   */
  set(voiceProfile, emotion, text, audioData) {
    const key = VoiceCache.generateKey(voiceProfile, emotion, text);

    // Evict oldest if cache full (LRU)
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      this.cache.delete(oldest);
    }

    this.cache.set(key, audioData);
    this.accessOrder.push(key);
  }

  /**
   * Clear all cached audio
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size in MB (approximate)
   */
  getSize() {
    let bytes = 0;
    for (const audio of this.cache.values()) {
      if (audio && audio.byteLength) {
        bytes += audio.byteLength;
      }
    }
    return (bytes / (1024 * 1024)).toFixed(2);
  }
}

// Global voice cache instance
export const voiceCache = new VoiceCache(50);

/**
 * useVoiceCache Hook
 * Manages voice synthesis caching within components
 */
export function useVoiceCache() {
  return {
    getCached: (profile, emotion, text) =>
      voiceCache.get(profile, emotion, text),
    setCached: (profile, emotion, text, audio) =>
      voiceCache.set(profile, emotion, text, audio),
    clearCache: () => voiceCache.clear(),
    getCacheSize: () => voiceCache.getSize(),
  };
}

/**
 * Emotion Update Debouncer
 * Throttles emotion state changes to max 1 per 300ms
 * Prevents flickering when rapid emotion changes occur
 */
class EmotionDebouncer {
  constructor(delayMs = 300) {
    this.delay = delayMs;
    this.lastUpdate = 0;
    this.pendingEmotion = null;
    this.timeoutId = null;
  }

  /**
   * Queue an emotion update
   */
  updateEmotion(emotion, callback) {
    this.pendingEmotion = emotion;
    const now = Date.now();

    // If enough time has passed, update immediately
    if (now - this.lastUpdate >= this.delay) {
      this.lastUpdate = now;
      callback(emotion);
      this.clearPending();
      return;
    }

    // Otherwise queue update
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const waitTime = this.delay - (now - this.lastUpdate);
    this.timeoutId = setTimeout(() => {
      if (this.pendingEmotion) {
        this.lastUpdate = Date.now();
        callback(this.pendingEmotion);
        this.clearPending();
      }
    }, waitTime);
  }

  /**
   * Clear pending updates
   */
  clearPending() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.pendingEmotion = null;
    this.timeoutId = null;
  }
}

// Global emotion debouncer instance
const emotionDebouncer = new EmotionDebouncer(300);

/**
 * useEmotionDebouncer Hook
 * Debounce emotion updates within component
 */
export function useEmotionDebouncer(delayMs = 300) {
  const debouncerRef = useRef(new EmotionDebouncer(delayMs));

  return {
    updateEmotion: (emotion, callback) =>
      debouncerRef.current.updateEmotion(emotion, callback),
    clear: () => debouncerRef.current.clearPending(),
  };
}

/**
 * Canvas Rendering Optimizer
 * Implements efficient requestAnimationFrame usage
 */
export function useOptimizedCanvasRendering(canvasRef, renderFunction) {
  const animationFrameRef = useRef(null);
  const isRenderingRef = useRef(false);

  // Schedule render using requestAnimationFrame
  const scheduleRender = useCallback(() => {
    if (isRenderingRef.current) return; // Already scheduled

    isRenderingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(() => {
      if (canvasRef?.current && renderFunction) {
        renderFunction(canvasRef.current);
      }
      isRenderingRef.current = false;
    });
  }, [canvasRef, renderFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return scheduleRender;
}

/**
 * Lazy Load Image
 * Loads images only when needed (intersection observer)
 */
const lazyImageCache = new Set();

export function lazyLoadImage(src, onLoad, onError) {
  // Check if already loaded
  if (lazyImageCache.has(src)) {
    const img = new Image();
    img.src = src;
    onLoad(img);
    return;
  }

  // Load image
  const img = new Image();

  img.onload = () => {
    lazyImageCache.add(src);
    onLoad(img);
  };

  img.onerror = () => {
    if (onError) onError(new Error(`Failed to load image: ${src}`));
  };

  img.src = src;
}

/**
 * useLazyImage Hook
 * Lazy load image with IntersectionObserver
 */
export function useLazyImage(ref, src) {
  useEffect(() => {
    if (!ref?.current || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          lazyLoadImage(src, (img) => {
            if (ref.current) {
              ref.current.src = img.src;
              observer.unobserve(ref.current);
            }
          });
        }
      },
      { rootMargin: "50px" },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, src]);
}

/**
 * Background Lazy Loading
 * Lazy load background components only when visible
 */
export function shouldLoadBackground(backgroundId, currentBackground) {
  // Always load current and adjacent backgrounds
  const backgrounds = ["living_room", "office", "garden", "abstract", "space"];
  const currentIndex = backgrounds.indexOf(currentBackground);
  const targetIndex = backgrounds.indexOf(backgroundId);

  return Math.abs(currentIndex - targetIndex) <= 1;
}

/**
 * Performance Monitor
 * Tracks rendering performance metrics
 */
export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.renderTimes = [];
  }

  /**
   * Record frame render time
   */
  recordFrame(renderTime) {
    this.renderTimes.push(renderTime);

    // Keep last 60 measurements
    if (this.renderTimes.length > 60) {
      this.renderTimes.shift();
    }

    this.frameCount++;

    // Update FPS every 30 frames
    if (this.frameCount % 30 === 0) {
      const now = performance.now();
      const elapsed = now - this.lastTime;
      this.fps = (30 / elapsed) * 1000;
      this.lastTime = now;
    }
  }

  /**
   * Get average render time
   */
  getAverageRenderTime() {
    if (this.renderTimes.length === 0) return 0;
    const sum = this.renderTimes.reduce((a, b) => a + b, 0);
    return sum / this.renderTimes.length;
  }

  /**
   * Get current FPS
   */
  getCurrentFPS() {
    return Math.round(this.fps);
  }

  /**
   * Check if performance acceptable (>30 FPS)
   */
  isPerformanceAcceptable() {
    return this.fps >= 30;
  }
}

// Global performance monitor
export const performanceMonitor = new PerformanceMonitor();

/**
 * usePerformanceMonitor Hook
 * Monitor rendering performance in components
 */
export function usePerformanceMonitor() {
  const startTimeRef = useRef(null);

  const markStart = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const markEnd = useCallback(() => {
    if (startTimeRef.current) {
      const renderTime = performance.now() - startTimeRef.current;
      performanceMonitor.recordFrame(renderTime);
    }
  }, []);

  return {
    markStart,
    markEnd,
    getMetrics: () => ({
      fps: performanceMonitor.getCurrentFPS(),
      avgRenderTime: performanceMonitor.getAverageRenderTime(),
      isAcceptable: performanceMonitor.isPerformanceAcceptable(),
    }),
  };
}

export default {
  VoiceCache,
  EmotionDebouncer,
  voiceCache,
  useVoiceCache,
  useEmotionDebouncer,
  useOptimizedCanvasRendering,
  lazyLoadImage,
  useLazyImage,
  shouldLoadBackground,
  PerformanceMonitor,
  performanceMonitor,
  usePerformanceMonitor,
};
