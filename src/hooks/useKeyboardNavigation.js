import { useCallback, useRef, useEffect } from "react";

/**
 * useKeyboardNavigation Hook
 * Enables keyboard navigation for interactive components
 * Supports Tab navigation, Enter/Space selection, Arrow keys for sliders
 */
export function useKeyboardNavigation({
  containerRef = null,
  onKeyDown = null,
  enableArrowKeys = false,
  enableTabNavigation = true,
  onArrowUp = null,
  onArrowDown = null,
  onArrowLeft = null,
  onArrowRight = null,
  onEnter = null,
  onSpace = null,
} = {}) {
  const focusableElements = useRef([]);

  // Get all focusable elements within container
  const collectFocusableElements = useCallback(() => {
    if (!containerRef?.current) return;

    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusableElements.current = Array.from(
      containerRef.current.querySelectorAll(selector),
    ).filter((el) => {
      return el.offsetParent !== null; // Visible elements only
    });
  }, [containerRef]);

  // Move focus to next/previous element
  const focusNext = useCallback(() => {
    collectFocusableElements();
    const current = document.activeElement;
    const index = focusableElements.current.indexOf(current);

    if (index !== -1 && index < focusableElements.current.length - 1) {
      focusableElements.current[index + 1].focus();
    } else if (index === -1 && focusableElements.current.length > 0) {
      focusableElements.current[0].focus();
    }
  }, [collectFocusableElements]);

  const focusPrevious = useCallback(() => {
    collectFocusableElements();
    const current = document.activeElement;
    const index = focusableElements.current.indexOf(current);

    if (index > 0) {
      focusableElements.current[index - 1].focus();
    } else if (index === 0 && focusableElements.current.length > 0) {
      focusableElements.current[focusableElements.current.length - 1].focus();
    }
  }, [collectFocusableElements]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e) => {
      // Call custom handler first
      if (onKeyDown) {
        onKeyDown(e);
      }

      // Arrow keys for slider control
      if (enableArrowKeys) {
        if (e.key === "ArrowUp" && onArrowUp) {
          e.preventDefault();
          onArrowUp();
        } else if (e.key === "ArrowDown" && onArrowDown) {
          e.preventDefault();
          onArrowDown();
        } else if (e.key === "ArrowLeft" && onArrowLeft) {
          e.preventDefault();
          onArrowLeft();
        } else if (e.key === "ArrowRight" && onArrowRight) {
          e.preventDefault();
          onArrowRight();
        }
      }

      // Enter key
      if (e.key === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }

      // Space key
      if (e.key === " " && onSpace) {
        e.preventDefault();
        onSpace();
      }

      // Tab navigation (if enabled)
      if (enableTabNavigation) {
        if (e.key === "Tab") {
          // Don't prevent default - browser handles tab navigation
          // Just collect elements for tracking
          collectFocusableElements();
        }
      }
    },
    [
      enableArrowKeys,
      enableTabNavigation,
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      onEnter,
      onSpace,
      onKeyDown,
      collectFocusableElements,
    ],
  );

  // Attach keyboard event listener
  useEffect(() => {
    if (!containerRef?.current) return;

    const container = containerRef.current;
    container.addEventListener("keydown", handleKeyDown);
    collectFocusableElements();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, handleKeyDown, collectFocusableElements]);

  return {
    focusNext,
    focusPrevious,
    focusableElements: focusableElements.current,
    collectFocusableElements,
  };
}

export default useKeyboardNavigation;
