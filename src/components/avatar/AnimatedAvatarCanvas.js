"use client";

import { useEffect, useRef, useState } from "react";
import AvatarCanvas from "./AvatarCanvas";
import { calculateBlinkAmount } from "./EmotionAnimator";
import { smoothMouthTransition } from "./LipSyncEngine";
import { EMOTIONS } from "./avatarPresets";
import * as FacialColorSystem from "./FacialColorSystem";
import * as TearsEngine from "./TearsEngine";
import * as IdleAnimationsEngine from "./IdleAnimationsEngine";

/**
 * AnimatedAvatarCanvas - Phase 2 & 3
 * Enhances AvatarCanvas with smooth animations, lip-sync, blink effects,
 * head movements, facial colors, tears, and idle animations
 */
export default function AnimatedAvatarCanvas({
  preset,
  emotion = "neutral",
  backgroundColor = "#E8D4C0",
  width = 400,
  height = 500,
  animationProgress = 0,
  mouthShape = 0, // -1 to 1 (for lip-sync)
  enableBlink = true,
  enableBreathing = true,
  isLooking = null, // { x, y } for gaze direction
  // Phase 3 - Head Movement
  headTilt = 0,
  headRoll = 0,
  headNod = 0,
  // Phase 3 - Facial Colors
  enableFacialColors = true,
  emotionIntensity = 0.5,
  // Phase 3 - Tears
  enableTears = false,
  tearType = "sadness",
  // Phase 3 - Idle Animations
  enableIdleAnimations = false,
}) {
  const canvasRef = useRef(null);
  const [currentMouthShape, setCurrentMouthShape] = useState(0);
  const [eyeOpenness, setEyeOpenness] = useState(1.0);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Phase 3 - Facial color state
  const [facialColor, setFacialColor] = useState(
    FacialColorSystem.getBaseSkinTone(preset),
  );
  const [blushOpacity, setBlushOpacity] = useState(0);

  // Phase 3 - Tears state
  const tearsRef = useRef(null);
  const [tearStreams, setTearStreams] = useState(null);

  // Phase 3 - Idle animations state
  const [idleAnimationState, setIdleAnimationState] = useState(null);
  const idleStartTimeRef = useRef(null);

  // Handle lip-sync mouth updates
  useEffect(() => {
    if (mouthShape !== currentMouthShape) {
      const startFrame = Date.now();
      const duration = 100; // ms for smooth mouth transition

      const animateMouth = () => {
        const elapsed = Date.now() - startFrame;
        const progress = Math.min(elapsed / duration, 1);

        const smoothed = smoothMouthTransition(
          currentMouthShape,
          mouthShape,
          progress,
        );
        setCurrentMouthShape(smoothed);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animateMouth);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animateMouth);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mouthShape, currentMouthShape]);

  // Handle blink and breathing animations
  useEffect(() => {
    const elapsedMs = Date.now() - startTimeRef.current;

    if (enableBlink) {
      const blinkAmount = calculateBlinkAmount(elapsedMs, 17);
      setEyeOpenness(blinkAmount);
    }

    // Breathing animation - subtle eye opening/closing
    if (enableBreathing && !enableBlink) {
      const breathingCycle = (elapsedMs / 1000 / 4) % 1; // 4 second cycle
      const breathing = Math.sin(breathingCycle * Math.PI * 2) * 0.1;
      setEyeOpenness(1.0 + breathing);
    }

    // Phase 3 - Update facial colors based on emotion
    if (enableFacialColors) {
      const combinedColor = FacialColorSystem.getCombinedSkinTone(
        preset,
        emotion,
        emotionIntensity,
      );
      setFacialColor(combinedColor.combined);

      const blush = FacialColorSystem.calculateBlush(emotion, emotionIntensity);
      setBlushOpacity(blush.opacity);
    }

    // Phase 3 - Update tears
    if (enableTears && !tearStreams) {
      const eyePositions = {
        left: { x: 140, y: 150 },
        right: { x: 260, y: 150 },
      };
      const both = TearsEngine.createBothEyeTears(eyePositions, tearType);
      setTearStreams(both);
    }

    if (enableTears && tearStreams) {
      TearsEngine.updateBothTearStreams(tearStreams, 16, emotionIntensity);
    }

    // Phase 3 - Update idle animations
    if (enableIdleAnimations) {
      if (!idleStartTimeRef.current) {
        idleStartTimeRef.current = Date.now();
      }
      const idleElapsed = Date.now() - idleStartTimeRef.current;
      const idleState = IdleAnimationsEngine.generateCompleteIdleAnimation(
        idleElapsed,
        {
          fidgetIntensity: 0.3,
          wanderIntensity: 0.4,
          emotionValence:
            emotion === "happy" ? 0.7 : emotion === "sad" ? -0.7 : 0,
        },
      );
      setIdleAnimationState(idleState);
    } else {
      idleStartTimeRef.current = null;
      setIdleAnimationState(null);
    }
  }, [
    enableBlink,
    enableBreathing,
    enableFacialColors,
    enableTears,
    enableIdleAnimations,
    emotion,
    emotionIntensity,
    tearType,
    tearStreams,
    preset,
  ]);

  // Create blended emotion with animation
  const getBlendedEmotion = () => {
    const emotionData = EMOTIONS[emotion] || EMOTIONS.neutral;

    // Apply eye openness from blink effect
    let blendedEmotion = { ...emotionData };
    if (enableBlink) {
      blendedEmotion.eyeOpenness = emotionData.eyeOpenness * eyeOpenness;
    }

    // Apply mouth shape from lip-sync
    if (Math.abs(currentMouthShape) > 0.01) {
      blendedEmotion.mouthShape = currentMouthShape;
    }

    // Apply gaze direction if provided
    if (isLooking) {
      blendedEmotion.eyeDirection =
        (blendedEmotion.eyeDirection || 0) + isLooking.x * 0.5;
    }

    return blendedEmotion;
  };

  return (
    <div className="relative w-full">
      {/* Enhanced canvas with animations */}
      <div
        className="relative rounded-lg shadow-lg overflow-hidden"
        style={{
          background: backgroundColor,
          aspectRatio: `${width}/${height}`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full"
          style={{
            display: "block",
          }}
        />

        {/* Animated avatar rendering with effects */}
        <AnimatedAvatarRenderer
          preset={preset}
          emotion={emotion}
          blendedEmotion={getBlendedEmotion()}
          backgroundColor={backgroundColor}
          width={width}
          height={height}
          animationProgress={animationProgress}
          mouthShape={currentMouthShape}
          eyeOpenness={eyeOpenness}
          isLooking={isLooking}
          canvasRef={canvasRef}
          // Phase 3 props
          headTilt={headTilt}
          headRoll={headRoll}
          headNod={headNod}
          facialColor={facialColor}
          blushOpacity={blushOpacity}
          tearStreams={tearStreams}
          idleAnimationState={idleAnimationState}
        />
      </div>

      {/* Animation state indicators */}
      <div className="mt-2 flex gap-2 text-xs text-gray-600 flex-wrap">
        {enableBlink && (
          <span className="px-2 py-1 bg-blue-100 rounded">👁️ Blinking</span>
        )}
        {enableBreathing && (
          <span className="px-2 py-1 bg-green-100 rounded">💨 Breathing</span>
        )}
        {Math.abs(currentMouthShape) > 0.1 && (
          <span className="px-2 py-1 bg-purple-100 rounded">🎤 Lip-sync</span>
        )}
        {Math.abs(headTilt) > 1 && (
          <span className="px-2 py-1 bg-orange-100 rounded">🎯 Head Tilt</span>
        )}
        {enableFacialColors && blushOpacity > 0.05 && (
          <span className="px-2 py-1 bg-pink-100 rounded">😊 Blushing</span>
        )}
        {enableTears && tearStreams && tearStreams.left.droplets.length > 0 && (
          <span className="px-2 py-1 bg-blue-50 rounded">😢 Tears</span>
        )}
        {enableIdleAnimations && idleAnimationState && (
          <span className="px-2 py-1 bg-yellow-100 rounded">✨ Idle</span>
        )}
      </div>
    </div>
  );
}

/**
 * AnimatedAvatarRenderer - Core rendering with animation
 * Uses the clean AvatarCanvas rendering with animation enhancements
 */
function AnimatedAvatarRenderer({
  preset,
  emotion,
  blendedEmotion,
  backgroundColor,
  width,
  height,
  animationProgress,
  mouthShape,
  eyeOpenness,
  isLooking,
  canvasRef,
  // Phase 3
  headTilt = 0,
  headRoll = 0,
  headNod = 0,
  facialColor,
  blushOpacity,
  tearStreams,
  idleAnimationState,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height * 0.45;

    // Use clean avatar rendering with blended emotion
    drawCleanAvatar(ctx, preset, blendedEmotion, centerX, centerY);

    // Add subtle shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY + height * 0.3,
      width * 0.25,
      15,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }, [
    preset,
    emotion,
    blendedEmotion,
    backgroundColor,
    width,
    height,
    animationProgress,
    eyeOpenness,
    canvasRef,
  ]);

  return null; // Canvas manages its own rendering
}

/**
 * Clean avatar drawing - modern minimalist design
 * Replaces old cartoony rendering functions
 */
/**
 * Clean avatar drawing - professional and appealing design
 * Better proportions, more expressive features
 */
function drawCleanAvatar(ctx, preset, emotion, centerX, centerY) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Better proportions
  const faceW = 140;
  const faceH = 160;

  // Draw in order
  drawCleanNeck(ctx, centerX, centerY + 80, preset);
  drawCleanHair(ctx, centerX, centerY - 40, faceW, faceH, preset);
  drawCleanEars(ctx, centerX, centerY, faceW, preset);
  drawCleanFace(ctx, centerX, centerY, faceW, faceH, preset);
  drawCleanNose(ctx, centerX, centerY + 15, preset);
  drawCleanFaceFeatures(ctx, centerX, centerY, faceW, faceH, preset, emotion);
}

