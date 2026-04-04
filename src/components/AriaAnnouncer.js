"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * AriaAnnouncer Component
 * Manages accessibility announcements via live regions
 * Components can use the context to announce messages for screen readers
 */
export default function AriaAnnouncer() {
  const [announcements, setAnnouncements] = useState([]);
  const announcementRef = useRef(null);
  const timeoutsRef = useRef([]);

  // Add announcement to live region
  const announce = useCallback(
    (message, priority = "polite", duration = 3000) => {
      const id = Date.now();

      setAnnouncements((prev) => [...prev, { id, message, priority }]);

      // Auto-remove announcement after duration
      const timeout = setTimeout(() => {
        setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
      }, duration);

      timeoutsRef.current.push(timeout);

      return () => {
        clearTimeout(timeout);
        setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
      };
    },
    [],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      {/* Polite announcements (non-urgent) */}
      <div
        ref={announcementRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcements
          .filter((ann) => ann.priority === "polite")
          .map((ann) => (
            <div key={ann.id}>{ann.message}</div>
          ))}
      </div>

      {/* Assertive announcements (urgent) */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {announcements
          .filter((ann) => ann.priority === "assertive")
          .map((ann) => (
            <div key={ann.id}>{ann.message}</div>
          ))}
      </div>

      {/* Provide global announce function */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.announceForAccessibility = window.announceForAccessibility || function(msg, priority) {
            // Fallback for components that need direct access
          };`,
        }}
      />
    </>
  );
}

/**
 * createAnnouncerContext
 * Creates a context for passing the announce function to components
 * Usage: wrap app with provider, use useAnnouncer hook in components
 */
import { createContext, useContext } from "react";

export const AnnouncerContext = createContext(null);

export function AnnouncerProvider({ children, announce }) {
  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
    </AnnouncerContext.Provider>
  );
}

/**
 * useAnnouncer Hook
 * Use in components to access the announce function
 */
export function useAnnouncer() {
  const context = useContext(AnnouncerContext);

  if (!context) {
    console.warn("useAnnouncer must be used within AnnouncerProvider");
    return { announce: () => {} };
  }

  return context;
}

/**
 * Common announcement messages
 * Pre-formatted messages for consistent screen reader feedback
 */
export const a11yMessages = {
  emotionChanged: (emotion) => `Avatar expression changed to ${emotion}`,
  voiceSettingChanged: (setting, value) =>
    `Voice ${setting} adjusted to ${value}`,
  backgroundChanged: (background) => `Background changed to ${background}`,
  preferencesSaved: () => "Your preferences have been saved successfully",
  preferencesFailed: (reason) => `Failed to save preferences: ${reason}`,
  settingFocused: (name) =>
    `${name} setting focused. Use arrow keys to adjust.`,
  sliderAdjusted: (name, value) => `${name} set to ${value}`,
  toggleChanged: (name, state) => `${name} ${state ? "enabled" : "disabled"}`,
  avatarPreset: (preset) => `Avatar preset changed to ${preset}`,
  itemSelected: (item) => `${item} selected`,
  menuOpened: (menu) => `${menu} menu opened`,
  menuClosed: (menu) => `${menu} menu closed`,
};
