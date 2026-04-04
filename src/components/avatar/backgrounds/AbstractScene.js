"use client";

import React, { useEffect, useRef } from "react";

/**
 * Abstract Background Scene
 * Modern gradient background with geometric shapes and subtle animations
 */
export default function AbstractScene({
  parallaxOffset = 0,
  lightingIntensity = 0.7,
  width = 800,
  height = 600,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const time = Date.now() / 1000;

    // Main gradient background - dark with vibrant accents
    const mainGradient = ctx.createLinearGradient(0, 0, width, height);
    mainGradient.addColorStop(0, "#1F1F3D");
    mainGradient.addColorStop(0.5, "#2D2D5F");
    mainGradient.addColorStop(1, "#1A1A2E");
    ctx.fillStyle = mainGradient;
    ctx.fillRect(0, 0, width, height);

    // Animated gradient wash
    const washGradient = ctx.createLinearGradient(
      0,
      0,
      width * Math.cos(time * 0.3),
      height * Math.sin(time * 0.3),
    );
    washGradient.addColorStop(
      0,
      `rgba(107, 76, 225, ${0.08 * lightingIntensity})`,
    );
    washGradient.addColorStop(
      0.5,
      `rgba(100, 150, 255, ${0.04 * lightingIntensity})`,
    );
    washGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = washGradient;
    ctx.fillRect(0, 0, width, height);

    // Animated geometric shapes (low parallax layer)
    const drawGeometricLayer = (layer) => {
      const shapes = [
        { x: 0.2, y: 0.3, size: 200, rotation: time * 0.2 + layer * 0.5 },
        { x: 0.8, y: 0.2, size: 150, rotation: time * -0.15 + layer * 0.7 },
        { x: 0.3, y: 0.75, size: 180, rotation: time * 0.25 + layer * 0.3 },
        { x: 0.75, y: 0.65, size: 120, rotation: time * -0.2 + layer * 0.6 },
      ];

      shapes.forEach((shape, idx) => {
        const actualX = width * shape.x + parallaxOffset * 0.15;
        const actualY = height * shape.y;
        const opacity = 0.08 * lightingIntensity - layer * 0.02;

        // Determine color based on layer
        const colors = [
          `rgba(107, 76, 225, ${opacity})`,
          `rgba(75, 192, 192, ${opacity})`,
          `rgba(255, 100, 150, ${opacity})`,
          `rgba(255, 206, 86, ${opacity})`,
        ];

        ctx.save();
        ctx.translate(actualX, actualY);
        ctx.rotate(shape.rotation);

        if (idx % 3 === 0) {
          // Triangle
          ctx.fillStyle = colors[idx % colors.length];
          ctx.beginPath();
          ctx.moveTo(0, -shape.size / 2);
          ctx.lineTo(-shape.size / 2, shape.size / 2);
          ctx.lineTo(shape.size / 2, shape.size / 2);
          ctx.closePath();
          ctx.fill();
        } else if (idx % 3 === 1) {
          // Square
          ctx.fillStyle = colors[idx % colors.length];
          ctx.fillRect(
            -shape.size / 2,
            -shape.size / 2,
            shape.size,
            shape.size,
          );
        } else {
          // Circle
          ctx.fillStyle = colors[idx % colors.length];
          ctx.beginPath();
          ctx.arc(0, 0, shape.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    };

    drawGeometricLayer(0);
    drawGeometricLayer(1);

    // Animated grid background
    ctx.strokeStyle = "rgba(107, 76, 225, 0.1)";
    ctx.lineWidth = 0.5;

    const gridSize = 60;
    const gridOffsetX = (parallaxOffset * 0.3) % gridSize;

    for (let x = -gridSize + gridOffsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Glowing orbs (animated focus points)
    const orbs = [
      { x: 0.15, y: 0.2, baseSize: 15, color: "rgba(107, 76, 225, 0.3)" },
      { x: 0.85, y: 0.75, baseSize: 20, color: "rgba(75, 192, 192, 0.3)" },
      { x: 0.5, y: 0.5, baseSize: 25, color: "rgba(255, 100, 150, 0.25)" },
    ];

    orbs.forEach((orb, idx) => {
      const orbX = width * orb.x + parallaxOffset * 0.2;
      const orbY = height * orb.y + Math.sin(time * 1.5 + idx) * 15;

      // Glow radius
      const glowRadius = orb.baseSize + Math.sin(time * 2 + idx * 0.8) * 10;

      const orbGradient = ctx.createRadialGradient(
        orbX,
        orbY,
        0,
        orbX,
        orbY,
        glowRadius * 2,
      );
      orbGradient.addColorStop(0, orb.color);
      orbGradient.addColorStop(0.5, orb.color.replace("0.3", "0.1"));
      orbGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = orbGradient;
      ctx.fillRect(
        orbX - glowRadius * 2,
        orbY - glowRadius * 2,
        glowRadius * 4,
        glowRadius * 4,
      );

      // Orb core
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.arc(orbX, orbY, orb.baseSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Light trails (very subtle)
    for (let i = 0; i < 3; i++) {
      const trailX = width * 0.5 + Math.sin(time * 0.5 + i * 2) * 150;
      const trailY = height * 0.5 + Math.cos(time * 0.3 + i * 1.5) * 100;

      ctx.strokeStyle = `rgba(107, 150, 225, ${0.03 * lightingIntensity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(trailX, trailY, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Top accent bar with animation
    const accentGradient = ctx.createLinearGradient(0, 0, width, 0);
    const accentOffset = (parallaxOffset * 2) % width;
    accentGradient.addColorStop(0, "rgba(107, 76, 225, 0)");
    accentGradient.addColorStop(
      ((accentOffset % width) / width) * 0.5,
      `rgba(107, 76, 225, ${0.2 * lightingIntensity})`,
    );
    accentGradient.addColorStop(
      (accentOffset / width) * 0.5 + 0.2,
      `rgba(100, 150, 255, ${0.15 * lightingIntensity})`,
    );
    accentGradient.addColorStop(1, "rgba(107, 76, 225, 0)");

    ctx.fillStyle = accentGradient;
    ctx.fillRect(0, 0, width, 3);

    // Bottom accent bar
    ctx.fillRect(0, height - 3, width, 3);

    // Draw dynamic shadow under avatar (abstract lighting)
    const shadowGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.7,
      50,
      width / 2,
      height * 0.7,
      140,
    );
    shadowGradient.addColorStop(0, "rgba(107, 76, 225, 0.15)");
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shadowGradient;
    ctx.fillRect(0, height * 0.65, width, 120);
  }, [parallaxOffset, lightingIntensity, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full"
    />
  );
}
