import { useState, useCallback, useEffect } from "react";

/**
 * useParallax Hook
 * Manages parallax offset based on mouse position or animation
 * Creates depth effect by moving background/objects at different rates
 */
export function useParallax({ enabled = false, containerRef = null } = {}) {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Update parallax based on mouse movement
  const updateMousePosition = useCallback(
    (clientX, clientY) => {
      if (!enabled || !containerRef?.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Normalize to -1 to 1 range
      const normalizedX = (x / rect.width) * 2 - 1;
      const normalizedY = (y / rect.height) * 2 - 1;

      // Calculate parallax offset (how much background shifts)
      // Range: -50 to 50 pixels of offset
      const offset = normalizedX * 50;

      setMousePosition({ x: normalizedX, y: normalizedY });
      setParallaxOffset(offset);
    },
    [enabled, containerRef],
  );

  // Animate parallax when mouse interaction disabled
  useEffect(() => {
    if (enabled) return; // Don't animate if mouse control is active

    let animationFrameId;
    let time = 0;

    const animate = () => {
      time += 0.016; // ~60fps
      // Gentle parallax wave animation
      const offset = Math.sin(time * 0.5) * 30;
      setParallaxOffset(offset);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [enabled]);

  return {
    parallaxOffset,
    mousePosition,
    updateMousePosition,
  };
}

export default useParallax;
