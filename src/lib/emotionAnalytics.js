"use client";

/**
 * Emotion Analytics Engine
 * Advanced analytics, trend analysis, and reporting for emotional health
 */

// ==================== ANALYTICS CALCULATIONS ====================

/**
 * Calculate emotion trend for a given time period
 * Returns: 'improving', 'declining', 'stable', or 'insufficient_data'
 */
export function calculateEmotionTrend(emotions, days = 7) {
  if (!emotions || emotions.length < 2) return "insufficient_data";

  // Filter to last N days
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length < 2) return "insufficient_data";

  // Split into two periods
  const mid = Math.floor(filtered.length / 2);
  const firstHalf = filtered.slice(0, mid);
  const secondHalf = filtered.slice(mid);

  // Calculate average valence for each period
  const firstAvg =
    firstHalf.reduce((sum, e) => sum + (e.valence || 0), 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, e) => sum + (e.valence || 0), 0) /
    secondHalf.length;

  // Determine trend
  const diff = secondAvg - firstAvg;
  if (diff > 0.1) return "improving";
  if (diff < -0.1) return "declining";
  return "stable";
}

/**
 * Calculate volatility (emotional stability)
 * Returns: 0-1 (1 = very stable, 0 = very volatile)
 */
export function calculateVolatility(emotions, days = 7) {
  if (!emotions || emotions.length < 2) return 0.5;

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length < 2) return 0.5;

  // Calculate standard deviation of valence
  const valences = filtered.map((e) => e.valence || 0.5);
  const mean = valences.reduce((sum, v) => sum + v, 0) / valences.length;
  const variance =
    valences.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    valences.length;
  const stdDev = Math.sqrt(variance);

  // Convert to stability score (inverse of volatility)
  // Standard deviation of 0.5 = stable (0.75), 0 = very stable (1), 1 = volatile (0)
  return Math.max(0, Math.min(1, 1 - stdDev));
}

/**
 * Calculate mental health score (0-100)
 * Based on: valence (50%), stability (30%), engagement (20%)
 */
export function calculateMentalHealthScore(
  emotions,
  days = 7,
  engagement = 0.5,
) {
  if (!emotions || emotions.length === 0) return 50;

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length === 0) return 50;

  // Average valence (0-1 → 0-50 points)
  const avgValence =
    filtered.reduce((sum, e) => sum + (e.valence || 0.5), 0) / filtered.length;
  const valenceScore = avgValence * 50;

  // Stability score (0-1 → 0-30 points)
  const stability = calculateVolatility(emotions, days);
  const stabilityScore = stability * 30;

  // Engagement score (external input, 0-1 → 0-20 points)
  const engagementScore = Math.min(1, Math.max(0, engagement)) * 20;

  // Total score
  return Math.round(valenceScore + stabilityScore + engagementScore);
}

/**
 * Identify peak emotional times (hours of day)
 * Returns: { hour, intensity, count }[]
 */
export function getPeakEmotionalTimes(emotions, days = 7) {
  if (!emotions || emotions.length === 0) return [];

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length === 0) return [];

  // Group by hour
  const hourData = {};
  for (let i = 0; i < 24; i++) {
    hourData[i] = { hour: i, intensities: [], count: 0 };
  }

  filtered.forEach((emotion) => {
    const date = new Date(emotion.timestamp);
    const hour = date.getHours();
    const intensity = Math.abs(emotion.valence - 0.5) * 2; // 0-1 scale
    hourData[hour].intensities.push(intensity);
    hourData[hour].count += 1;
  });

  // Calculate averages and return top 5
  return Object.values(hourData)
    .filter((h) => h.count > 0)
    .map((h) => ({
      hour: h.hour,
      intensity:
        h.intensities.reduce((a, b) => a + b, 0) / h.intensities.length,
      count: h.count,
    }))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);
}

/**
 * Get emotion triggers (contexts associated with low valence)
 * Returns: { trigger, count, avgImpact }[]
 */
