/**
 * VRMAnimationMapper.js
 *
 * Maps 2D procedural animations and emotions to 3D VRM bone rotations and morph targets.
 * Bridges the gap between 2D Canvas animations and 3D humanoid skeletal animation.
 */

import * as THREE from "three";

class VRMAnimationMapper {
  static instance = null;

  constructor() {
    if (VRMAnimationMapper.instance) {
      return VRMAnimationMapper.instance;
    }

    this.vrm = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.activeClips = new Map();
    this.emotionBlend = {};
    this.headRotation = { x: 0, y: 0, z: 0 };
    this.listeners = new Map();

    // Animation speed multiplier
    this.speed = 1.0;

    // Emotion to morph target mapping
    this.emotionMorphMap = {
      happy: { "vrc.v1:mouth_smile": 1.0, "vrc.v1:eyes_happy": 1.0 },
      sad: { "vrc.v1:mouth_sad": 1.0, "vrc.v1:eyes_sad": 1.0 },
      angry: { "vrc.v1:mouth_angry": 1.0, "vrc.v1:eyes_angry": 1.0 },
      surprised: {
        "vrc.v1:mouth_surprised": 1.0,
        "vrc.v1:eyes_surprised": 1.0,
      },
      neutral: {},
      calm: { "vrc.v1:eyes_relaxed": 0.8 },
      anxious: { "vrc.v1:mouth_worried": 0.7, "vrc.v1:eyes_worried": 0.8 },
      excited: {
        "vrc.v1:mouth_smile": 1.0,
        "vrc.v1:eyes_happy": 1.0,
        "vrc.v1:eyes_wide": 0.8,
      },
    };

    // Head movement bounds (in radians)
    this.headRotationBounds = {
      x: { min: -Math.PI / 4, max: Math.PI / 4 }, // Nod
      y: { min: -Math.PI / 3, max: Math.PI / 3 }, // Look left/right
      z: { min: -Math.PI / 6, max: Math.PI / 6 }, // Tilt
    };

    // Eye gaze mapping
    this.eyeGazeOffsets = {
      lookLeft: { boneRotation: 0.5, morphs: { "vrc.v1:eyes_left": 1.0 } },
      lookRight: { boneRotation: -0.5, morphs: { "vrc.v1:eyes_right": 1.0 } },
      lookUp: { boneRotation: 0.3, morphs: { "vrc.v1:eyes_up": 1.0 } },
      lookDown: { boneRotation: -0.3, morphs: { "vrc.v1:eyes_down": 1.0 } },
    };

    VRMAnimationMapper.instance = this;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!VRMAnimationMapper.instance) {
      VRMAnimationMapper.instance = new VRMAnimationMapper();
    }
    return VRMAnimationMapper.instance;
  }

  /**
   * Initialize mapper with VRM model
   */
  initialize(vrmModel) {
    this.vrm = vrmModel;
    this.mixer = new THREE.AnimationMixer(vrmModel.scene);
    this._emit("initialized", { vrm: vrmModel });
    return this;
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Emit event
   */
  _emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((callback) => callback(data));
  }

  /**
   * Map 2D head animation to 3D rotation
   */
  mapHeadRotation(headX, headY, headTilt = 0, blendFactor = 0.3) {
    if (!this.vrm) return;

    const head = this.vrm.humanoid.getRawBoneNode("head");
    if (!head) return;

    // Normalize inputs (-1 to 1) to rotation bounds
    const targetRotation = new THREE.Euler(
      this._clamp(
        (headX * Math.PI) / 4,
        this.headRotationBounds.x.min,
        this.headRotationBounds.x.max,
      ),
      this._clamp(
        (headY * Math.PI) / 3,
        this.headRotationBounds.y.min,
        this.headRotationBounds.y.max,
      ),
      this._clamp(
        (headTilt * Math.PI) / 6,
        this.headRotationBounds.z.min,
        this.headRotationBounds.z.max,
      ),
      "YXZ",
    );

    // Smooth interpolation
    const currentEuler = new THREE.Euler().setFromQuaternion(
      head.quaternion,
      "YXZ",
    );
    currentEuler.x = THREE.MathUtils.lerp(
      currentEuler.x,
      targetRotation.x,
      blendFactor,
    );
    currentEuler.y = THREE.MathUtils.lerp(
      currentEuler.y,
      targetRotation.y,
      blendFactor,
    );
    currentEuler.z = THREE.MathUtils.lerp(
      currentEuler.z,
      targetRotation.z,
      blendFactor,
    );

    head.quaternion.setFromEuler(currentEuler);
    this.headRotation = {
      x: currentEuler.x,
      y: currentEuler.y,
      z: currentEuler.z,
    };

    this._emit("head-rotated", { rotation: this.headRotation });
  }

  /**
   * Map 2D facial expression to 3D morph targets
   */
  mapEmotion(emotion, intensity = 1.0, blendWithCurrent = true) {
    if (!this.vrm || !this.vrm.morphManager) return;

    const morphMap = this.emotionMorphMap[emotion] || {};
    const morphManager = this.vrm.morphManager;

    // Blend with current emotion
    if (blendWithCurrent) {
      // Smoothly reduce all other emotions
      Object.keys(this.emotionBlend).forEach((morph) => {
        if (!morphMap[morph]) {
          morphManager.setWeight(morph, this.emotionBlend[morph] * 0.7);
        }
      });
    }

    // Apply new emotion morphs
    Object.entries(morphMap).forEach(([morphName, value]) => {
      const targetWeight = value * intensity;
      morphManager.setWeight(morphName, targetWeight);
      this.emotionBlend[morphName] = targetWeight;
    });

    this._emit("emotion-mapped", { emotion, intensity, morphs: morphMap });
  }

  /**
   * Map eye gaze direction
   */
  mapEyeGaze(direction, intensity = 1.0) {
    if (!this.vrm || !this.vrm.morphManager) return;

    const gazeOffset = this.eyeGazeOffsets[direction];
    if (!gazeOffset) return;

    const morphManager = this.vrm.morphManager;
    const leftEye = this.vrm.humanoid.getRawBoneNode("leftEye");
    const rightEye = this.vrm.humanoid.getRawBoneNode("rightEye");

    // Apply morph targets
    Object.entries(gazeOffset.morphs).forEach(([morphName, value]) => {
      morphManager.setWeight(morphName, value * intensity);
    });

    // Apply bone rotation
    if (leftEye && rightEye) {
      const eyeRotation = new THREE.Euler(
        0,
        gazeOffset.boneRotation * intensity,
        0,
      );
      leftEye.quaternion.setFromEuler(eyeRotation);
      rightEye.quaternion.setFromEuler(eyeRotation);
    }

    this._emit("gaze-mapped", { direction, intensity });
  }

  /**
   * Blend multiple emotions (for complex emotional states)
   */
  blendEmotions(emotionWeights, blendDuration = 0.3) {
    if (!this.vrm) return;

    // Reset all morphs
    if (this.vrm.morphManager) {
      this.vrm.morphManager.resetWeight();
    }

    // Apply blended emotions
    Object.entries(emotionWeights).forEach(([emotion, weight]) => {
      this.mapEmotion(emotion, weight, false);
    });

    this._emit("emotions-blended", { weights: emotionWeights });
  }

  /**
   * Play idle animation
   */
  playIdleAnimation() {
    if (!this.vrm) return;

    // Simple idle breathing animation
    const idleAnimation = this._createBreathingAnimation();
    const action = this.mixer.clipAction(idleAnimation);
    action.play();

    this._emit("animation-played", { name: "idle" });
  }

  /**
   * Play gesture animation
   */
  playGestureAnimation(gestureName, duration = 1.0) {
    if (!this.mixer) return;

    const gestureClip = this._createGestureAnimation(gestureName, duration);
    if (!gestureClip) return;

    const action = this.mixer.clipAction(gestureClip);
    action.clampWhenFinished = true;
    action.play();

    this.activeClips.set(gestureName, action);

    this._emit("gesture-played", { name: gestureName });

    return () => {
      action.stop();
      this.activeClips.delete(gestureName);
    };
  }

  /**
   * Stop animation
   */
  stopAnimation(name = null) {
    if (name) {
      const action = this.activeClips.get(name);
      if (action) {
        action.stop();
        this.activeClips.delete(name);
      }
    } else {
      this.mixer?.stopAllAction();
      this.activeClips.clear();
    }

    this._emit("animation-stopped", { name });
  }

  /**
   * Update animations (call per frame)
   */
  update(deltaTime = null) {
    if (!this.mixer) return;

    if (deltaTime === null) {
      deltaTime = this.clock.getDelta();
    }

    this.mixer.update(deltaTime * this.speed);
    this.vrm?.update(deltaTime);
  }

  /**
   * Create breathing animation
   */
  _createBreathingAnimation() {
    const duration = 4;
    const chestBone = this.vrm?.humanoid?.getRawBoneNode("chest");

    if (!chestBone) {
      return new THREE.AnimationClip("breathing", duration, []);
    }

    const positionTrack = new THREE.VectorKeyframeTrack(
      `${chestBone.name}.position`,
      [0, duration / 2, duration],
      [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
    );

    return new THREE.AnimationClip("breathing", duration, [positionTrack]);
  }

  /**
   * Create gesture animation
   */
  _createGestureAnimation(gestureName, duration) {
    const rightArm = this.vrm?.humanoid?.getRawBoneNode("rightUpperArm");
    if (!rightArm) return null;

    let tracks = [];

    switch (gestureName) {
      case "wave": {
        const rotationTrack = new THREE.QuaternionKeyframeTrack(
          `${rightArm.name}.quaternion`,
          [0, duration / 2, duration],
          [0, 0, 0, 1, 0.707, 0, 0.707, 0, 0, 0, 0, 1],
        );
        tracks.push(rotationTrack);
        break;
      }
      case "thumbsup": {
        const positionTrack = new THREE.VectorKeyframeTrack(
          `${rightArm.name}.position`,
          [0, duration],
          [0, 0, 0, 0, 0.3, 0],
        );
        tracks.push(positionTrack);
        break;
      }
      case "point": {
        const rotationTrack = new THREE.QuaternionKeyframeTrack(
          `${rightArm.name}.quaternion`,
          [0, duration],
          [0, 0, 0, 1, 0.5, 0.5, 0, 0.707],
        );
        tracks.push(rotationTrack);
        break;
      }
    }

    return new THREE.AnimationClip(gestureName, duration, tracks);
  }

  /**
   * Set animation speed
   */
  setAnimationSpeed(speed) {
    this.speed = Math.max(0.1, Math.min(speed, 3.0));
    this._emit("speed-changed", { speed: this.speed });
  }

  /**
   * Helper: clamp value
   */
  _clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  /**
   * Get current state
   */
  getState() {
    return {
      initialized: this.vrm !== null,
      headRotation: { ...this.headRotation },
      activeAnimations: Array.from(this.activeClips.keys()),
      emotionBlend: { ...this.emotionBlend },
      speed: this.speed,
    };
  }

  /**
   * Dispose resources
   */
  dispose() {
    if (this.mixer) {
      this.mixer.uncacheRoot(this.vrm.scene);
      this.mixer = null;
    }
    this.vrm = null;
    this.activeClips.clear();
    this.emotionBlend = {};
  }
}

export default VRMAnimationMapper;

/**
 * Helper function for singleton access
 */
export function getVRMAnimationMapper() {
  return VRMAnimationMapper.getInstance();
}
