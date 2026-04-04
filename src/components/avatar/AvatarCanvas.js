"use client";

import { useEffect, useRef } from "react";

/**
 * AvatarCanvas - Clean Modern Minimalist Design
 */
export default function AvatarCanvas({
  preset,
  emotion = "neutral",
  backgroundColor = "#F5F1ED",
  width = 400,
  height = 500,
  animationProgress = 0,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height * 0.45;

    drawAvatar(ctx, preset, emotion, centerX, centerY);
  }, [preset, emotion, backgroundColor, width, height, animationProgress]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg shadow-lg"
      style={{
        width: "100%",
        height: "auto",
        maxWidth: "100%",
        display: "block",
      }}
      aria-label="Avatar display"
    />
  );
}

function drawAvatar(ctx, preset, emotion, centerX, centerY) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const { EMOTIONS } = require("./avatarPresets");
  const em = EMOTIONS[emotion] || EMOTIONS.neutral;

  const faceW = 110;
  const faceH = 130;

  // Simple, clean layers
  drawHair(ctx, centerX, centerY - 35, faceW, faceH, preset);
  drawNeck(ctx, centerX, centerY + 65, faceW, preset);
  drawFace(ctx, centerX, centerY, faceW, faceH, preset);
  drawEyes(
    ctx,
    centerX,
    centerY,
    faceW,
    preset.eyeColor,
    preset.eyeHighlight,
    em,
  );
  drawEyebrows(ctx, centerX, centerY, faceW, preset.eyebrowColor, em);
  drawNose(ctx, centerX, centerY + 5, preset);
  drawMouth(ctx, centerX, centerY + 40, preset.mouthColor, em);
}

function drawNeck(ctx, centerX, centerY, faceW, preset) {
  ctx.fillStyle = preset.skinTone;
  ctx.fillRect(centerX - 25, centerY, 50, 35);
}

function drawHair(ctx, centerX, centerY, faceW, faceH, preset) {
  ctx.fillStyle = preset.hairColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, faceW * 0.5, faceH * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(ctx, centerX, centerY, faceW, faceH, preset) {
  const grad = ctx.createRadialGradient(
    centerX - faceW * 0.1,
    centerY - faceH * 0.1,
    faceW * 0.05,
    centerX,
    centerY + 5,
    faceW * 0.5,
  );

  grad.addColorStop(0, brighten(preset.skinTone, 1.15));
  grad.addColorStop(0.7, preset.skinTone);
  grad.addColorStop(1, brighten(preset.skinTone, 0.92));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY + 5,
    faceW * 0.48,
    faceH * 0.5,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Cheeks
  ctx.fillStyle = "rgba(220, 100, 100, 0.08)";
  ctx.beginPath();
  ctx.ellipse(
    centerX - faceW * 0.22,
    centerY + 15,
    faceW * 0.14,
    faceH * 0.1,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    centerX + faceW * 0.22,
    centerY + 15,
    faceW * 0.14,
    faceH * 0.1,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawEyes(ctx, centerX, centerY, faceW, eyeColor, highlight, em) {
  const eyeY = centerY - 10;
  const eyeGap = faceW * 0.2;
  const open = em.eyeOpenness;

  drawSingleEye(
    ctx,
    centerX - eyeGap,
    eyeY,
    eyeColor,
    highlight,
    open,
    em.eyeDirection,
  );
  drawSingleEye(
    ctx,
    centerX + eyeGap,
    eyeY,
    eyeColor,
    highlight,
    open,
    em.eyeDirection,
  );
}

function drawSingleEye(ctx, x, y, eyeColor, highlight, open, direction) {
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(x, y, 18, 20 * open, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#E8E8E8";
  ctx.lineWidth = 1;
  ctx.stroke();

  const irisSize = 10 * open;
  const dirOffset = direction * 2.5;

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(x + dirOffset, y + 1, irisSize, irisSize, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(x + dirOffset + 1.5, y - 1, irisSize * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = highlight || "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x + dirOffset + 4, y - 3, irisSize * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyebrows(ctx, centerX, centerY, faceW, color, em) {
  const eyeY = centerY - 10;
  const eyeGap = faceW * 0.2;
  const tilt = em.eyebrowHeight * 6;

  drawSingleEyebrow(ctx, centerX - eyeGap, eyeY - 20, color, tilt);
  drawSingleEyebrow(ctx, centerX + eyeGap, eyeY - 20, color, tilt);
}

function drawSingleEyebrow(ctx, x, y, color, tilt) {
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(x - 14, y + 1);
  ctx.quadraticCurveTo(x, y - 5 + tilt * 2.5, x + 14, y + 1);
  ctx.lineTo(x + 14, y + 4);
  ctx.quadraticCurveTo(x, y, x - 14, y + 4);
  ctx.closePath();
  ctx.fill();
}

function drawNose(ctx, centerX, centerY, preset) {
  ctx.strokeStyle = preset.skinTone;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 15);
  ctx.lineTo(centerX, centerY + 5);
  ctx.stroke();
}

function drawMouth(ctx, x, y, color, em) {
  const shape = em.mouthShape;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 18, y);

  if (Math.abs(shape) < 0.1) {
    ctx.quadraticCurveTo(x, y + 3, x + 18, y);
  } else if (shape > 0) {
    const curve = Math.min(shape * 10 + 3, 12);
    ctx.quadraticCurveTo(x, y + curve, x + 18, y);
  } else {
    const curve = Math.abs(shape) * 8;
    ctx.quadraticCurveTo(x, y + curve, x + 18, y);
  }

  ctx.lineTo(x + 18, y + 2);
  ctx.quadraticCurveTo(x, y + 1, x - 18, y + 2);
  ctx.closePath();
  ctx.fill();
}

function brighten(hex, factor) {
  const h = hex.replace("#", "");
  const r = Math.min(255, Math.round(parseInt(h.substring(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(h.substring(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(h.substring(4, 6), 16) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}
