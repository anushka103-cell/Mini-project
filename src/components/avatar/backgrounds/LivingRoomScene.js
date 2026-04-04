"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * LivingRoom Background Scene
 * Warm, cozy environment with furniture silhouettes and warm lighting
 */
export default function LivingRoomScene({
  parallaxOffset = 0,
  lightingIntensity = 0.8,
  width = 800,
  height = 600,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const time = Date.now() / 1000;

    // Clear canvas with background gradient
    const gradientBg = ctx.createLinearGradient(0, 0, 0, height);
    gradientBg.addColorStop(0, "#F5D5B8");
    gradientBg.addColorStop(0.5, "#E8D4C0");
    gradientBg.addColorStop(1, "#D4B8A1");
    ctx.fillStyle = gradientBg;
    ctx.fillRect(0, 0, width, height);

    // Draw warm overhead illumination effect
    const lightGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.2,
      100,
      width / 2,
      height * 0.2,
      width * 0.8,
    );
    lightGradient.addColorStop(
      0,
      `rgba(255, 200, 100, ${0.15 * lightingIntensity})`,
    );
    lightGradient.addColorStop(
      0.5,
      `rgba(255, 150, 80, ${0.08 * lightingIntensity})`,
    );
    lightGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lightGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw floor with subtle pattern
    ctx.fillStyle = "#A88C6B";
    ctx.fillRect(0, height * 0.6, width, height * 0.4);

    // Add subtle wood grain effect with parallax
    for (let i = 0; i < 15; i++) {
      const yPos = height * 0.6 + (i * (height * 0.4)) / 15;
      const xOffset = (parallaxOffset * 0.3) % (width * 0.5);
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.03 * (1 + i * 0.05)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-xOffset, yPos);
      ctx.lineTo(width - xOffset, yPos + 10);
      ctx.stroke();
    }

    // Draw couch (dark silhouette with warm shadow)
    const couchX = width * 0.15;
    const couchY = height * 0.55;

    // Couch shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.ellipse(couchX + 80, couchY + 130, 100, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Couch body
    ctx.fillStyle = "#4A3F35";
    ctx.fillRect(couchX + 20, couchY + 80, 120, 50);
    ctx.fillRect(couchX + 10, couchY + 60, 15, 70); // Left armrest
    ctx.fillRect(couchX + 125, couchY + 60, 15, 70); // Right armrest
    ctx.fillRect(couchX + 25, couchY + 75, 110, 15); // Back cushion

    // Add warm lighting on couch
    ctx.fillStyle = "rgba(255, 200, 100, 0.1)";
    ctx.fillRect(couchX + 20, couchY + 80, 60, 50);

    // Draw window with subtle light rays
    const windowX = width * 0.65;
    const windowY = height * 0.15;
    const windowW = 120;
    const windowH = 150;

    // Window panes
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.strokeRect(windowX, windowY, windowW, windowH);
    ctx.strokeRect(windowX + windowW / 2, windowY, 0, windowH); // Vertical divider
    ctx.strokeRect(windowX, windowY + windowH / 2, windowW, 0); // Horizontal divider

    // Light rays through window with subtle animation
    const rayIntensity = Math.sin(time * 0.5) * 0.1 + 0.15;
    const rayGradient = ctx.createLinearGradient(
      windowX + windowW,
      windowY,
      width,
      windowY,
    );
    rayGradient.addColorStop(0, `rgba(255, 220, 150, ${rayIntensity})`);
    rayGradient.addColorStop(1, "rgba(255, 220, 150, 0)");
    ctx.fillStyle = rayGradient;
    ctx.fillRect(
      windowX + windowW,
      windowY,
      width - windowX - windowW,
      windowH,
    );

    // Draw lamp on side table
    const lampX = width * 0.15 + 130;
    const lampY = height * 0.45;

    // Lamp base/table
    ctx.fillStyle = "#8B6F47";
    ctx.fillRect(lampX - 25, lampY + 60, 50, 15);
    ctx.fillRect(lampX - 5, lampY, 10, 60);

    // Lamp shade
    ctx.fillStyle = "#E1D5C7";
    ctx.beginPath();
    ctx.moveTo(lampX - 20, lampY);
    ctx.lineTo(lampX - 15, lampY - 20);
    ctx.lineTo(lampX + 15, lampY - 20);
    ctx.lineTo(lampX + 20, lampY);
    ctx.fill();

    // Lamp glow
    const lampGlow = ctx.createRadialGradient(
      lampX,
      lampY - 20,
      5,
      lampX,
      lampY - 20,
      60,
    );
    lampGlow.addColorStop(0, `rgba(255, 220, 100, ${0.2 * lightingIntensity})`);
    lampGlow.addColorStop(
      0.3,
      `rgba(255, 180, 80, ${0.1 * lightingIntensity})`,
    );
    lampGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lampGlow;
    ctx.fillRect(0, 0, width, height);

    // Draw wall decoration (abstract art frame)
    const art = { x: width * 0.6, y: height * 0.3 };
    ctx.strokeStyle = "#8B6F47";
    ctx.lineWidth = 3;
    ctx.strokeRect(art.x, art.y, 80, 100);

    // Art content - abstract pattern with parallax
    const artInnerX = art.x + 5;
    const artInnerY = art.y + 5;
    ctx.fillStyle = "#F0CAA8";
    ctx.fillRect(artInnerX, artInnerY, 70, 90);

    // Decorative pattern with subtle parallax
    const patternOffset = (parallaxOffset * 0.2) % 20;
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(139, 111, 71, ${0.3 - i * 0.05})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        artInnerX + 35 + Math.sin(i * 0.8) * 15,
        artInnerY + 45 + i * 12 - patternOffset,
        8,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    // Draw dynamic shadow under avatar (simplified)
    const shadowGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.7,
      50,
      width / 2,
      height * 0.7,
      150,
    );
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.15)");
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shadowGradient;
    ctx.fillRect(0, height * 0.65, width, 100);
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
