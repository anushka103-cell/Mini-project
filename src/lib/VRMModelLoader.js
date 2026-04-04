/**
 * VRMModelLoader.js
 *
 * Singleton class for loading, managing, and caching VRM models.
 * Handles model lifecycle, metadata extraction, and pre-loading optimization.
 *
 * Supports loading from:
 * - Public directory: /public/avatars/
 * - Remote URLs (CORS-enabled)
 * - Blob data
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

class VRMModelLoader {
  static instance = null;

  constructor() {
    if (VRMModelLoader.instance) {
      return VRMModelLoader.instance;
    }

    this.loader = new GLTFLoader();
    this.loader.register((vrm) => new VRMLoaderPlugin(vrm));

    this.modelCache = new Map();
    this.loadingQueue = new Map();
    this.models = [];
    this.currentModel = null;
    this.listeners = new Map();

    // Available VRM models
    this.availableModels = [
      {
        id: "avatar-sample",
        name: "Avatar Sample",
        path: "/avatars/AvatarSample.vrm",
        type: "humanoid",
        description: "Base humanoid character",
      },
      {
        id: "expr-avatar-1",
        name: "Expression Avatar 1",
        path: "/avatars/ExprAvatar1.vrm",
        type: "expressive",
        description: "Avatar with rich facial expressions",
      },
      {
        id: "expr-avatar-2",
        name: "Expression Avatar 2",
        path: "/avatars/ExprAvatar2.vrm",
        type: "expressive",
        description: "Alternative expressive avatar",
      },
      {
        id: "seed-san",
        name: "Seed-san",
        path: "/avatars/Seed-san.vrm",
        type: "anime",
        description: "Anime-style character",
      },
    ];

    VRMModelLoader.instance = this;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!VRMModelLoader.instance) {
      VRMModelLoader.instance = new VRMModelLoader();
    }
    return VRMModelLoader.instance;
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
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event
   */
  _emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((callback) => callback(data));
  }

  /**
   * Load VRM model from path
   */
  async load(modelPath, modelId = null) {
    try {
      // Check cache first
      if (this.modelCache.has(modelPath)) {
        this._emit("cached", {
          path: modelPath,
          model: this.modelCache.get(modelPath),
        });
        return this.modelCache.get(modelPath);
      }

      // Check if already loading
      if (this.loadingQueue.has(modelPath)) {
        return this.loadingQueue.get(modelPath);
      }

      // Start loading
      this._emit("start", { path: modelPath });

      const loadPromise = new Promise((resolve, reject) => {
        this.loader.load(
          modelPath,
          (gltf) => {
            const vrm = gltf.userData.vrm;

            if (!vrm) {
              throw new Error("VRM plugin failed to load");
            }

            // Set up VRM
            VRMUtils.rotateVRM0(vrm);

            // Cache model
            const modelData = {
              vrm,
              gltf,
              path: modelPath,
              id: modelId,
              loadedAt: Date.now(),
              metadata: this._extractMetadata(vrm),
              animations: this._extractAnimations(gltf),
              morphTargets: this._extractMorphTargets(vrm),
              bones: this._extractBones(vrm),
            };

            this.modelCache.set(modelPath, modelData);
            this.models.push(modelData);

            this._emit("loaded", modelData);
            resolve(modelData);
          },
          (progress) => {
            this._emit("progress", { path: modelPath, progress });
          },
          (error) => {
            this._emit("error", { path: modelPath, error });
            reject(error);
          },
        );
      });

      this.loadingQueue.set(modelPath, loadPromise);

      const result = await loadPromise;
      this.loadingQueue.delete(modelPath);
      return result;
    } catch (error) {
      this._emit("error", { error });
      throw error;
    }
  }

  /**
   * Load model by ID from available models
   */
  async loadById(modelId) {
    const modelInfo = this.availableModels.find((m) => m.id === modelId);
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found`);
    }
    return this.load(modelInfo.path, modelId);
  }

  /**
   * Set current active model
   */
  setCurrentModel(modelData) {
    this.currentModel = modelData;
    this._emit("current-changed", modelData);
  }

  /**
   * Get current active model
   */
  getCurrentModel() {
    return this.currentModel;
  }

  /**
   * Get available models list
   */
  getAvailableModels() {
    return this.availableModels;
  }

  /**
   * Get loaded models
   */
  getLoadedModels() {
    return this.models;
  }

  /**
   * Get cached model
   */
  getCachedModel(modelPath) {
    return this.modelCache.get(modelPath);
  }

  /**
   * Preload multiple models
   */
  async preloadModels(modelIds) {
    const promises = modelIds.map((id) => this.loadById(id));
    return Promise.all(promises);
  }

  /**
   * Clear model cache
   */
  clearCache() {
    this.modelCache.forEach((model) => {
      this._disposeModel(model);
    });
    this.modelCache.clear();
    this.models = [];
    this.currentModel = null;
    this._emit("cache-cleared", {});
  }

  /**
   * Clear specific model cache
   */
  clearModelCache(modelPath) {
    const model = this.modelCache.get(modelPath);
    if (model) {
      this._disposeModel(model);
      this.modelCache.delete(modelPath);
      this.models = this.models.filter((m) => m.path !== modelPath);
      if (this.currentModel?.path === modelPath) {
        this.currentModel = null;
      }
    }
  }

  /**
   * Extract VRM metadata
   */
  _extractMetadata(vrm) {
    const humanoid = vrm.humanoid;
    const meta = vrm.meta;

    // Handle humanBones - could be array, map, or object
    let bonesCount = 0;
    if (humanoid?.humanBones) {
      if (Array.isArray(humanoid.humanBones)) {
        bonesCount = humanoid.humanBones.length;
      } else if (humanoid.humanBones instanceof Map) {
        bonesCount = humanoid.humanBones.size;
      } else if (typeof humanoid.humanBones === "object") {
        bonesCount = Object.keys(humanoid.humanBones).length;
      }
    }

    // Handle morphTargets - could be array, map, or object
    let morphTargetsCount = 0;
    if (vrm.morphManager?.morphTargetBindings) {
      if (Array.isArray(vrm.morphManager.morphTargetBindings)) {
        morphTargetsCount = vrm.morphManager.morphTargetBindings.length;
      } else if (vrm.morphManager.morphTargetBindings instanceof Map) {
        morphTargetsCount = vrm.morphManager.morphTargetBindings.size;
      } else if (typeof vrm.morphManager.morphTargetBindings === "object") {
        morphTargetsCount = Object.keys(
          vrm.morphManager.morphTargetBindings,
        ).length;
      }
    }

    return {
      title: meta?.title || "Unknown",
      author: meta?.author || "Unknown",
      version: meta?.version || "Unknown",
      thumbnail: meta?.thumbnail || null,
      licenseUrl: meta?.licenseUrl || null,
      bonesCount,
      morphTargetsCount,
    };
  }

  /**
   * Extract animations from GLTF
   */
  _extractAnimations(gltf) {
    if (!gltf.animations || gltf.animations.length === 0) {
      return [];
    }

    return gltf.animations.map((anim) => ({
      name: anim.name,
      duration: anim.duration,
      tracks: anim.tracks.length,
    }));
  }

  /**
   * Extract morph targets
   */
  _extractMorphTargets(vrm) {
    const morphManager = vrm.morphManager;
    if (!morphManager || !morphManager.morphTargetBindings) return [];

    try {
      if (Array.isArray(morphManager.morphTargetBindings)) {
        return morphManager.morphTargetBindings.map((binding) => ({
          name: binding.morphTargetName,
          weight: binding.weight || 0,
        }));
      } else if (morphManager.morphTargetBindings instanceof Map) {
        const result = [];
        morphManager.morphTargetBindings.forEach((binding) => {
          result.push({
            name: binding.morphTargetName || "unknown",
            weight: binding.weight || 0,
          });
        });
        return result;
      }
    } catch (err) {
      console.warn("Error extracting morph targets:", err);
    }
    return [];
  }

  /**
   * Extract bones structure
   */
  _extractBones(vrm) {
    const humanoid = vrm.humanoid;
    if (!humanoid || !humanoid.humanBones) return [];

    try {
      if (Array.isArray(humanoid.humanBones)) {
        return humanoid.humanBones.map((bone) => ({
          name: bone.node?.name || "unknown",
          type: bone.type || "unknown",
          position: { ...(bone.node?.position || {}) },
        }));
      } else if (humanoid.humanBones instanceof Map) {
        const result = [];
        humanoid.humanBones.forEach((bone) => {
          result.push({
            name: bone.node?.name || "unknown",
            type: bone.type || "unknown",
            position: { ...(bone.node?.position || {}) },
          });
        });
        return result;
      }
    } catch (err) {
      console.warn("Error extracting bones:", err);
    }
    return [];
  }

  /**
   * Dispose model resources
   */
  _disposeModel(model) {
    if (!model) return;

    const scene = model.vrm.scene;
    if (scene) {
      scene.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }

  /**
   * Get loader state
   */
  getState() {
    return {
      loaded: this.models.length,
      cached: this.modelCache.size,
      loading: this.loadingQueue.size,
      current: this.currentModel?.id || null,
      available: this.availableModels.length,
    };
  }

  /**
   * Validate VRM model
   */
  isValidVRM(model) {
    return model && model.vrm && model.vrm.humanoid && model.vrm.scene;
  }
}

export default VRMModelLoader;

/**
 * Helper function for singleton access
 */
export function getVRMModelLoader() {
  return VRMModelLoader.getInstance();
}
