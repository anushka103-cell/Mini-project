"use client";

import React, { useEffect, useRef } from "react";

/**
 * Office Background Scene
 * Professional workspace with desk, computer, and bright lighting
 */
export default function OfficeScene({
  parallaxOffset = 0,
  lightingIntensity = 0.9,
  width = 800,
  height = 600,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const time = Date.now() / 1000;

    // Clear canvas with professional background
    const gradientBg = ctx.createLinearGradient(0, 0, 0, height);
    gradientBg.addColorStop(0, "#E8E8E8");
    gradientBg.addColorStop(0.5, "#D3D3D3");
    gradientBg.addColorStop(1, "#BEBEBE");
    ctx.fillStyle = gradientBg;
    ctx.fillRect(0, 0, width, height);

    // Draw bright overhead lighting (aggressive for office)
    const lightGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.1,
      80,
      width / 2,
      height * 0.1,
      width * 0.9,
    );
    lightGradient.addColorStop(
      0,
      `rgba(255, 255, 255, ${0.25 * lightingIntensity})`,
    );
    lightGradient.addColorStop(
      0.5,
      `rgba(230, 230, 230, ${0.12 * lightingIntensity})`,
    );
    lightGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lightGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw floor - light gray with grid pattern
    ctx.fillStyle = "#BFBFBF";
    ctx.fillRect(0, height * 0.65, width, height * 0.35);

    // Floor grid pattern (office tiles)
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 1;
    const tileSize = 40;
    for (let x = 0; x < width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.65);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = height * 0.65; y < height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw desk
    const deskX = width * 0.1;
    const deskY = height * 0.5;

    // Desk shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.ellipse(deskX + 90, deskY + 180, 110, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Desk surface
    ctx.fillStyle = "#8B7355";
    ctx.fillRect(deskX + 20, deskY + 120, 140, 60);

    // Desk front panel
    ctx.fillStyle = "#6B5344";
    ctx.fillRect(deskX + 20, deskY + 180, 140, 40);

    // Desk legs
    ctx.fillStyle = "#5A4A3A";
    ctx.fillRect(
      deskX + 30,
      deskY + 180,
      12,
      85 - (deskY + 180 - height * 0.65),
    );
    ctx.fillRect(
      deskX + 148,
      deskY + 180,
      12,
      85 - (deskY + 180 - height * 0.65),
    );

    // Computer monitor
    const monitorX = deskX + 70;
    const monitorY = deskY + 50;

    // Monitor bezel
    ctx.fillStyle = "#333333";
    ctx.fillRect(monitorX - 35, monitorY, 70, 50);

    // Monitor screen (with subtle glow)
    ctx.fillStyle = "#1A1A2E";
    ctx.fillRect(monitorX - 32, monitorY + 3, 64, 44);

    // Screen glow
    const screenGlow = ctx.createRadialGradient(
      monitorX,
      monitorY + 25,
      10,
      monitorX,
      monitorY + 25,
      80,
    );
    screenGlow.addColorStop(
      0,
      `rgba(100, 150, 255, ${0.15 * lightingIntensity})`,
    );
    screenGlow.addColorStop(
      0.5,
      `rgba(100, 150, 255, ${0.05 * lightingIntensity})`,
    );
    screenGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = screenGlow;
    ctx.fillRect(0, 0, width, height);

    // Monitor stand
    ctx.fillStyle = "#555555";
    ctx.fillRect(monitorX - 20, monitorY + 50, 40, 15);
    ctx.fillRect(monitorX - 8, monitorY + 65, 16, 30);

    // Keyboard on desk
    ctx.fillStyle = "#222222";
    ctx.fillRect(deskX + 50, deskY + 125, 60, 8);

    // Mouse
    ctx.fillStyle = "#444444";
    ctx.beginPath();
    ctx.ellipse(deskX + 125, deskY + 130, 8, 12, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Desk supplies
    // Pen holder
    ctx.fillStyle = "#C0B0A0";
    ctx.fillRect(deskX + 125, deskY + 110, 12, 18);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(deskX + 125, deskY + 110, 12, 18);

    // Papers
    ctx.fillStyle = "#F5F5F5";
    ctx.fillRect(deskX + 60, deskY + 100, 30, 25);
    ctx.fillStyle = "#E8E8E8";
    ctx.fillRect(deskX + 63, deskY + 103, 24, 19);

    // Draw shelving unit in background
    const shelfX = width * 0.65;
    const shelfY = height * 0.25;

    // Shelves
    ctx.fillStyle = "#9A8B7E";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(shelfX, shelfY + i * 30, 100, 6);
    }

    // Shelf supports
    ctx.fillStyle = "#6B5B4E";
    ctx.fillRect(shelfX - 8, shelfY, 8, 120);
    ctx.fillRect(shelfX + 100, shelfY, 8, 120);

    // Shelf contents (books and decorative items)
    const books = [
      { x: shelfX + 10, y: shelfY + 8, w: 12, h: 20, c: "#8B0000" },
      { x: shelfX + 25, y: shelfY + 8, w: 12, h: 20, c: "#003366" },
      { x: shelfX + 40, y: shelfY + 8, w: 12, h: 20, c: "#228B22" },
      { x: shelfX + 10, y: shelfY + 38, w: 12, h: 20, c: "#FFD700" },
      { x: shelfX + 25, y: shelfY + 38, w: 12, h: 20, c: "#4B0082" },
    ];

    books.forEach((book) => {
      ctx.fillStyle = book.c;
      ctx.fillRect(book.x, book.y, book.w, book.h);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(book.x, book.y, book.w, book.h);
    });

    // Draw window with professional light
    const windowX = width * 0.65;
    const windowY = height * 0.05;
    const windowW = 110;
    const windowH = 100;

    // Window frame
    ctx.fillStyle = "#C0C0C0";
    ctx.fillRect(windowX - 5, windowY - 5, windowW + 10, windowH + 10);

    // Window glass with subtle gradient (daylight)
    const windowGradient = ctx.createLinearGradient(
      windowX,
      windowY,
      windowX,
      windowY + windowH,
    );
    windowGradient.addColorStop(0, "#E8F4F8");
    windowGradient.addColorStop(1, "#B8D4E0");
    ctx.fillStyle = windowGradient;
    ctx.fillRect(windowX, windowY, windowW, windowH);

    // Window panes
    ctx.strokeStyle = "#707070";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(windowX, windowY, windowW / 2, windowH);
    ctx.strokeRect(windowX + windowW / 2, windowY, windowW / 2, windowH);
    ctx.strokeRect(windowX, windowY + windowH / 2, windowW, 0);

    // Bright light rays from window
    const rayGradient = ctx.createLinearGradient(
      windowX + windowW,
      windowY,
      width,
      windowY,
    );
    rayGradient.addColorStop(
      0,
      `rgba(230, 230, 200, ${0.12 * lightingIntensity})`,
    );
    rayGradient.addColorStop(1, "rgba(230, 230, 200, 0)");
    ctx.fillStyle = rayGradient;
    ctx.fillRect(windowX + windowW, windowY, width - windowX - windowW, height);

    // Draw dynamic shadow under avatar (professional lighting)
    const shadowGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.7,
      40,
      width / 2,
      height * 0.7,
      120,
    );
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.12)");
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
