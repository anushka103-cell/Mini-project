"use client";

import { useRef, useCallback } from "react";
import {
  generateEyeWandering,
  generateIdleBreathing,
  generateIdleBlink,
  generateMicroExpression,
  generateFidgeting,
} from "./IdleAnimationsEngine";
import {
  getEmotionHeadTilt,
  generateContemplative,
} from "./HeadMovementEngine";

/**
 * useIdleAnimations — drives breathing, blinking, eye wander, head drift, and fidgeting
 * on a VRM model each frame.
 *
 * @param {React.MutableRefObject} vrmRef - ref to VRM instance
 * @param {React.MutableRefObject} emotionRef - ref to current emotion string
 */
export function useIdleAnimations(vrmRef, emotionRef) {
  const elapsedRef = useRef(0);
  const headDriftRef = useRef(null);
  const gazeTarget = useRef({ x: 0, y: 0 });

  const lookAt = useCallback(
    (x, y) => {
      gazeTarget.current = { x, y };
      const vrm = vrmRef.current;
      if (!vrm) return;

      // Apply eye gaze via VRM lookAt or expression
      try {
        if (vrm.lookAt) {
          // VRM 1.0 lookAt target
          vrm.lookAt.target =
            vrm.lookAt.target || new (require("three").Object3D)();
          vrm.lookAt.target.position.set(x * 2, y * 2 + 1.4, 2);
        } else if (vrm.expressionManager) {
          // Fallback: expression-based gaze
          const lookRight = Math.max(0, x);
          const lookLeft = Math.max(0, -x);
          const lookUp = Math.max(0, y);
          const lookDown = Math.max(0, -y);
          vrm.expressionManager.setValue("lookRight", lookRight * 0.5);
          vrm.expressionManager.setValue("lookLeft", lookLeft * 0.5);
          vrm.expressionManager.setValue("lookUp", lookUp * 0.5);
          vrm.expressionManager.setValue("lookDown", lookDown * 0.5);
        }
      } catch {
        // Expression not supported
      }
    },
    [vrmRef],
  );

  const updateIdle = useCallback(
    (delta, isSpeaking, userActive) => {
      const vrm = vrmRef.current;
      if (!vrm) return;

      elapsedRef.current += delta * 1000; // Convert to ms
      const elapsed = elapsedRef.current;
      const emotion = emotionRef?.current || "neutral";

      // ── Breathing ──
      const breath = generateIdleBreathing(elapsed);
      try {
        const spine = vrm.humanoid?.getRawBoneNode("spine");
        if (spine) {
          spine.scale.set(breath.scale, breath.scale, breath.scale);
        }
      } catch {
        // Bone not available
      }

      // ── Blinking ──
      const blink = generateIdleBlink(elapsed);
      try {
        if (vrm.expressionManager) {
          const blinkVal = 1 - blink.eyeOpenness;
          vrm.expressionManager.setValue("blink", Math.max(0, blinkVal));
        }
      } catch {
        // Expression not supported
      }

      // ── Eye wandering (only when user is NOT actively moving cursor) ──
      if (!userActive) {
        const wander = generateEyeWandering(elapsed, 0.4);
        lookAt(wander.gazeDirX, wander.gazeDirY);
      }

      // ── Micro-expressions ──
      const emotionValence =
        emotion === "happy" || emotion === "excited"
          ? 0.7
          : emotion === "sad" || emotion === "anxious"
            ? -0.5
            : 0;
      const micro = generateMicroExpression(elapsed, emotionValence);
      if (micro.intensity > 0 && vrm.expressionManager) {
        try {
          if (micro.expression === "slight_smile") {
            vrm.expressionManager.setValue("happy", micro.intensity * 0.3);
          } else if (micro.expression === "slight_frown") {
            vrm.expressionManager.setValue("sad", micro.intensity * 0.3);
          }
        } catch {
          // skip
        }
      }

      // ── Head drift ──
      if (!isSpeaking) {
        const headTilt = getEmotionHeadTilt(emotion);
        try {
          const head = vrm.humanoid?.getRawBoneNode("head");
          if (head) {
            // Gentle sinusoidal drift + emotion-based tilt
            const driftY = Math.sin(elapsed / 5000) * 0.03;
            const driftZ = Math.sin(elapsed / 7000) * 0.02;
            const tiltX = ((headTilt * Math.PI) / 180) * 0.3;
            head.rotation.x += (tiltX - head.rotation.x) * delta * 2;
            head.rotation.y += (driftY - head.rotation.y) * delta * 1.5;
            head.rotation.z += (driftZ - head.rotation.z) * delta * 1.5;
          }
        } catch {
          // Bone not available
        }
      }

      // ── Subtle fidgeting ──
      const fidget = generateFidgeting(elapsed, "shoulders", 0.15);
      try {
        const leftShoulder = vrm.humanoid?.getRawBoneNode("leftUpperArm");
        const rightShoulder = vrm.humanoid?.getRawBoneNode("rightUpperArm");
        if (leftShoulder) {
          leftShoulder.rotation.z += (fidget.rotation || 0) * 0.001 * delta;
        }
        if (rightShoulder) {
          rightShoulder.rotation.z -= (fidget.rotation || 0) * 0.001 * delta;
        }
      } catch {
        // Bones not available
      }
    },
    [vrmRef, emotionRef, lookAt],
  );

  return { updateIdle, lookAt };
}
