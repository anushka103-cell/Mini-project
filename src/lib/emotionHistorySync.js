"use client";

/**
 * Emotion History Sync
 * Tracks emotion changes over time locally and syncs with backend
 * Calculates trends, volatility, patterns, and mental health metrics
 */

export class EmotionHistorySync {
  constructor(maxHistorySize = 1000) {
    this.maxHistorySize = maxHistorySize;
    this.history = [];
    this.trends = {
      current: null,
      direction: "stable", // improving, declining, stable
      volatility: 0,
      dominantEmotion: null,
    };

    // Load from localStorage on init
    this.loadFromStorage();
  }

  /**
   * Add emotion record to history
   * @param {Object} emotionData - { emotion, valence, arousal, timestamp, context, note }
   */
  addEmotion(emotionData) {
    const record = {
      ...emotionData,
      timestamp: emotionData.timestamp || new Date().toISOString(),
      id: `emotion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.history.unshift(record); // Add to beginning

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    // Recalculate trends
    this.calculateTrends();

    // Save to localStorage
    this.saveToStorage();

    return record;
  }

  /**
   * Calculate emotion trends over time
   */
  calculateTrends() {
    if (this.history.length === 0) return;

    const recentCount = Math.min(10, this.history.length); // Last 10 entries
    const recent = this.history.slice(0, recentCount);

    // Current emotion (most recent)
    this.trends.current = recent[0];

    // Direction: comparing first half vs second half of recent history
    if (recent.length >= 4) {
      const firstHalf = recent.slice(Math.ceil(recent.length / 2));
      const secondHalf = recent.slice(0, Math.floor(recent.length / 2));

      const avgValenceNew = this.averageValence(secondHalf);
      const avgValenceOld = this.averageValence(firstHalf);

      const threshold = 0.15;

      if (avgValenceNew > avgValenceOld + threshold) {
        this.trends.direction = "improving";
      } else if (avgValenceNew < avgValenceOld - threshold) {
        this.trends.direction = "declining";
      } else {
        this.trends.direction = "stable";
      }
    }

    // Volatility: standard deviation of valence
    this.trends.volatility = this.calculateVolatility(recent);

    // Dominant emotion
    this.trends.dominantEmotion = this.findDominantEmotion(recent);
  }

  /**
   * Calculate average valence
   */
  averageValence(emotionRecords) {
    if (emotionRecords.length === 0) return 0;

    const sum = emotionRecords.reduce((acc, record) => {
      return acc + (record.valence || 0);
    }, 0);

    return sum / emotionRecords.length;
  }

  /**
   * Calculate volatility (standard deviation of valence)
   */
  calculateVolatility(emotionRecords) {
    if (emotionRecords.length < 2) return 0;

    const mean = this.averageValence(emotionRecords);
    const variance =
      emotionRecords.reduce((acc, record) => {
        const diff = (record.valence || 0) - mean;
        return acc + diff * diff;
      }, 0) / emotionRecords.length;

    return Math.sqrt(variance);
  }

  /**
   * Find most common emotion in records
   */
  findDominantEmotion(emotionRecords) {
    if (emotionRecords.length === 0) return null;

    const emotionCounts = {};

    for (const record of emotionRecords) {
      const emotion = record.emotion || "unknown";
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    }

    // Find emotion with highest count
    let dominant = null;
    let maxCount = 0;

    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = emotion;
      }
    }

    return {
      emotion: dominant,
      frequency: maxCount,
      percentage: (maxCount / emotionRecords.length) * 100,
    };
  }

  /**
   * Get emotion distribution (pie chart data)
   */
  getEmotionDistribution(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return new Date(record.timestamp) >= cutoff;
    });

    const distribution = {};

    for (const record of filtered) {
      const emotion = record.emotion || "unknown";
      distribution[emotion] = (distribution[emotion] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get average valence for time period
   */
  getAverageValence(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return new Date(record.timestamp) >= cutoff;
    });

    return this.averageValence(filtered);
  }

  /**
   * Get average arousal for time period
   */
  getAverageArousal(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return new Date(record.timestamp) >= cutoff;
    });

    if (filtered.length === 0) return 0;

    const sum = filtered.reduce((acc, record) => {
      return acc + (record.arousal || 0);
    }, 0);

    return sum / filtered.length;
  }

  /**
   * Calculate mental health score (0-100)
   * Based on recent valence, stability, and diversity
   */
  getMentalHealthScore(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return new Date(record.timestamp) >= cutoff;
    });

    if (filtered.length === 0) return 50; // Neutral

    // Component 1: Valence score (positive is better)
    const avgValence = this.averageValence(filtered);
    const valenceScore = ((avgValence + 1) / 2) * 50; // 0-50

    // Component 2: Stability score (low volatility is better)
    const volatility = this.calculateVolatility(filtered);
    const stabilityScore = Math.max(0, 50 - volatility * 50); // 0-50

    const totalScore = valenceScore + stabilityScore;

    return Math.round(Math.min(100, Math.max(0, totalScore)));
  }

  /**
   * Get peak emotional time of day
   */
  getPeakEmotionalTime(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return new Date(record.timestamp) >= cutoff;
    });

    const hourBuckets = {};

    for (const record of filtered) {
      const hour = new Date(record.timestamp).getHours();
      if (!hourBuckets[hour]) {
        hourBuckets[hour] = { count: 0, totalValence: 0 };
      }
      hourBuckets[hour].count++;
      hourBuckets[hour].totalValence += record.valence || 0;
    }

    // Find hour with highest average valence
    let peakHour = 0;
    let peakValence = -2;

    for (const [hour, data] of Object.entries(hourBuckets)) {
      const avgValence = data.totalValence / data.count;
      if (avgValence > peakValence) {
        peakValence = avgValence;
        peakHour = parseInt(hour);
      }
    }

    return { hour: peakHour, valence: peakValence };
  }

  /**
   * Identify emotion triggers
   * Based on context and emotion co-occurrence
   */
  getEmotionTriggers(emotion, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return record.emotion === emotion && new Date(record.timestamp) >= cutoff;
    });

    const triggers = {};

    for (const record of filtered) {
      if (record.context && record.context.trigger) {
        const trigger = record.context.trigger;
        triggers[trigger] = (triggers[trigger] || 0) + 1;
      }
    }

    // Sort by frequency
    return Object.entries(triggers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5); // Top 5
  }

  /**
   * Calculate coping strategy effectiveness
   * Track emotions before/after using coping strategies
   */
  getCopingStrategyEffectiveness(strategy, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = this.history.filter((record) => {
      return (
        record.context &&
        record.context.copingStrategy === strategy &&
        new Date(record.timestamp) >= cutoff
      );
    });

    if (filtered.length === 0) return null;

    // Calculate average valence change
    const changes = [];

    for (let i = 1; i < filtered.length; i++) {
      const before = filtered[i];
      const after = filtered[i - 1];

      if (before.valence !== undefined && after.valence !== undefined) {
        const change = after.valence - before.valence;
        changes.push(change);
      }
    }

    if (changes.length === 0) return null;

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const effectiveness = ((avgChange + 1) / 2) * 100; // Convert to 0-100 scale

    return {
      strategy,
      effectiveness: Math.round(effectiveness),
      usageCount: filtered.length,
      averageValenceChange: avgChange.toFixed(2),
    };
  }

  /**
   * Get weekly summary
   */
  getWeeklySummary() {
    const weekly = {};

    for (let d = 6; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split("T")[0];

      const dayRecords = this.history.filter((record) => {
        return record.timestamp.startsWith(dateStr);
      });

      weekly[dateStr] = {
        count: dayRecords.length,
        avgValence: this.averageValence(dayRecords),
        avgArousal: dayRecords.length
          ? dayRecords.reduce((acc, r) => acc + (r.arousal || 0), 0) /
            dayRecords.length
          : 0,
        dominantEmotion: this.findDominantEmotion(dayRecords),
      };
    }

    return weekly;
  }

  /**
   * Get full trends object
   */
  getTrends() {
    return { ...this.trends };
  }

  /**
   * Get recent history (last N records)
   */
  getRecentHistory(limit = 20) {
    return this.history.slice(0, limit);
  }

  /**
   * Get all history
   */
  getAllHistory() {
    return [...this.history];
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    this.calculateTrends();
    this.saveToStorage();
  }

  /**
   * Local storage methods
   */

  saveToStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "avatarEmotionHistory",
          JSON.stringify({
            history: this.history,
            trends: this.trends,
          }),
        );
      }
    } catch (error) {
      console.warn("Failed to save emotion history to storage:", error);
    }
  }

  loadFromStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("avatarEmotionHistory");
        if (stored) {
          const data = JSON.parse(stored);
          this.history = data.history || [];
          this.trends = data.trends || this.trends;
        }
      }
    } catch (error) {
      console.warn("Failed to load emotion history from storage:", error);
    }
  }

  /**
   * Export history as JSON
   */
  exportAsJSON() {
    return JSON.stringify({
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      history: this.history,
      trends: this.trends,
    });
  }

  /**
   * Import history from JSON
   */
  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.history = data.history || [];
      this.calculateTrends();
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error("Failed to import emotion history:", error);
      return false;
    }
  }
}

// Export singleton instance
const emotionHistorySync = new EmotionHistorySync();

export default emotionHistorySync;
