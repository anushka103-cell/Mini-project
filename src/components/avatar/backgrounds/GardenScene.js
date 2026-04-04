"use client";

import React, { useEffect, useRef } from "react";

/**
 * Garden Background Scene
 * Natural outdoor environment with plants, natural lighting, and parallax foliage
 */
export default function GardenScene({
  parallaxOffset = 0,
  lightingIntensity = 1.0,
  width = 800,
  height = 600,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const time = Date.now() / 1000;

    // Sky gradient - natural daylight
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
    skyGradient.addColorStop(0, "#87CEEB");
    skyGradient.addColorStop(1, "#E0F6FF");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.6);

    // Bright natural lighting from sky
    const skyLight = ctx.createRadialGradient(
      width / 2,
      height * 0.1,
      100,
      width / 2,
      height * 0.1,
      width,
    );
    skyLight.addColorStop(0, `rgba(255, 255, 200, ${0.2 * lightingIntensity})`);
    skyLight.addColorStop(
      0.5,
      `rgba(200, 220, 255, ${0.1 * lightingIntensity})`,
    );
    skyLight.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = skyLight;
    ctx.fillRect(0, 0, width, height);

    // Clouds with parallax
    const drawClouds = (offset, opacity, scale) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * opacity})`;
      const cloudY = height * 0.15;

      for (let i = 0; i < 3; i++) {
        const cloudX = ((i * 300 + offset * scale) % (width + 200)) - 100;
        ctx.beginPath();
        ctx.ellipse(cloudX, cloudY - i * 40, 40, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cloudX + 30, cloudY - i * 40, 50, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cloudX + 65, cloudY - i * 40, 35, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawClouds(parallaxOffset, 1, 0.1);

    // Ground with grass gradient
    const groundGradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
    groundGradient.addColorStop(0, "#90EE90");
    groundGradient.addColorStop(0.4, "#7FBF7F");
    groundGradient.addColorStop(1, "#6B8E6B");
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    // Grass texture with parallax
    ctx.strokeStyle = "rgba(34, 139, 34, 0.3)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 200; i++) {
      const x =
        ((i * 6 + parallaxOffset * 0.5) % width) - parallaxOffset * 0.05;
      const y = height * 0.5 + Math.sin(i * 0.3) * 15;
      const height_grass = 20 + Math.sin(i * 0.5) * 10;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - height_grass);
      ctx.stroke();
    }

    // Back bushes (far parallax layer)
    const drawBushes = (yPos, parallaxScale, opacity, sizeScale) => {
      for (let i = 0; i < 5; i++) {
        const bushX =
          (i * 180 + parallaxOffset * parallaxScale * 0.3) % (width + 100);
        ctx.fillStyle = `rgba(34, 139, 34, ${0.6 * opacity})`;

        // Main bush shape
        ctx.beginPath();
        ctx.ellipse(
          bushX,
          yPos,
          25 * sizeScale,
          20 * sizeScale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(
          bushX + 20,
          yPos - 10,
          20 * sizeScale,
          18 * sizeScale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        // Lighter highlights on bush
        ctx.fillStyle = `rgba(144, 238, 144, ${0.3 * opacity})`;
        ctx.beginPath();
        ctx.ellipse(
          bushX - 8,
          yPos - 8,
          10 * sizeScale,
          8 * sizeScale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    };

    drawBushes(height * 0.45, 0.2, 0.8, 0.8);

    // Front bushes (near parallax layer)
    drawBushes(height * 0.65, 0.5, 1, 1);

    // Flowers
    const drawFlowers = (yPos, opacity) => {
      for (let i = 0; i < 8; i++) {
        const flowerX = (i * 100 + ((parallaxOffset * 0.3) % 100)) % width;
        const flowerY = yPos + Math.sin(i * 0.5) * 10;

        // Flower stem
        ctx.strokeStyle = `rgba(34, 139, 34, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(flowerX, flowerY + 15);
        ctx.lineTo(flowerX, flowerY);
        ctx.stroke();

        // Petals
        const colors = ["#FF69B4", "#FFB6C1", "#FF1493", "#FFE4E1"];
        ctx.fillStyle = colors[i % colors.length];

        for (let petal = 0; petal < 5; petal++) {
          const angle = (petal / 5) * Math.PI * 2;
          const petalX = flowerX + Math.cos(angle) * 8;
          const petalY = flowerY + Math.sin(angle) * 8;

          ctx.beginPath();
          ctx.ellipse(petalX, petalY, 4, 6, angle, 0, Math.PI * 2);
          ctx.fill();
        }

        // Center
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.arc(flowerX, flowerY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawFlowers(height * 0.62, 0.9);

    // Tree (far left)
    const treeX = width * 0.15;
    const treeY = height * 0.4;

    // Trunk
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(treeX - 8, treeY, 16, 120);

    // Foliage
    ctx.fillStyle = "#228B22";
    ctx.beginPath();
    ctx.ellipse(treeX, treeY - 40, 50, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2E8B57";
    ctx.beginPath();
    ctx.ellipse(treeX - 25, treeY - 20, 35, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(treeX + 25, treeY - 25, 40, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tree highlight
    ctx.fillStyle = "rgba(144, 238, 144, 0.3)";
    ctx.beginPath();
    ctx.ellipse(treeX - 20, treeY - 35, 25, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Butterfly with animation (subtle parallax)
    const butterfly = {
      x: width * 0.7 + Math.sin(time * 1.2) * 20,
      y: height * 0.35 + Math.cos(time * 1.5) * 15,
    };

    ctx.fillStyle = "rgba(255, 165, 0, 0.8)";
    ctx.beginPath();
    ctx.ellipse(butterfly.x - 8, butterfly.y, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(butterfly.x + 8, butterfly.y, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Butterfly antennae
    ctx.strokeStyle = "rgba(255, 165, 0, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(butterfly.x, butterfly.y - 5);
    ctx.lineTo(butterfly.x - 3, butterfly.y - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(butterfly.x, butterfly.y - 5);
    ctx.lineTo(butterfly.x + 3, butterfly.y - 12);
    ctx.stroke();

    // Draw dynamic shadow under avatar (natural lighting)
    const shadowGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.72,
      45,
      width / 2,
      height * 0.72,
      130,
    );
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.1)");
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
