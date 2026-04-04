"use client";

import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  Suspense,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useExpressionEngine } from "./avatar/ExpressionEngine";
import { useLipSync } from "./avatar/LipSyncEngine";
import { useIdleAnimations } from "./avatar/IdleAnimations";
import { useGestureSystem } from "./avatar/GestureSystem";
import { useAnimationSystem } from "./avatar/AnimationSystem";
import { applyMorphsToVRM } from "./avatar/CharacterCreator";
import { EnvironmentScene } from "./avatar/EnvironmentScene";
import { CAMERA_PRESETS } from "./avatar/CustomizationPanel";

/**
 * CameraController — smoothly lerps camera to preset positions
 */
function CameraController({ preset = "upper" }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 1.4, 2.5));

  useEffect(() => {
    const p = CAMERA_PRESETS[preset] || CAMERA_PRESETS.upper;
    targetPos.current.set(...p.position);
  }, [preset]);

  useFrame((_, delta) => {
    camera.position.lerp(targetPos.current, delta * 2);
  });

  return null;
}

/**
 * VRMAvatarModel — loads a VRM file and drives all animation engines
 */
const VRMAvatarModel = forwardRef(function VRMAvatarModel(
  {
    url,
    emotion = "neutral",
    emotionIntensity = 0.7,
    isSpeaking = false,
    speakingText = "",
    speechRate = 1.0,
    expressionIntensity = 1.0,
    reducedMotion = false,
    materialOverrides = null,
    morphOverrides = null,
    faceTrackingApply = null,
    onModelLoaded,
  },
  ref,
) {
  const vrmRef = useRef(null);
  const sceneRef = useRef(null);
  const userActiveRef = useRef(true);
  const userActiveTimer = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // Load VRM model
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  useEffect(() => {
    if (!gltf) return;
    const vrm = gltf.userData.vrm;
    if (vrm) {
      VRMUtils.removeUnnecessaryJoints(vrm.scene);
      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      vrm.scene.traverse((obj) => {
        if (obj.isMesh) obj.frustumCulled = false;
      });
      vrmRef.current = vrm;
      sceneRef.current = vrm.scene;
      setLoaded(true);

      // Collect material names for debug / onModelLoaded
      const matNames = [];
      vrm.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => {
            if (m.name && !matNames.includes(m.name)) matNames.push(m.name);
          });
        }
      });
      onModelLoaded?.({
        type: "vrm",
        expressions: vrm.expressionManager
          ? Object.keys(vrm.expressionManager._expressionMap || {})
          : [],
        materials: matNames,
      });
    } else {
      // Fallback: non-VRM GLB model loaded
      sceneRef.current = gltf.scene;
      setLoaded(true);
      onModelLoaded?.({ type: "glb" });
    }
  }, [gltf, onModelLoaded]);

  // ── Apply material color overrides ──────────────
  useEffect(() => {
    if (!sceneRef.current || !materialOverrides) return;
    const hairColor = materialOverrides.hair
      ? new THREE.Color(materialOverrides.hair)
      : null;
    const skinColor = materialOverrides.skin
      ? new THREE.Color(materialOverrides.skin)
      : null;
    const clothesColor = materialOverrides.outfit
      ? new THREE.Color(materialOverrides.outfit)
      : null;
    const eyeColor = materialOverrides.eyes
      ? new THREE.Color(materialOverrides.eyes)
      : null;

    sceneRef.current.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        const n = (mat.name || "").toLowerCase();
        if (hairColor && (n.includes("hair") || n.includes("bangs"))) {
          mat.color.copy(hairColor);
        } else if (
          skinColor &&
          (n.includes("skin") || n.includes("face") || n.includes("body"))
        ) {
          mat.color.copy(skinColor);
        } else if (
          clothesColor &&
          (n.includes("cloth") ||
            n.includes("shirt") ||
            n.includes("top") ||
            n.includes("bottom") ||
            n.includes("outfit") ||
            n.includes("dress"))
        ) {
          mat.color.copy(clothesColor);
        } else if (
          eyeColor &&
          n.includes("eye") &&
          !n.includes("eyebrow") &&
          !n.includes("eyelash")
        ) {
          mat.color.copy(eyeColor);
        }
      });
    });
  }, [materialOverrides, loaded]);

  // ── Hook up VRM engines ─────────────────────────
  const expression = useExpressionEngine(vrmRef, expressionIntensity);
  const lipSync = useLipSync();
  const idle = useIdleAnimations(vrmRef, expression.emotionRef);
  const gestures = useGestureSystem(vrmRef);
  const animations = useAnimationSystem(vrmRef);

  // Expose API to parent
  useImperativeHandle(
    ref,
    () => ({
      setEmotion: expression.setEmotion,
      startLipSync: lipSync.startLipSync,
      stopLipSync: lipSync.stopLipSync,
      triggerGesture: gestures.triggerGesture,
      triggerFromText: gestures.triggerFromText,
      triggerThinking: gestures.triggerThinking,
      triggerWave: gestures.triggerWave,
      startTalkingGesture: gestures.startTalkingGesture,
      lookAt: idle.lookAt,
      playAnimation: animations.playAnimation,
      stopAnimation: animations.stopAnimation,
      getVRM: () => vrmRef.current,
    }),
    [expression, lipSync, gestures, idle, animations],
  );

  // Apply emotion changes
  useEffect(() => {
    expression.setEmotion(emotion, emotionIntensity);
  }, [emotion, emotionIntensity, expression.setEmotion]);

  // Start lip sync when speaking
  useEffect(() => {
    if (speakingText && isSpeaking) {
      lipSync.startLipSync(speakingText, speechRate);
    } else if (!isSpeaking) {
      lipSync.stopLipSync();
    }
  }, [speakingText, isSpeaking, speechRate, lipSync]);

  // Track user activity
  useEffect(() => {
    const markActive = () => {
      userActiveRef.current = true;
      if (userActiveTimer.current) clearTimeout(userActiveTimer.current);
      userActiveTimer.current = setTimeout(() => {
        userActiveRef.current = false;
      }, 10000);
    };
    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("click", markActive);
    markActive();
    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("click", markActive);
      if (userActiveTimer.current) clearTimeout(userActiveTimer.current);
    };
  }, []);

  // ── Master animation loop ──────────────────────
  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    // VRM update (spring bones, lookAt, etc.)
    if (vrmRef.current) {
      vrmRef.current.update(clampedDelta);
    }

    // Apply character morphs (bone scaling)
    if (vrmRef.current && morphOverrides) {
      applyMorphsToVRM(vrmRef.current, morphOverrides);
    }

    // Face tracking overrides (when active, takes priority over expression engine)
    if (faceTrackingApply && vrmRef.current) {
      faceTrackingApply(vrmRef.current);
    }

    // Full-body animations (when playing, skip idle)
    const animPlaying = animations.isPlaying();
    if (animPlaying) {
      animations.updateAnimation(clampedDelta);
    }

    // Lip sync → expression overrides
    const lipOverrides = lipSync.updateLipSync();
    expression.setOverrides(lipOverrides);

    // Expression engine (VRM expressions)
    expression.updateExpressions(clampedDelta);

    // Idle animations (skip when full-body anim is playing)
    if (!reducedMotion && !animPlaying) {
      idle.updateIdle(clampedDelta, isSpeaking, userActiveRef.current);
    }

    // Gestures (skip when full-body anim is playing)
    if (!reducedMotion && !animPlaying) {
      gestures.updateGestures(clampedDelta);
    }

    // Eye tracking from cursor
    const { pointer } = state;
    if (pointer && !reducedMotion) {
      idle.lookAt(pointer.x, pointer.y);
    }
  });

  if (!sceneRef.current) return null;

  // Auto-fit: compute scale/position from bounding box
  const box = new THREE.Box3().setFromObject(sceneRef.current);
  const size = new THREE.Vector3();
  box.getSize(size);
  const desiredHeight = 2.0;
  const s = size.y > 0 ? desiredHeight / size.y : 1;
  const yOffset = -box.min.y * s - 1;

  return (
    <primitive object={sceneRef.current} scale={s} position={[0, yOffset, 0]} />
  );
});

