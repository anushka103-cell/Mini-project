"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import { Suspense } from "react";

/* Avatar Model Loader */
function AvatarModel({ url }) {
  try {
    const { scene } = useGLTF(url, true);

    if (!scene) return null;

    return <primitive object={scene} scale={2} position={[0, -1, 0]} />;
  } catch (error) {
    console.error("Avatar load error:", error);
    return null;
  }
}

/* Loading Indicator */
function Loader() {
  return (
    <Html center>
      <div style={{ color: "white" }}>Loading Avatar...</div>
    </Html>
  );
}

export default function Avatar3D({ url }) {
  if (!url) {
    return (
      <div
        style={{
          width: "400px",
          height: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          borderRadius: "12px",
        }}
      >
        <p style={{ color: "white" }}>No avatar found</p>
      </div>
    );
  }

  return (
    <div style={{ width: "400px", height: "400px" }}>
      <Canvas camera={{ position: [0, 1.5, 3] }}>
        {/* Lighting */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, 2, 2]} intensity={1} />

        {/* Avatar Model */}
        <Suspense fallback={<Loader />}>
          <AvatarModel url={url} />
        </Suspense>

        {/* Camera Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={2}
          maxDistance={5}
        />
      </Canvas>
    </div>
  );
}
