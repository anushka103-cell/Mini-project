"use client";

import { useRef, useCallback } from "react";
import * as THREE from "three";

/**
 * useAnimationSystem — drives full-body animations via THREE.AnimationMixer on a VRM model.
 * @param {React.MutableRefObject} vrmRef
 */
export function useAnimationSystem(vrmRef) {
  const mixerRef = useRef(null);
  const activeAction = useRef(null);
  const playingRef = useRef(false);

  const ensureMixer = useCallback(() => {
    const vrm = vrmRef.current;
    if (!vrm) return null;
    if (!mixerRef.current) {
      mixerRef.current = new THREE.AnimationMixer(vrm.scene);
    }
    return mixerRef.current;
  }, [vrmRef]);

  const playAnimation = useCallback(
    (clip) => {
      const mixer = ensureMixer();
      if (!mixer || !clip) return;

      // Stop previous
      if (activeAction.current) {
        activeAction.current.fadeOut(0.3);
      }

      const action = mixer.clipAction(clip);
      action.reset().fadeIn(0.3).play();
      activeAction.current = action;
      playingRef.current = true;
    },
    [ensureMixer],
  );

  const stopAnimation = useCallback(() => {
    if (activeAction.current) {
      activeAction.current.fadeOut(0.3);
      activeAction.current = null;
    }
    playingRef.current = false;
  }, []);

  const isPlaying = useCallback(() => playingRef.current, []);

  const updateAnimation = useCallback((delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  }, []);

  return { playAnimation, stopAnimation, isPlaying, updateAnimation };
}
