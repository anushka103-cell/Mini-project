/**
 * useVRMAvatar.js
 *
 * React hook for managing 3D VRM avatar state.
 * Integrates VRM model loading, animation mapping, and emotion control.
 * Bridges VRM backend with React component lifecycle.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getVRMModelLoader } from "@/lib/VRMModelLoader";
import { getVRMAnimationMapper } from "@/lib/VRMAnimationMapper";

export default function useVRMAvatar() {
  // Model state
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);

  // Animation state
  const [currentEmotion, setCurrentEmotion] = useState("neutral");
  const [emotionIntensity, setEmotionIntensity] = useState(1.0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeAnimations, setActiveAnimations] = useState([]);

  // Animation parameters
  const [headX, setHeadX] = useState(0);
  const [headY, setHeadY] = useState(0);
  const [headTilt, setHeadTilt] = useState(0);
  const [eyeGaze, setEyeGaze] = useState("center");

  // Configuration
  const [speed, setSpeedState] = useState(1.0);
  const [autoIdle, setAutoIdle] = useState(true);

  // Refs
  const loaderRef = useRef(null);
  const mapperRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

  // Initialize loaders
  useEffect(() => {
    loaderRef.current = getVRMModelLoader();
    mapperRef.current = getVRMAnimationMapper();

    // Set available models
    setAvailableModels(loaderRef.current.getAvailableModels());

    // Set up listeners
    const onLoaded = (data) => {
      setModel(data);
      mapperRef.current.initialize(data.vrm);
      if (autoIdle) {
        mapperRef.current.playIdleAnimation();
      }
      setModelLoading(false);
    };

    const onError = (data) => {
      setModelError(data.error?.message || "Failed to load model");
      setModelLoading(false);
    };

    loaderRef.current.on("loaded", onLoaded);
    loaderRef.current.on("error", onError);

    return () => {
      loaderRef.current.off("loaded", onLoaded);
      loaderRef.current.off("error", onError);
    };
  }, [autoIdle]);

  /**
   * Load model by ID
   */
  const loadModelById = useCallback(
    async (modelId) => {
      if (modelLoading) return;

      setModelLoading(true);
      setModelError(null);

      try {
        const modelData = await loaderRef.current.loadById(modelId);
        loaderRef.current.setCurrentModel(modelData);
        setModel(modelData);

        // Initialize mapper with new model
        mapperRef.current.initialize(modelData.vrm);

        // Start idle animation
        if (autoIdle) {
          mapperRef.current.playIdleAnimation();
        }

        setModelLoading(false);
      } catch (error) {
        setModelError(error.message);
        setModelLoading(false);
      }
    },
    [autoIdle, modelLoading],
  );

  /**
   * Load model from path
   */
  const loadModel = useCallback(
    async (path) => {
      if (modelLoading) return;

      setModelLoading(true);
      setModelError(null);

      try {
        const modelData = await loaderRef.current.load(path);
        setModel(modelData);
        mapperRef.current.initialize(modelData.vrm);

        if (autoIdle) {
          mapperRef.current.playIdleAnimation();
        }

        setModelLoading(false);
      } catch (error) {
        setModelError(error.message);
        setModelLoading(false);
      }
    },
    [autoIdle, modelLoading],
  );

  /**
   * Update emotion
   */
  const updateEmotion = useCallback(
    (emotion, intensity = 1.0, blend = true) => {
      if (!model) return;

      setCurrentEmotion(emotion);
      setEmotionIntensity(intensity);

      mapperRef.current.mapEmotion(emotion, intensity, blend);
    },
    [model],
  );

  /**
   * Blend multiple emotions
   */
  const blendEmotions = useCallback(
    (emotionWeights) => {
      if (!model) return;

      mapperRef.current.blendEmotions(emotionWeights);
    },
    [model],
  );

  /**
   * Set head rotation
   */
  const setHeadRotation = useCallback(
    (x, y, tilt = 0) => {
      if (!model) return;

      setHeadX(x);
      setHeadY(y);
      setHeadTilt(tilt);

      mapperRef.current.mapHeadRotation(x, y, tilt);
    },
    [model],
  );

  /**
   * Set eye gaze direction
   */
  const setGaze = useCallback(
    (direction, intensity = 1.0) => {
      if (!model) return;

      setEyeGaze(direction);
      mapperRef.current.mapEyeGaze(direction, intensity);
    },
    [model],
  );

  /**
   * Play gesture
   */
  const playGesture = useCallback(
    (gestureName, duration = 1.0) => {
      if (!model || !mapperRef.current) return;

      const stop = mapperRef.current.playGestureAnimation(
        gestureName,
        duration,
      );
      setActiveAnimations((prev) => [...prev, gestureName]);

      // Auto-remove from list after animation
      setTimeout(() => {
        setActiveAnimations((prev) => prev.filter((g) => g !== gestureName));
      }, duration * 1000);

      return stop;
    },
    [model],
  );

  /**
   * Play idle animation
   */
  const playIdle = useCallback(() => {
    if (!model) return;
    mapperRef.current.playIdleAnimation();
    setIsAnimating(true);
  }, [model]);

  /**
   * Stop all animations
   */
  const stopAnimations = useCallback(() => {
    if (!mapperRef.current) return;
    mapperRef.current.stopAnimation();
    setIsAnimating(false);
    setActiveAnimations([]);
  }, []);

  /**
   * Set animation speed
   */
  const setSpeed = useCallback((newSpeed) => {
    const clamped = Math.max(0.1, Math.min(newSpeed, 3.0));
    setSpeedState(clamped);

    if (mapperRef.current) {
      mapperRef.current.setAnimationSpeed(clamped);
    }
  }, []);

  /**
   * Get avatar state snapshot
   */
  const getState = useCallback(() => {
    return {
      model: model
        ? {
            id: model.id,
            path: model.path,
            metadata: model.metadata,
          }
        : null,
      animation: {
        emotion: currentEmotion,
        intensity: emotionIntensity,
        head: { x: headX, y: headY, z: headTilt },
        gaze: eyeGaze,
        activeAnimations,
        speed,
        isAnimating,
      },
      mapper: mapperRef.current?.getState(),
    };
  }, [
    model,
    currentEmotion,
    emotionIntensity,
    headX,
    headY,
    headTilt,
    eyeGaze,
    activeAnimations,
    speed,
    isAnimating,
  ]);

  /**
   * Animation loop
   */
  useEffect(() => {
    if (!model || !mapperRef.current) return;

    const updateAnimation = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      mapperRef.current.update(deltaTime);

      animationFrameRef.current = requestAnimationFrame(updateAnimation);
    };

    animationFrameRef.current = requestAnimationFrame(updateAnimation);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [model]);

  /**
   * Test avatar with sequence
   */
  const testAvatar = useCallback(async () => {
    if (!model) return;

    const emotions = ["happy", "calm", "sad", "excited", "neutral"];

    for (let i = 0; i < emotions.length; i++) {
      updateEmotion(emotions[i], 1.0);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    playGesture("wave", 1.0);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    updateEmotion("neutral", 0);
    playIdle();
  }, [model, updateEmotion, playGesture, playIdle]);

  /**
   * Dispose resources
   */
  const dispose = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    mapperRef.current?.dispose();
    loaderRef.current?.clearCache();
  }, []);

  return {
    // Model management
    model,
    modelLoading,
    modelError,
    availableModels,
    loadModel,
    loadModelById,

    // Animation state
    currentEmotion,
    emotionIntensity,
    headRotation: { x: headX, y: headY, z: headTilt },
    eyeGaze,
    isAnimating,
    activeAnimations,
    speed,

    // Animation control
    updateEmotion,
    blendEmotions,
    setHeadRotation,
    setGaze,
    playGesture,
    playIdle,
    stopAnimations,
    setSpeed,

    // Configuration
    autoIdle,
    setAutoIdle,

    // Utilities
    getState,
    testAvatar,
    dispose,
  };
}
