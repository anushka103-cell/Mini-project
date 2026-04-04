"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as HeadMovementEngine from "./HeadMovementEngine";

/**
 * useHeadMovement Hook
 * Manages head movement animations and state
 * Integrates HeadMovementEngine with React
 */
export function useHeadMovement() {
  const [headTilt, setHeadTilt] = useState(0);
  const [headRoll, setHeadRoll] = useState(0);
  const [headNod, setHeadNod] = useState(0);

  const headMovementRef = useRef(null);
  const animationFrameRef = useRef(null);
  const movementQueueRef = useRef([]);
  const blendingRef = useRef({
    active: false,
    source: 0,
    target: 0,
    progress: 0,
  });

  // Animation loop
  useEffect(() => {
    const animationLoop = (currentTimeMs) => {
      const movement = headMovementRef.current;
      const blending = blendingRef.current;
      const queue = movementQueueRef.current;

      if (!movement) {
        animationFrameRef.current = requestAnimationFrame(animationLoop);
        return;
      }

      const elapsedMs = currentTimeMs - (movement.startTime || currentTimeMs);

      let currentTilt = 0;
      let currentRoll = 0;
      let currentNod = 0;

      // Execute active movement
      if (movement.current) {
        const result = movement.current(elapsedMs);
        currentTilt = result.tilt || 0;
        currentRoll = result.roll || 0;
        currentNod = result.nod || 0;

        // Check if movement complete
        if (result.complete) {
          if (queue.length > 0) {
            const next = queue.shift();
            headMovementRef.current = {
              ...next,
              startTime: currentTimeMs,
            };
          } else {
            headMovementRef.current.current = null;
          }
        }
      }

      // Apply blending transition
      if (blending.active) {
        blending.progress += 0.016; // ~60fps
        if (blending.progress >= 1) {
          blending.active = false;
          blending.progress = 1;
        }

        const easeProgress = easeInOutCubic(blending.progress);
        currentTilt =
          blending.source * (1 - easeProgress) + blending.target * easeProgress;
      }

      setHeadTilt(currentTilt);
      setHeadRoll(currentRoll);
      setHeadNod(currentNod);

      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };

    animationFrameRef.current = requestAnimationFrame(animationLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  /**
   * Queue a head movement animation
   * @param {string} movementType - Type of movement (nod, shake, etc)
   * @param {Object} options - Movement options
   */
  const queueHeadMovement = useCallback((movementType, options = {}) => {
    let movement;

    switch (movementType) {
      case "nod":
        movement = HeadMovementEngine.generateNodding(
          options.speed || 1,
          options.amplitude || 20,
        );
        break;
      case "shake":
        movement = HeadMovementEngine.generateShaking(
          options.speed || 1,
          options.amplitude || 20,
        );
        break;
      case "bob":
        movement = HeadMovementEngine.generateHeadBob(options.bpm || 120);
        break;
      case "tilt":
        movement = HeadMovementEngine.parseHeadTilt(
          options.angle || 15,
          options.duration || 500,
        );
        break;
      case "contemplative":
        movement = HeadMovementEngine.generateContemplative();
        break;
      case "confused":
        movement = HeadMovementEngine.generateConfused();
        break;
      case "tired":
        movement = HeadMovementEngine.generateTiredWobble();
        break;
      case "emphatic":
        movement = HeadMovementEngine.generateEmphatic(
          options.type || "agree",
          options.intensity || 1,
        );
        break;
      default:
        return;
    }

    if (movement) {
      movementQueueRef.current.push({
        current: movement,
      });
    }
  }, []);

  /**
   * Play a sequence of head movements
   * @param {Array} sequence - Array of {type, options} movements
   */
  const playHeadSequence = useCallback(
    (sequence) => {
      movementQueueRef.current = [];

      for (const step of sequence) {
        queueHeadMovement(step.type, step.options);
      }
    },
    [queueHeadMovement],
  );

  /**
   * Get emotion-based head tilt
   * @param {string} emotion - Emotion name
   * @returns {Object} Movement to queue
   */
  const getEmotionHeadTilt = useCallback((emotion) => {
    return HeadMovementEngine.getEmotionHeadTilt(emotion);
  }, []);

  /**
   * Blend from current position to target tilt
   * Smooth transition using easing
   * @param {number} targetTilt - Target tilt angle
   * @param {number} durationMs - Transition duration
   */
  const blendToHeadMovement = useCallback(
    (targetTilt, durationMs = 500) => {
      const blending = blendingRef.current;
      blending.source = headTilt;
      blending.target = targetTilt;
      blending.active = true;
      blending.progress = 0;
    },
    [headTilt],
  );

  /**
   * Stop all queued movements
   */
  const stopMovements = useCallback(() => {
    movementQueueRef.current = [];
    headMovementRef.current = null;
    blendingRef.current.active = false;
  }, []);

  /**
   * Clear queue but keep current movement
   */
  const clearQueue = useCallback(() => {
    movementQueueRef.current = [];
  }, []);

  /**
   * Get current head position
   */
  const getHeadPosition = useCallback(() => {
    return {
      tilt: headTilt,
      roll: headRoll,
      nod: headNod,
    };
  }, [headTilt, headRoll, headNod]);

  /**
   * Rapid multiple nodding (emphasis)
   * @param {number} count - Number of nods
   * @param {number} speed - Nod speed
   */
  const emphasisNods = useCallback(
    (count = 3, speed = 1.5) => {
      playHeadSequence(
        Array(count)
          .fill(null)
          .map(() => ({
            type: "nod",
            options: { speed },
          })),
      );
    },
    [playHeadSequence],
  );

  /**
   * Head tilt based on thinking levels
   * @param {number} level - Thinking intensity (0-1)
   */
  const thinkingTilt = useCallback(
    (level = 0.5) => {
      const angle = -15 + level * 10; // -15 to -5 degrees
      blendToHeadMovement(angle, 300);
    },
    [blendToHeadMovement],
  );

  /**
   * Confused head movement
   * Quick tilts left and right
   */
  const confusedMovement = useCallback(() => {
    playHeadSequence([
      { type: "tilt", options: { angle: -20, duration: 200 } },
      { type: "tilt", options: { angle: 20, duration: 200 } },
      { type: "tilt", options: { angle: -10, duration: 150 } },
      { type: "tilt", options: { angle: 0, duration: 200 } },
    ]);
  }, [playHeadSequence]);

  return {
    // State
    tilt: headTilt,
    roll: headRoll,
    nod: headNod,

    // Animation control
    queueHeadMovement,
    playHeadSequence,
    blendToHeadMovement,
    stopMovements,
    clearQueue,

    // Helpers
    getHeadPosition,
    getEmotionHeadTilt,
    emphasisNods,
    thinkingTilt,
    confusedMovement,

    // Queue info
    queueLength: movementQueueRef.current.length,
  };
}

/**
 * Easing function for smooth transitions
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