export function getEmotionTriggers(emotions, days = 14) {
  if (!emotions || emotions.length === 0) return [];

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length === 0) return [];

  // Extract negative emotion contexts
  const triggerMap = {};
  filtered
    .filter((e) => e.valence < 0.4) // Low valence
    .forEach((emotion) => {
      const contexts = emotion.context ? emotion.context.split(",") : [];
      contexts.forEach((ctx) => {
        const trigger = ctx.trim().toLowerCase();
        if (trigger && trigger.length > 2) {
          if (!triggerMap[trigger]) {
            triggerMap[trigger] = { count: 0, impacts: [] };
          }
          triggerMap[trigger].count += 1;
          triggerMap[trigger].impacts.push(emotion.valence);
        }
      });
    });

  // Calculate impact and return top 10
  return Object.entries(triggerMap)
    .map(([trigger, data]) => ({
      trigger,
      count: data.count,
      avgImpact:
        1 - data.impacts.reduce((a, b) => a + b, 0) / data.impacts.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Get coping strategy effectiveness
 * Returns: { strategy, count, effectiveness }[]
 */
export function getCopingStrategyEffectiveness(emotions, days = 14) {
  if (!emotions || emotions.length === 0) return [];

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length === 0) return [];

  // Extract coping strategies and their outcomes
  const strategyMap = {};
  filtered.forEach((emotion) => {
    if (emotion.copingStrategy) {
      const strategy = emotion.copingStrategy.toLowerCase();
      if (!strategyMap[strategy]) {
        strategyMap[strategy] = { count: 0, outcomes: [] };
      }
      strategyMap[strategy].count += 1;
      strategyMap[strategy].outcomes.push(emotion.valence);
    }
  });

  // Calculate effectiveness (positive valence after using strategy)
  return Object.entries(strategyMap)
    .map(([strategy, data]) => ({
      strategy,
      count: data.count,
      effectiveness:
        data.outcomes.reduce((a, b) => a + b, 0) / data.outcomes.length,
    }))
    .sort((a, b) => b.effectiveness - a.effectiveness)
    .filter((s) => s.count >= 2); // Only strategies used 2+ times
}

/**
 * Generate weekly summary report
 */
export function generateWeeklySummary(emotions) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > weekAgo);

  if (filtered.length === 0) {
    return {
      period: "This Week",
      emotionCount: 0,
      averageValence: 0.5,
      trend: "insufficient_data",
      dominantEmotions: [],
      highlights: ["No data available for this period"],
    };
  }

  // Calculate metrics
  const avgValence =
    filtered.reduce((sum, e) => sum + (e.valence || 0.5), 0) / filtered.length;
  const trend = calculateEmotionTrend(emotions, 7);
  const dominantEmotions = getDominantEmotions(filtered, 3);
  const healthScore = calculateMentalHealthScore(emotions, 7);

  // Generate highlights
  const highlights = [];
  if (trend === "improving") {
    highlights.push("Your mood is improving this week!");
  } else if (trend === "declining") {
    highlights.push(
      "Your mood has been declining. Consider reaching out for support.",
    );
  }

  if (healthScore >= 75) {
    highlights.push("Great emotional stability this week!");
  } else if (healthScore < 40) {
    highlights.push("This has been a challenging week. Take care of yourself.");
  }

  const topTriggers = getEmotionTriggers(filtered, 7);
  if (topTriggers.length > 0) {
    highlights.push(`Primary trigger: ${topTriggers[0].trigger}`);
  }

  return {
    period: "This Week",
    emotionCount: filtered.length,
    averageValence: Math.round(avgValence * 100) / 100,
    trend,
    dominantEmotions,
    highlights,
    healthScore,
  };
}

/**
 * Generate monthly summary report
 */
export function generateMonthlySummary(emotions) {
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > monthAgo);

  if (filtered.length === 0) {
    return {
      period: "This Month",
      emotionCount: 0,
      averageValence: 0.5,
      trend: "insufficient_data",
      bestDay: null,
      highlights: ["No data available for this period"],
    };
  }

  // Group by day of week
  const dayStats = {};
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  dayNames.forEach((day, i) => {
    dayStats[i] = { count: 0, valences: [] };
  });

  filtered.forEach((emotion) => {
    const date = new Date(emotion.timestamp);
    const dayOfWeek = date.getDay();
    dayStats[dayOfWeek].count += 1;
    dayStats[dayOfWeek].valences.push(emotion.valence || 0.5);
  });

  // Find best day
  const bestDay = Object.entries(dayStats)
    .filter(([_, stats]) => stats.count > 0)
    .map(([dayIndex, stats]) => ({
      day: dayNames[dayIndex],
      avgValence:
        stats.valences.reduce((a, b) => a + b, 0) / stats.valences.length,
      count: stats.count,
    }))
    .sort((a, b) => b.avgValence - a.avgValence)[0];

  const avgValence =
    filtered.reduce((sum, e) => sum + (e.valence || 0.5), 0) / filtered.length;
  const trend = calculateEmotionTrend(emotions, 30);
  const healthScore = calculateMentalHealthScore(emotions, 30);
  const dominantEmotions = getDominantEmotions(filtered, 3);

  const highlights = [];
  if (bestDay) {
    highlights.push(`${bestDay.day} is typically your best day`);
  }
  if (healthScore >= 75) {
    highlights.push("Excellent emotional health this month!");
  }
  const topTriggers = getEmotionTriggers(filtered, 30);
  if (topTriggers.length > 0) {
    highlights.push(`Most common trigger: ${topTriggers[0].trigger}`);
  }

  return {
    period: "This Month",
    emotionCount: filtered.length,
    averageValence: Math.round(avgValence * 100) / 100,
    trend,
    bestDay,
    highlights,
    healthScore,
    dominantEmotions,
  };
}

