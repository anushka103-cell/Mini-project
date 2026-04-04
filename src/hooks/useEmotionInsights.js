"use client";

import { useCallback, useEffect, useState } from "react";
import {
  calculateMentalHealthScore,
  calculateEmotionTrend,
  calculateVolatility,
  getPeakEmotionalTimes,
  getEmotionTriggers,
  getCopingStrategyEffectiveness,
  generateWeeklySummary,
  generateMonthlySummary,
  getYearlyHealthTrend,
  getEmotionDistribution,
  getComparisonData,
  getPersonalizedRecommendations,
  getDominantEmotions,
} from "./emotionAnalytics";
import { emotionHistorySync } from "./emotionHistorySync";

/**
 * Hook for emotion insights and analytics
 * Aggregates and organizes emotional health data for dashboard display
 */
export function useEmotionInsights() {
  // State
  const [emotions, setEmotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Computed insights
  const [insights, setInsights] = useState({
    healthScore: 50,
    trend: "stable",
    volatility: 0.5,
    primaryEmotion: "neutral",
    emotionCount: 0,
  });

  const [reports, setReports] = useState({
    weekly: null,
    monthly: null,
    yearly: [],
  });

  const [analytics, setAnalytics] = useState({
    distribution: [],
    peakTimes: [],
    triggers: [],
    copingStrategies: [],
    comparisonData: [],
  });

  const [recommendations, setRecommendations] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Initialize
  useEffect(() => {
    loadEmotions();
  }, []);

  // Recalculate when emotions change
  useEffect(() => {
    if (emotions.length > 0) {
      calculateInsights();
      generateReports();
      calculateAnalytics();
      generateRecommendations();
    }
  }, [emotions, refreshKey]);

  // Load emotions from sync engine
  const loadEmotions = useCallback(async () => {
    try {
      setIsLoading(true);
      const allEmotions = emotionHistorySync.getAllEmotions();
      setEmotions(allEmotions || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load emotions:", error);
      setIsLoading(false);
    }
  }, []);

  // Calculate core insights
  const calculateInsights = useCallback(() => {
    const healthScore = calculateMentalHealthScore(emotions, 7);
    const trend = calculateEmotionTrend(emotions, 7);
    const volatility = calculateVolatility(emotions, 7);
    const dominantEmotions = getDominantEmotions(emotions, 1);
    const primaryEmotion = dominantEmotions[0]?.emotion || "neutral";

    setInsights({
      healthScore,
      trend,
      volatility,
      primaryEmotion,
      emotionCount: emotions.length,
      lastEmotion: emotions[emotions.length - 1] || null,
    });
  }, [emotions]);

  // Generate reports
  const generateReports = useCallback(() => {
    const weekly = generateWeeklySummary(emotions);
    const monthly = generateMonthlySummary(emotions);
    const yearly = getYearlyHealthTrend(emotions);

    setReports({
      weekly,
      monthly,
      yearly,
    });
  }, [emotions]);

  // Calculate analytics for visualizations
  const calculateAnalytics = useCallback(() => {
    const distribution = getEmotionDistribution(emotions, 30);
    const peakTimes = getPeakEmotionalTimes(emotions, 7);
    const triggers = getEmotionTriggers(emotions, 14);
    const copingStrategies = getCopingStrategyEffectiveness(emotions, 14);
    const comparisonData = getComparisonData(emotions, "valence", 7);

    setAnalytics({
      distribution,
      peakTimes,
      triggers,
      copingStrategies,
      comparisonData,
    });
  }, [emotions]);

  // Generate recommendations
  const generateRecommendations = useCallback(() => {
    const recs = getPersonalizedRecommendations(emotions);
    setRecommendations(recs);
  }, [emotions]);

  // Public methods

  /**
   * Refresh all insights (manual refresh)
   */
  const refresh = useCallback(async () => {
    await loadEmotions();
    setLastUpdated(new Date());
  }, [loadEmotions]);

  /**
   * Get health score with context
   */
  const getHealthScoreContext = useCallback(() => {
    const score = insights.healthScore;
    let level = "fair";
    let message =
      "Your emotional health is moderate. Consider self-care activities.";
    let color = "#FFE66D";

    if (score >= 85) {
      level = "excellent";
      message =
        "Your emotional health is excellent! Keep up these positive patterns.";
      color = "#52B788";
    } else if (score >= 70) {
      level = "good";
      message = "Your emotional health is good. Continue with healthy habits.";
      color = "#6BCB77";
    } else if (score < 40) {
      level = "poor";
      message =
        "Your emotional health needs attention. Reach out for support if needed.";
      color = "#E74C3C";
    }

    return { score: insights.healthScore, level, message, color };
  }, [insights.healthScore]);

  /**
   * Get trend analysis
   */
  const getTrendAnalysis = useCallback(() => {
    let emoji = "→";
    let message = "Your mood is stable.";
    let color = "#95E1D3";

    if (insights.trend === "improving") {
      emoji = "↑";
      message = "Your mood is improving! Keep it up.";
      color = "#52B788";
    } else if (insights.trend === "declining") {
      emoji = "↓";
      message = "Your mood has been declining. Consider reaching out.";
      color = "#E74C3C";
    } else if (insights.trend === "insufficient_data") {
      message = "Not enough data to determine trend.";
      emoji = "?";
      color = "#95E1D3";
    }

    return {
      trend: insights.trend,
      emoji,
      message,
      color,
    };
  }, [insights.trend]);

  /**
   * Get emotional stability analysis
   */
  const getStabilityAnalysis = useCallback(() => {
    const stability = insights.volatility;
    let level = "moderate";
    let message = "Your emotions are moderately stable.";
    let color = "#FFE66D";

    if (stability >= 0.8) {
      level = "very_stable";
      message =
        "Your emotions are very stable. Excellent emotional regulation!";
      color = "#52B788";
    } else if (stability >= 0.6) {
      level = "stable";
      message = "Your emotions are stable with occasional fluctuations.";
      color = "#6BCB77";
    } else if (stability < 0.4) {
      level = "volatile";
      message =
        "Your emotions are quite volatile. Consider grounding techniques.";
      color = "#E8A04C";
    }

    return {
      stability: Math.round(insights.volatility * 100),
      level,
      message,
      color,
    };
  }, [insights.volatility]);

  /**
   * Get primary triggers with coping strategies
   */
  const getTriggerAnalysis = useCallback(() => {
    if (analytics.triggers.length === 0) {
      return {
        hasTriggers: false,
        triggers: [],
        message: "No clear triggers identified yet. Keep tracking!",
      };
    }

    const topTriggers = analytics.triggers.slice(0, 3);
    const copingStrategies = analytics.copingStrategies;

    return {
      hasTriggers: true,
      triggers: topTriggers,
      strategies: copingStrategies,
      message: `Your primary trigger is: ${topTriggers[0].trigger}`,
    };
  }, [analytics.triggers, analytics.copingStrategies]);

  /**
   * Get emotional patterns
   */
  const getEmotionalPatterns = useCallback(() => {
    const patterns = [];

    // Add peak times pattern
    if (analytics.peakTimes.length > 0) {
      patterns.push({
        type: "peak_times",
        title: "Peak Emotional Times",
        description: `Most intense emotions occur around ${analytics.peakTimes[0].hour}:00`,
        data: analytics.peakTimes,
      });
    }

    // Add emotion distribution
    if (analytics.distribution.length > 0) {
      patterns.push({
        type: "emotion_distribution",
        title: "Emotion Distribution",
        description: `Primary emotion: ${analytics.distribution[0].name}`,
        data: analytics.distribution,
      });
    }

    // Add trend over time
    if (analytics.comparisonData.length > 0) {
      patterns.push({
        type: "valence_trend",
        title: "7-Day Valence Trend",
        description: "Your emotional state over the past week",
        data: analytics.comparisonData,
      });
    }

    return patterns;
  }, [analytics]);

  /**
   * Get weekly highlights
   */
  const getWeeklyHighlights = useCallback(() => {
    if (!reports.weekly) return [];
    return reports.weekly.highlights || [];
  }, [reports.weekly]);

  /**
   * Get monthly highlights
   */
  const getMonthlyHighlights = useCallback(() => {
    if (!reports.monthly) return [];
    return reports.monthly.highlights || [];
  }, [reports.monthly]);

  /**
   * Get health improvement suggestions
   */
  const getHealthSuggestions = useCallback(() => {
    const suggestions = [];

    // Based on volatility
    if (insights.volatility < 0.5) {
      suggestions.push({
        category: "Stability",
        title: "Practice Mindfulness",
        description:
          "Daily meditation or breathing exercises can help stabilize your emotions.",
        impact: "high",
      });
    }

    // Based on trend
    if (insights.trend === "declining") {
      suggestions.push({
        category: "Support",
        title: "Reach Out",
        description:
          "Connect with friends, family, or a professional counselor.",
        impact: "high",
      });
    }

    // Based on peak times
    if (analytics.peakTimes.length > 0 && analytics.peakTimes[0].hour >= 22) {
      suggestions.push({
        category: "Sleep",
        title: "Evening Routine",
        description:
          "Establish a relaxing bedtime routine to improve sleep quality.",
        impact: "medium",
      });
    }

    // Based on triggers
    if (analytics.triggers.length > 0) {
      suggestions.push({
        category: "Triggers",
        title: "Trigger Management",
        description: `Develop strategies to manage or avoid: ${analytics.triggers[0].trigger}`,
        impact: "high",
      });
    }

    // Based on effective coping
    if (analytics.copingStrategies.length > 0) {
      suggestions.push({
        category: "Positive Practices",
        title: `Use More: ${analytics.copingStrategies[0].strategy}`,
        description:
          "This coping strategy has been effective for you. Use it more often.",
        impact: "medium",
      });
    }

    return suggestions.slice(0, 5);
  }, [insights, analytics]);

  /**
   * Export data
   */
  const exportData = useCallback(() => {
    return {
      exported: new Date().toISOString(),
      insights,
      reports,
      analytics,
      recommendations,
      emotions: emotions.slice(-100), // Last 100 entries
    };
  }, [insights, reports, analytics, recommendations, emotions]);

  /**
   * Get summary statistics
   */
  const getSummaryStats = useCallback(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const todayEmotions = emotions.filter((e) => e.timestamp > dayAgo).length;
    const weekEmotions = emotions.filter((e) => e.timestamp > weekAgo).length;
    const monthEmotions = emotions.filter((e) => e.timestamp > monthAgo).length;

    return {
      today: todayEmotions,
      thisWeek: weekEmotions,
      thisMonth: monthEmotions,
      total: emotions.length,
      avgPerDay: Math.round(monthEmotions / 30) || 0,
    };
  }, [emotions]);

  return {
    // State
    isLoading,
    insights,
    reports,
    analytics,
    recommendations,
    lastUpdated,
    emotionCount: emotions.length,

    // Analysis methods
    getHealthScoreContext,
    getTrendAnalysis,
    getStabilityAnalysis,
    getTriggerAnalysis,
    getEmotionalPatterns,
    getWeeklyHighlights,
    getMonthlyHighlights,
    getHealthSuggestions,
    getSummaryStats,

    // Data export
    exportData,

    // Refresh
    refresh,
  };
}

export default useEmotionInsights;
