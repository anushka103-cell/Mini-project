/**
 * VRM3DCanvas.js
 *
 * React component for rendering 3D VRM avatars using Three.js.
 * Provides WebGL rendering with lighting, camera controls, and UI overlays.
 * Supports fullscreen mode, first-person perspective, and responsive sizing.
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { usePerformanceMonitor } from "@/lib/performanceOptimizations";

export default function VRM3DCanvas({
  model = null,
  width = 800,
  height = 600,
  showControls = true,
  showGrid = false,
  cameraMode = "orbit", // 'orbit' or 'firstperson'
  autoRotate = false,
  onSceneReady = null,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [renderStats, setRenderStats] = useState({ fps: 0, models: 0 });
  const { markStart, markEnd, getMetrics } = usePerformanceMonitor();

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    scene.fog = new THREE.Fog(0xf0f0f0, 10, 50);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      (containerRef.current?.clientWidth || width) /
        (containerRef.current?.clientHeight || height),
      0.1,
      1000,
    );
    camera.position.set(0, 1, 1.5);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
      containerRef.current?.clientWidth || width,
      containerRef.current?.clientHeight || height,
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMapType;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // Point light for fill
    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // Grid (optional)
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xeeeeee);
      scene.add(gridHelper);
    }

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Orbit controls setup
    if (showControls && cameraMode === "orbit") {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 2;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.minDistance = 0.5;
      controls.maxDistance = 5;
      controls.update();
      controlsRef.current = controls;
    }

    setIsReady(true);
    onSceneReady?.({ scene, camera, renderer });

    // Cleanup
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [
    width,
    height,
    showControls,
    showGrid,
    cameraMode,
    autoRotate,
    onSceneReady,
  ]);

  // Add model to scene
  useEffect(() => {
    if (!model || !sceneRef.current) return;

    const { vrm, scene: vrmScene } = model;

    // Remove previous VRM from scene
    const existingVRM = sceneRef.current.getObjectByProperty("isVRM", true);
    if (existingVRM) {
      sceneRef.current.remove(existingVRM);
    }

    // Add new VRM
    vrmScene.castShadow = true;
    vrmScene.receiveShadow = true;
    vrmScene.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });

    vrmScene.position.y = 0;
    sceneRef.current.add(vrmScene);

    setRenderStats((prev) => ({ ...prev, models: 1 }));

    return () => {
      sceneRef.current?.remove(vrmScene);
    };
  }, [model]);

  // Animation loop
  useEffect(() => {
    if (!isReady || !rendererRef.current) return;

    let frameCount = 0;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      markStart();

      frameCount++;

      // FPS calculation
      if (currentTime - lastTime >= 1000) {
        const metrics = getMetrics();
        setRenderStats((prev) => ({
          ...prev,
          fps: frameCount,
          avgRenderTime: metrics.avgRenderTime.toFixed(2),
          isOptimal: metrics.isAcceptable,
        }));
        frameCount = 0;
        lastTime = currentTime;
      }

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Render
      rendererRef.current.render(sceneRef.current, cameraRef.current);

      markEnd();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isReady, markStart, markEnd, getMetrics]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current)
        return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * Take screenshot
   */
  const takeScreenshot = () => {
    if (!rendererRef.current) return;

    const canvas = rendererRef.current.domElement;
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = `avatar-screenshot-${Date.now()}.png`;
    link.click();
  };

  /**
   * Reset camera
   */
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;

    cameraRef.current.position.set(0, 1, 1.5);
    cameraRef.current.lookAt(0, 1, 0);
    controlsRef.current?.target.set(0, 1, 0);
    controlsRef.current?.update();
  };

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: `${height}px`, minWidth: `${width}px` }}
      />

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-xs font-mono">
        <div>FPS: {renderStats.fps}</div>
        <div>Models: {renderStats.models}</div>
      </div>

      {/* Controls overlay */}
      {showControls && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-xs space-y-1">
          <div>🖱️ Drag to rotate</div>
          <div>🔄 Scroll to zoom</div>
          <div>⎇ Right-click to pan</div>
        </div>
      )}

      {/* Action buttons */}
      <div className="absolute top-4 right-4 space-x-2">
        <button
          onClick={resetCamera}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-xs font-semibold"
          title="Reset camera position"
        >
          Reset View
        </button>
        <button
          onClick={takeScreenshot}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-xs font-semibold"
          title="Take screenshot"
        >
          Screenshot
        </button>
        <button
          onClick={toggleFullscreen}
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-xs font-semibold"
          title="Toggle fullscreen"
        >
          Fullscreen
        </button>
      </div>

      {/* Loading state */}
      {!isReady && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-lg">Loading 3D Scene...</div>
        </div>
      )}

      {/* Error state */}
      {!model && isReady && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-lg">No model loaded</div>
        </div>
      )}
    </div>
  );
}
