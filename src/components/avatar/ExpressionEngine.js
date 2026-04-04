"use client";

import { useRef, useCallback } from "react";
import { animateEmotionTransition, blendExpressions } from "./EmotionAnimator";

/**
 * VRM expression name mapping from emotion labels
 */
const EMOTION_TO_VRM = {
  happy: { happy: 1.0 },
  sad: { sad: 1.0 },
  angry: { angry: 1.0 },
  surprised: { surprised: 1.0 },
  relaxed: { relaxed: 1.0 },
  calm: { relaxed: 0.6 },
  neutral: {},
  anxious: { sad: 0.3, surprised: 0.3 },
  excited: { happy: 0.8, surprised: 0.4 },
  compassionate: { relaxed: 0.4, sad: 0.2 },
  curious: { surprised: 0.5 },
  thinking: { relaxed: 0.3 },
  concerned: { sad: 0.4 },
};

/**
 * useExpressionEngine — manages VRM facial expressions with smooth transitions.
 * @param {React.MutableRefObject} vrmRef - ref to VRM instance
 * @param {number} intensity - global expression intensity multiplier
 */
export function useExpressionEngine(vrmRef, intensity = 1.0) {
  const emotionRef = useRef("neutral");
  const targetWeights = useRef({});
  const currentWeights = useRef({});
  const overridesRef = useRef({});
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const setEmotion = useCallback((emotion, emotionIntensity = 0.7) => {
    emotionRef.current = emotion;
    const mapping = EMOTION_TO_VRM[emotion] || {};
    const newTarget = {};
    for (const [expr, weight] of Object.entries(mapping)) {
      newTarget[expr] = weight * emotionIntensity;
    }
    targetWeights.current = newTarget;
  }, []);

  const setOverrides = useCallback((overrides) => {
    overridesRef.current = overrides || {};
  }, []);

  const updateExpressions = useCallback(
    (delta) => {
      const vrm = vrmRef.current;
      if (!vrm || !vrm.expressionManager) return;

      const lerpSpeed = 4.0 * delta;
      const allKeys = new Set([
        ...Object.keys(targetWeights.current),
        ...Object.keys(currentWeights.current),
        ...Object.keys(overridesRef.current),
      ]);

      for (const key of allKeys) {
        const target = targetWeights.current[key] || 0;
        const override = overridesRef.current[key] || 0;
        const combined = Math.min(1, target + override);
        const current = currentWeights.current[key] || 0;

        // Smooth lerp toward target
        const next = current + (combined - current) * Math.min(lerpSpeed, 1);
        currentWeights.current[key] = next;

        try {
          vrm.expressionManager.setValue(key, next * intensityRef.current);
        } catch {
          // Expression name not available on this model — skip
        }
      }
    },
    [vrmRef],
  );

  return { setEmotion, setOverrides, updateExpressions, emotionRef };
}
