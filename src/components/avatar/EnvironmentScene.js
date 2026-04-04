"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lighting presets: ambient + directional colours
 */
const LIGHTING_PRESETS = {
  studio: { ambient: "#ffffff", ambientI: 0.6, dir: "#ffffff", dirI: 1.0 },
  warm: { ambient: "#ffe4c4", ambientI: 0.5, dir: "#ffd700", dirI: 0.9 },
  cool: { ambient: "#cce0ff", ambientI: 0.5, dir: "#aac8ff", dirI: 0.9 },
  night: { ambient: "#334466", ambientI: 0.25, dir: "#6688cc", dirI: 0.5 },
  sunset: { ambient: "#ffccaa", ambientI: 0.4, dir: "#ff8844", dirI: 1.0 },
};

/**
 * Map emotions → slight lighting tint shifts
 */
const EMOTION_TINT = {
  happy: "#fffff0",
  sad: "#d0d8e8",
  angry: "#ffe0d0",
  calm: "#e8f0ff",
  anxious: "#e8e0d8",
  neutral: "#ffffff",
};

/**
 * Map backgrounds → ground color + lighting preset hint
 */
const BACKGROUND_COLORS = {
  living_room: { ground: "#8B7355", lightPreset: "warm" },
  office: { ground: "#6B7B8D", lightPreset: "studio" },
  garden: { ground: "#4A7C59", lightPreset: "warm" },
  abstract: { ground: "#4B0082", lightPreset: "cool" },
  space: { ground: "#0a0a2e", lightPreset: "night" },
  none: { ground: "#1a1a2e", lightPreset: "studio" },
  starfield: { ground: "#1a1a2e", lightPreset: "studio" },
};

/**
 * EnvironmentScene — sets up ambient light, directional light, and ground plane.
 * Emotion & lighting-preset driven.
 */
export function EnvironmentScene({
  emotion = "neutral",
  background = "starfield",
  lightingPreset = "studio",
}) {
  const ambientRef = useRef(null);
  const dirRef = useRef(null);
  const groundRef = useRef(null);

  const bgConfig = BACKGROUND_COLORS[background] || BACKGROUND_COLORS.starfield;
  const effectivePreset =
    LIGHTING_PRESETS[lightingPreset] ||
    LIGHTING_PRESETS[bgConfig.lightPreset] ||
    LIGHTING_PRESETS.studio;
  const tint = EMOTION_TINT[emotion] || EMOTION_TINT.neutral;

  // Smooth color transitions each frame
  useFrame((_, delta) => {
    const speed = delta * 3;
    if (ambientRef.current) {
      const target = new THREE.Color(effectivePreset.ambient).multiply(
        new THREE.Color(tint),
      );
      ambientRef.current.color.lerp(target, speed);
      ambientRef.current.intensity +=
        (effectivePreset.ambientI - ambientRef.current.intensity) * speed;
    }
    if (dirRef.current) {
      const target = new THREE.Color(effectivePreset.dir);
      dirRef.current.color.lerp(target, speed);
      dirRef.current.intensity +=
        (effectivePreset.dirI - dirRef.current.intensity) * speed;
    }
    if (groundRef.current) {
      const targetGround = new THREE.Color(bgConfig.ground);
      groundRef.current.color.lerp(targetGround, speed);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={effectivePreset.ambientI} />
      <directionalLight
        ref={dirRef}
        position={[2, 4, 3]}
        intensity={effectivePreset.dirI}
        castShadow={false}
      />
      {/* Soft fill light from below to avoid harsh shadows under chin */}
      <directionalLight position={[-1, -1, 2]} intensity={0.2} />
      {/* Ground plane — color driven by background selection */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1, 0]}
        receiveShadow={false}
      >
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial
          ref={groundRef}
          color={bgConfig.ground}
          transparent
          opacity={0.4}
        />
      </mesh>
    </>
  );
}
