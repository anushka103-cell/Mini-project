"use client";

import { useRef, useCallback } from "react";

/**
 * Gesture definitions: bone targets + rotation keyframes
 */
const GESTURE_DEFS = {
  wave: {
    bones: ["rightUpperArm", "rightLowerArm"],
    keyframes: [
      { t: 0, rotations: [{ z: -1.2 }, { z: -0.5 }] },
      { t: 0.15, rotations: [{ z: -1.2 }, { z: 0.3 }] },
      { t: 0.3, rotations: [{ z: -1.2 }, { z: -0.5 }] },
      { t: 0.45, rotations: [{ z: -1.2 }, { z: 0.3 }] },
      { t: 0.6, rotations: [{ z: 0 }, { z: 0 }] },
    ],
    duration: 0.6,
  },
  nod: {
    bones: ["head"],
    keyframes: [
      { t: 0, rotations: [{ x: 0 }] },
      { t: 0.15, rotations: [{ x: 0.2 }] },
      { t: 0.3, rotations: [{ x: 0 }] },
      { t: 0.45, rotations: [{ x: 0.15 }] },
      { t: 0.6, rotations: [{ x: 0 }] },
    ],
    duration: 0.6,
  },
  thinking: {
    bones: ["head", "rightUpperArm", "rightLowerArm"],
    keyframes: [
      { t: 0, rotations: [{ z: 0.1 }, { z: -0.4, x: -0.3 }, { z: -0.6 }] },
      { t: 2.0, rotations: [{ z: -0.1 }, { z: -0.4, x: -0.3 }, { z: -0.6 }] },
    ],
    duration: 2.0,
  },
  talking: {
    bones: ["rightUpperArm", "leftUpperArm"],
    keyframes: [
      { t: 0, rotations: [{ z: -0.2 }, { z: 0.2 }] },
      { t: 0.4, rotations: [{ z: -0.35 }, { z: 0.15 }] },
      { t: 0.8, rotations: [{ z: -0.15 }, { z: 0.3 }] },
      { t: 1.2, rotations: [{ z: -0.2 }, { z: 0.2 }] },
    ],
    duration: 1.2,
    loop: true,
  },
  shrug: {
    bones: ["leftUpperArm", "rightUpperArm"],
    keyframes: [
      { t: 0, rotations: [{ z: 0.3 }, { z: -0.3 }] },
      { t: 0.3, rotations: [{ z: 0.6 }, { z: -0.6 }] },
      { t: 0.8, rotations: [{ z: 0 }, { z: 0 }] },
    ],
    duration: 0.8,
  },
};

/**
 * Map natural language cues → gesture names
 */
const TEXT_GESTURE_MAP = [
  { patterns: ["hello", "hi ", "hey", "greet"], gesture: "wave" },
  { patterns: ["yes", "agree", "sure", "okay", "right"], gesture: "nod" },
  { patterns: ["think", "hmm", "wonder", "consider"], gesture: "thinking" },
  { patterns: ["don't know", "not sure", "shrug"], gesture: "shrug" },
];

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/**
 * useGestureSystem — triggers and updates body gestures on VRM bones.
 * @param {React.MutableRefObject} vrmRef
 */
export function useGestureSystem(vrmRef) {
  const activeGesture = useRef(null);
  const gestureTime = useRef(0);

  const applyGestureFrame = useCallback(
    (def, t) => {
      const vrm = vrmRef.current;
      if (!vrm) return;

      // Find surrounding keyframes
      const kfs = def.keyframes;
      let kfA = kfs[0];
      let kfB = kfs[kfs.length - 1];
      for (let i = 0; i < kfs.length - 1; i++) {
        if (t >= kfs[i].t && t <= kfs[i + 1].t) {
          kfA = kfs[i];
          kfB = kfs[i + 1];
          break;
        }
      }

      const segDur = kfB.t - kfA.t || 1;
      const segT = (t - kfA.t) / segDur;

      def.bones.forEach((boneName, bi) => {
        try {
          const bone = vrm.humanoid?.getRawBoneNode(boneName);
          if (!bone) return;
          const rotA = kfA.rotations[bi] || {};
          const rotB = kfB.rotations[bi] || {};
          if (rotA.x !== undefined || rotB.x !== undefined) {
            bone.rotation.x = lerp(rotA.x || 0, rotB.x || 0, segT);
          }
          if (rotA.y !== undefined || rotB.y !== undefined) {
            bone.rotation.y = lerp(rotA.y || 0, rotB.y || 0, segT);
          }
          if (rotA.z !== undefined || rotB.z !== undefined) {
            bone.rotation.z = lerp(rotA.z || 0, rotB.z || 0, segT);
          }
        } catch {
          // Bone not available on this model
        }
      });
    },
    [vrmRef],
  );

  const triggerGesture = useCallback((name) => {
    const def = GESTURE_DEFS[name];
    if (!def) return;
    activeGesture.current = { ...def, name };
    gestureTime.current = 0;
  }, []);

  const triggerFromText = useCallback(
    (text) => {
      const lower = (text || "").toLowerCase();
      for (const rule of TEXT_GESTURE_MAP) {
        if (rule.patterns.some((p) => lower.includes(p))) {
          triggerGesture(rule.gesture);
          return;
        }
      }
    },
    [triggerGesture],
  );

  const triggerThinking = useCallback(
    () => triggerGesture("thinking"),
    [triggerGesture],
  );
  const triggerWave = useCallback(
    () => triggerGesture("wave"),
    [triggerGesture],
  );
  const startTalkingGesture = useCallback(
    () => triggerGesture("talking"),
    [triggerGesture],
  );

  const updateGestures = useCallback(
    (delta) => {
      if (!activeGesture.current) return;
      gestureTime.current += delta;
      const def = activeGesture.current;
      let t = gestureTime.current;

      if (t >= def.duration) {
        if (def.loop) {
          t = t % def.duration;
          gestureTime.current = t;
        } else {
          activeGesture.current = null;
          return;
        }
      }

      applyGestureFrame(def, t);
    },
    [applyGestureFrame],
  );

  return {
    triggerGesture,
    triggerFromText,
    triggerThinking,
    triggerWave,
    startTalkingGesture,
    updateGestures,
  };
}