/**
 * Get yearly mental health score trend
 */
export function getYearlyHealthTrend(emotions) {
  if (!emotions || emotions.length === 0) {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      score: 50,
    }));
  }

  const now = Date.now();
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > yearAgo);

  // Group by month
  const monthData = {};
  for (let i = 0; i < 12; i++) {
    monthData[i] = [];
  }

  filtered.forEach((emotion) => {
    const date = new Date(emotion.timestamp);
    const month = date.getMonth();
    monthData[month].push(emotion);
  });

  // Calculate health score for each month
  return Array.from({ length: 12 }, (_, month) => ({
    month: month + 1,
    score:
      monthData[month].length > 0
        ? calculateMentalHealthScore(monthData[month], 30)
        : 50,
  }));
}

/**
 * Get dominant emotions for visualization
 */
export function getDominantEmotions(emotions, limit = 5) {
  if (!emotions || emotions.length === 0) return [];

  const emotionMap = {};
  emotions.forEach((emotion) => {
    const name = emotion.emotion || "neutral";
    if (!emotionMap[name]) {
      emotionMap[name] = 0;
    }
    emotionMap[name] += 1;
  });

  return Object.entries(emotionMap)
    .map(([emotion, count]) => ({
      emotion,
      count,
      percentage: Math.round((count / emotions.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get emotion distribution for pie chart
 */
export function getEmotionDistribution(emotions, days = 30) {
  if (!emotions || emotions.length === 0) {
    return [{ name: "Neutral", value: 100, fill: "#95E1D3" }];
  }

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  const colors = {
    happy: "#FFE66D",
    sad: "#5DA3D5",
    angry: "#E74C3C",
    anxious: "#9B59B6",
    calm: "#52B788",
    excited: "#FF6B9D",
    neutral: "#95E1D3",
    afraid: "#2C3E50",
    frustrated: "#E8A04C",
    content: "#6BCB77",
  };

  const emotionMap = {};
  filtered.forEach((emotion) => {
    const name = emotion.emotion || "neutral";
    if (!emotionMap[name]) {
      emotionMap[name] = 0;
    }
    emotionMap[name] += 1;
  });

  return Object.entries(emotionMap)
    .map(([emotion, count]) => ({
      name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      value: count,
      fill: colors[emotion] || "#95E1D3",
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Get comparison data for trending
 */
export function getComparisonData(emotions, metric = "valence", days = 7) {
  if (!emotions || emotions.length === 0) return [];

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = emotions.filter((e) => e.timestamp > cutoff);

  if (filtered.length === 0) return [];

  // Group by date
  const dateData = {};
  filtered.forEach((emotion) => {
    const date = new Date(emotion.timestamp);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (!dateData[dateStr]) {
      dateData[dateStr] = [];
    }

    if (metric === "valence") {
      dateData[dateStr].push(emotion.valence || 0.5);
    } else if (metric === "arousal") {
      dateData[dateStr].push(emotion.arousal || 0.5);
    }
  });

  // Calculate daily averages
  return Object.entries(dateData)
    .map(([date, values]) => ({
      date,
      average:
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
        100,
      count: values.length,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get personalized recommendations based on emotional patterns
 */
export function getPersonalizedRecommendations(emotions) {
  const recommendations = [];

  // Check trend
  const trend = calculateEmotionTrend(emotions, 7);
  if (trend === "declining") {
    recommendations.push({
      type: "support",
      title: "Mood Support",
      description:
        "Your mood has been declining. Consider reaching out to someone you trust.",
      priority: "high",
    });
  }

  // Check volatility
  const volatility = calculateVolatility(emotions, 7);
  if (volatility < 0.4) {
    recommendations.push({
      type: "grounding",
      title: "Grounding Exercises",
      description: "Try grounding techniques to help stabilize your emotions.",
      priority: "high",
    });
  }

  // Check peak times
  const peakTimes = getPeakEmotionalTimes(emotions, 7);
  if (peakTimes.length > 0 && peakTimes[0].hour >= 22) {
    recommendations.push({
      type: "sleep",
      title: "Sleep Optimization",
      description:
        "You often feel stressed late at night. Try a relaxing bedtime routine.",
      priority: "medium",
    });
  }

  // Check triggers
  const triggers = getEmotionTriggers(emotions, 7);
  if (triggers.length > 0) {
    recommendations.push({
      type: "trigger-management",
      title: `Manage: ${triggers[0].trigger}`,
      description: `This is a common trigger for you. Consider developing coping strategies.`,
      priority: "medium",
    });
  }

  // Check health score
  const healthScore = calculateMentalHealthScore(emotions, 30);
  if (healthScore >= 80) {
    recommendations.push({
      type: "maintain",
      title: "Keep It Up!",
      description:
        "Your emotional health is excellent. Keep maintaining these positive patterns!",
      priority: "low",
    });
  }

  return recommendations;
}
