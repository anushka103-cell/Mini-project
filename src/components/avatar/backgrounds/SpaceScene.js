"use client";

import React, { useEffect, useRef } from "react";

/**
 * Space Background Scene
 * Cosmic environment with stars, parallax nebula, and subtle animations
 */
export default function SpaceScene({
  parallaxOffset = 0,
  lightingIntensity = 0.5,
  width = 800,
  height = 600,
}) {
  const canvasRef = useRef(null);

  // Generate static stars based on deterministic seed
  const generateStars = (seed, count) => {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const x = ((i * 73 + seed * 541) % (width * 10)) / 10;
      const y = ((i * 127 + seed * 733) % (height * 10)) / 10;
      const size = 0.5 + ((i * 37) % 10) / 10;
      const opacity = 0.3 + ((i * 61) % 7) / 10;
      stars.push({ x, y, size, opacity });
    }
    return stars;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const time = Date.now() / 1000;

    // Deep space background - dark navy/purple gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, "#0A0E27");
    bgGradient.addColorStop(0.5, "#1A0F3D");
    bgGradient.addColorStop(1, "#0A0F2E");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Nebula effect (animated cosmic gas)
    const nebulae = [
      {
        x: 0.3,
        y: 0.2,
        size: 200,
        color: "rgba(138, 43, 226, 0.06)",
        time: time * 0.05,
      },
      {
        x: 0.7,
        y: 0.6,
        size: 250,
        color: "rgba(0, 255, 127, 0.04)",
        time: time * -0.03,
      },
      {
        x: 0.5,
        y: 0.5,
        size: 300,
        color: "rgba(65, 105, 225, 0.05)",
        time: time * 0.04,
      },
    ];

    nebulae.forEach((nebula) => {
      const nebx = width * nebula.x + parallaxOffset * 0.2;
      const neby = height * nebula.y;

      const nebGradient = ctx.createRadialGradient(
        nebx + Math.sin(nebula.time) * 30,
        neby + Math.cos(nebula.time) * 30,
        0,
        nebx,
        neby,
        nebula.size,
      );
      nebGradient.addColorStop(0, nebula.color);
      nebGradient.addColorStop(0.5, nebula.color.replace(/[\d.]+\)/, "0)"));
      nebGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = nebGradient;
      ctx.fillRect(0, 0, width, height);
    });

    // Draw stars (fixed layer)
    const stars = generateStars(12345, 150);
    stars.forEach((star) => {
      // Twinkling effect
      const twinkle = Math.sin(time * 2 + star.x + star.y) * 0.5 + 0.5;
      const opacity = star.opacity * twinkle * lightingIntensity;

      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      // Star glow for brighter stars
      if (star.opacity > 0.7) {
        ctx.fillStyle = `rgba(200, 220, 255, ${opacity * 0.3})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Shooting stars (rare animated elements)
    for (let i = 0; i < 2; i++) {
      const shootTime = time * 0.3 + i * 3;
      const shootPhase = shootTime % 8; // Respawn every 8 seconds

      if (shootPhase < 5) {
        // Star is visible
        const progress = shootPhase / 5;
        const shootX = 50 + progress * (width - 100);
        const shootY = 50 + progress * (height * 0.3);

        // Trail
        ctx.strokeStyle = `rgba(200, 220, 255, ${0.4 * (1 - progress) * lightingIntensity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shootX - 30, shootY + 30);
        ctx.lineTo(shootX, shootY);
        ctx.stroke();

        // Star
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress) * lightingIntensity})`;
        ctx.beginPath();
        ctx.arc(shootX, shootY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Distant galaxies (spiral shapes)
    const galaxies = [
      { x: 0.2, y: 0.3, size: 40, rotation: time * 0.1 },
      { x: 0.8, y: 0.7, size: 35, rotation: time * -0.08 },
      { x: 0.6, y: 0.2, size: 30, rotation: time * 0.12 },
    ];

    galaxies.forEach((galaxy) => {
      const gx = width * galaxy.x + parallaxOffset * 0.1;
      const gy = height * galaxy.y;

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(galaxy.rotation);

      // Spiral arms
      for (let arm = 0; arm < 3; arm++) {
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.15 * lightingIntensity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < galaxy.size; i++) {
          const angle =
            (i / galaxy.size) * Math.PI * 4 + (arm * Math.PI * 2) / 3;
          const r = i;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // Core
      ctx.fillStyle = `rgba(150, 200, 255, ${0.3 * lightingIntensity})`;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Distant planets
    const planets = [
      { x: 0.15, y: 0.15, size: 25, color: "rgba(255, 100, 100, 0.5)" },
      { x: 0.85, y: 0.2, size: 15, color: "rgba(100, 200, 255, 0.4)" },
      { x: 0.3, y: 0.8, size: 35, color: "rgba(255, 200, 100, 0.3)" },
    ];

    planets.forEach((planet) => {
      const px = width * planet.x + parallaxOffset * 0.15;
      const py = height * planet.y;

      // Planet glow
      const planetGlow = ctx.createRadialGradient(
        px,
        py,
        planet.size * 0.5,
        px,
        py,
        planet.size * 2,
      );
      planetGlow.addColorStop(0, planet.color);
      planetGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = planetGlow;
      ctx.fillRect(
        px - planet.size * 2,
        py - planet.size * 2,
        planet.size * 4,
        planet.size * 4,
      );

      // Planet body
      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(px, py, planet.size, 0, Math.PI * 2);
      ctx.fill();

      // Planet highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(
        px - planet.size * 0.3,
        py - planet.size * 0.3,
        planet.size * 0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });

    // Cosmic dust particles with parallax
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    for (let i = 0; i < 100; i++) {
      const dustX =
        ((i * 97 + parallaxOffset * 0.5) % (width * 2)) - width * 0.5;
      const dustY = ((i * 113) % (height * 2)) - height * 0.5;
      const dustSize = 0.3 + ((i * 41) % 5) / 10;

      ctx.beginPath();
      ctx.arc(width / 2 + dustX, height / 2 + dustY, dustSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw dynamic shadow under avatar (cosmic lighting)
    const shadowGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.7,
      60,
      width / 2,
      height * 0.7,
      160,
    );
    shadowGradient.addColorStop(0, "rgba(65, 105, 225, 0.1)");
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