/* Loading Indicator */
function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-300 text-sm">Loading Avatar...</span>
      </div>
    </Html>
  );
}

function ErrorFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-2xl">
      <div className="text-center text-slate-400">
        <p className="text-lg mb-2">3D rendering unavailable</p>
        <p className="text-xs">Your browser may not support WebGL</p>
      </div>
    </div>
  );
}

/**
 * Avatar3D — main component with VRM + all animation systems.
 */
const Avatar3D = forwardRef(function Avatar3D(
  {
    url,
    emotion = "neutral",
    emotionIntensity = 0.7,
    isSpeaking = false,
    speakingText = "",
    speechRate = 1.0,
    expressionIntensity = 1.0,
    background = "starfield",
    lightingPreset = "studio",
    cameraPreset = "upper",
    reducedMotion = false,
    captionText = "",
    captionsEnabled = true,
    materialOverrides = null,
    morphOverrides = null,
    faceTrackingApply = null,
    className = "",
    style = {},
    onModelLoaded,
  },
  ref,
) {
  const [webglError, setWebglError] = useState(false);
  const modelRef = useRef(null);

  useImperativeHandle(ref, () => modelRef.current, []);

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-900 rounded-2xl ${className}`}
        style={{ width: "100%", height: "100%", minHeight: 300, ...style }}
      >
        <p className="text-slate-400">
          No avatar loaded — create one in Customize tab
        </p>
      </div>
    );
  }

  if (webglError) return <ErrorFallback />;

  return (
    <div
      className={`relative ${className}`}
      style={{ width: "100%", height: "100%", minHeight: 300, ...style }}
    >
      <Canvas
        camera={{ position: [0, 1.4, 2.5], fov: 45, near: 0.1, far: 50 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
        onError={() => setWebglError(true)}
        dpr={[1, 1.5]}
      >
        <EnvironmentScene
          emotion={emotion}
          background={background}
          lightingPreset={lightingPreset}
        />
        <CameraController preset={cameraPreset} />

        <Suspense fallback={<Loader />}>
          <VRMAvatarModel
            ref={modelRef}
            url={url}
            emotion={emotion}
            emotionIntensity={emotionIntensity}
            isSpeaking={isSpeaking}
            speakingText={speakingText}
            speechRate={speechRate}
            expressionIntensity={expressionIntensity}
            reducedMotion={reducedMotion}
            materialOverrides={materialOverrides}
            morphOverrides={morphOverrides}
            faceTrackingApply={faceTrackingApply}
            onModelLoaded={onModelLoaded}
          />
        </Suspense>

        <OrbitControls
          enableZoom={cameraPreset === "free"}
          enablePan={false}
          enableRotate={cameraPreset === "free"}
          minDistance={1.5}
          maxDistance={5}
          target={[0, 1.2, 0]}
          maxPolarAngle={Math.PI * 0.65}
          minPolarAngle={Math.PI * 0.25}
        />
      </Canvas>

      {captionsEnabled && captionText && (
        <div
          className="absolute bottom-4 left-4 right-4 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="inline-block bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm max-w-lg mx-auto">
            {captionText}
          </div>
        </div>
      )}
    </div>
  );
});

export default Avatar3D;