function drawCleanNeck(ctx, centerX, centerY, preset) {
  ctx.fillStyle = preset.skinTone;
  ctx.fillRect(centerX - 35, centerY, 70, 50);

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(centerX - 35, centerY, 35, 50);
}

function drawCleanEars(ctx, centerX, centerY, faceW, preset) {
  const earW = 22;
  const earH = 45;

  ctx.fillStyle = preset.skinTone;
  ctx.beginPath();
  ctx.ellipse(
    centerX - faceW / 2 - earW / 2,
    centerY - 10,
    earW,
    earH,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    centerX + faceW / 2 + earW / 2,
    centerY - 10,
    earW,
    earH,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawCleanHair(ctx, centerX, centerY, faceW, faceH, preset) {
  ctx.fillStyle = preset.hairColor;

  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY - 35,
    faceW * 0.55,
    faceH * 0.45,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillRect(centerX - faceW / 2 - 15, centerY - 30, 15, 80);
  ctx.fillRect(centerX + faceW / 2, centerY - 30, 15, 80);

  ctx.beginPath();
  ctx.moveTo(centerX - faceW / 2 - 15, centerY - 20);
  ctx.quadraticCurveTo(
    centerX - faceW / 2 - 25,
    centerY + 20,
    centerX - faceW / 2,
    centerY + 40,
  );
  ctx.quadraticCurveTo(
    centerX,
    centerY + 50,
    centerX + faceW / 2,
    centerY + 40,
  );
  ctx.quadraticCurveTo(
    centerX + faceW / 2 + 25,
    centerY + 20,
    centerX + faceW / 2 + 15,
    centerY - 20,
  );
  ctx.fill();
}

function drawCleanFace(ctx, centerX, centerY, faceW, faceH, preset) {
  const grad = ctx.createRadialGradient(
    centerX - faceW * 0.15,
    centerY - faceH * 0.15,
    faceW * 0.1,
    centerX,
    centerY + 20,
    faceW * 0.5,
  );
  grad.addColorStop(0, brightenColor(preset.skinTone, 1.25));
  grad.addColorStop(0.5, preset.skinTone);
  grad.addColorStop(1, darkenColor(preset.skinTone, 0.85));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY + 15,
    faceW * 0.5,
    faceH * 0.55,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY + 50,
    faceW * 0.45,
    faceH * 0.15,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.ellipse(
    centerX - faceW * 0.25,
    centerY + 25,
    faceW * 0.15,
    faceH * 0.12,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    centerX + faceW * 0.25,
    centerY + 25,
    faceW * 0.15,
    faceH * 0.12,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawCleanNose(ctx, centerX, centerY, preset) {
  ctx.strokeStyle = preset.skinTone;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 20);
  ctx.lineTo(centerX, centerY + 10);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.ellipse(centerX - 5, centerY + 12, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX + 5, centerY + 12, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCleanFaceFeatures(
  ctx,
  centerX,
  centerY,
  faceW,
  faceH,
  preset,
  emotion,
) {
  const em = emotion || EMOTIONS.neutral;

  const eyeY = centerY - 15;
  const eyeGap = faceW * 0.25;

  drawCleanEye(
    ctx,
    centerX - eyeGap,
    eyeY,
    preset.eyeColor,
    preset.eyeHighlight,
    em,
  );
  drawCleanEye(
    ctx,
    centerX + eyeGap,
    eyeY,
    preset.eyeColor,
    preset.eyeHighlight,
    em,
  );

  drawCleanEyebrow(ctx, centerX - eyeGap, eyeY - 25, preset.eyebrowColor, em);
  drawCleanEyebrow(ctx, centerX + eyeGap, eyeY - 25, preset.eyebrowColor, em);

  drawCleanMouth(ctx, centerX, centerY + 45, preset.mouthColor, em);
}

function drawCleanEye(ctx, x, y, eyeColor, highlight, em) {
  const open = em.eyeOpenness;

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 24 * open, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const irisSize = 12 * open;
  const dirOffset = em.eyeDirection * 3;

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(x + dirOffset, y + 2, irisSize, irisSize, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(x + dirOffset + 2, y, irisSize * 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = highlight || "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x + dirOffset + 6, y - 4, irisSize * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawCleanEyebrow(ctx, x, y, color, em) {
  ctx.fillStyle = color;
  const tilt = em.eyebrowHeight * 8;

  ctx.beginPath();
  ctx.moveTo(x - 16, y + 2);
  ctx.quadraticCurveTo(x, y - 6 + tilt * 3, x + 16, y + 2);
  ctx.lineTo(x + 16, y + 5);
  ctx.quadraticCurveTo(x, y + 1, x - 16, y + 5);
  ctx.closePath();
  ctx.fill();
}

function drawCleanMouth(ctx, x, y, color, em) {
  const shape = em.mouthShape;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 20, y);

  if (Math.abs(shape) < 0.1) {
    ctx.quadraticCurveTo(x, y + 4, x + 20, y);
  } else if (shape > 0) {
    const curve = shape * 12 + 4;
    ctx.quadraticCurveTo(x, y + curve, x + 20, y);
  } else {
    const curve = Math.abs(shape) * 10;
    ctx.quadraticCurveTo(x, y + curve, x + 20, y);
  }

  ctx.lineTo(x + 20, y + 3);
  ctx.quadraticCurveTo(x, y + 2, x - 20, y + 3);
  ctx.closePath();
  ctx.fill();
}

function brightenColor(hex, factor) {
  const h = hex.replace("#", "");
  const r = Math.min(255, Math.round(parseInt(h.substring(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(h.substring(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(h.substring(4, 6), 16) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(hex, factor) {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * factor));
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * factor));
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}
