"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { fetchWithAuth } from "@/lib/authClient";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://mindsafe-api.onrender.com";

/**
 * usePreferencesManager Hook
 * Manages loading, saving, and caching user customization preferences
 * Syncs with backend /api/avatar/preferences endpoint
 */
export function usePreferencesManager() {
  // State
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle"); // idle, saving, saved, error
  const [error, setError] = useState(null);

  // Refs for tracking
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const cacheKey = "avatarPreferences";

  // Default preferences
  const defaultPreferences = {
    avatarPreset: "neutral_light",
    background: "living_room",
    voiceSettings: {
      voiceProfile: "ana_friendly",
      emotion: "neutral",
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
    },
    showCaptions: true,
    autoPlayVoice: true,
    responseStyle: "warm",
    useName: true,
    useMemory: true,
  };

  /**
   * Load preferences from backend or cache
   */
  const loadPreferences = useCallback(async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Try to load from backend first
      const res = await fetchWithAuth(
        `${API_BASE_URL}/api/avatar/preferences`,
        { method: "GET" },
        API_BASE_URL,
      );

      if (res.ok) {
        const data = await res.json();
        const loadedPrefs = data.preferences || defaultPreferences;
        setPreferences(loadedPrefs);

        // Cache locally
        try {
          localStorage.setItem(cacheKey, JSON.stringify(loadedPrefs));
        } catch (e) {
          console.warn("Failed to cache preferences:", e);
        }

        return loadedPrefs;
      } else {
        throw new Error(`Status ${res.status}`);
      }
    } catch (err) {
      console.warn("Failed to load preferences from backend:", err);

      // Fall back to localStorage cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedPrefs = JSON.parse(cached);
          setPreferences(cachedPrefs);
          return cachedPrefs;
        }
      } catch (e) {
        console.warn("Failed to load cached preferences:", e);
      }

      // Final fallback to defaults
      setPreferences(defaultPreferences);
      setError("Using default preferences. Unable to load saved settings.");
      return defaultPreferences;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save preferences to backend
   */
  const savePreferences = useCallback(async (newPreferences) => {
    try {
      setSaveState("saving");
      setError(null);

      // Update local state immediately
      setPreferences(newPreferences);

      // Cache locally
      try {
        localStorage.setItem(cacheKey, JSON.stringify(newPreferences));
      } catch (e) {
        console.warn("Failed to cache preferences:", e);
      }

      // Save to backend asynchronously
      const res = await fetchWithAuth(
        `${API_BASE_URL}/api/avatar/preferences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preferences: newPreferences,
          }),
        },
        API_BASE_URL,
      );

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      setSaveState("saved");

      // Reset state after delay
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 2000);

      return true;
    } catch (err) {
      console.error("Failed to save preferences:", err);
      setError(err.message);
      setSaveState("error");

      // Reset error state after delay
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 3000);

      return false;
    }
  }, []);

  /**
   * Update partial preferences
   */
  const updatePreferences = useCallback(
    async (partialPreferences) => {
      const updated = {
        ...preferences,
        ...partialPreferences,
      };
      return savePreferences(updated);
    },
    [preferences, savePreferences],
  );

  /**
   * Get preference value
   */
  const getPreference = useCallback(
    (key, defaultValue = null) => {
      if (!preferences) return defaultValue;
      return preferences[key] ?? defaultValue;
    },
    [preferences],
  );

  /**
   * Reset preferences to defaults
   */
  const resetPreferences = useCallback(async () => {
    return savePreferences(defaultPreferences);
  }, [savePreferences]);

  /**
   * Clear preferences from everywhere
   */
  const clearPreferences = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
      setPreferences(null);
      hasLoadedRef.current = false;
    } catch (e) {
      console.warn("Failed to clear preferences:", e);
    }
  }, []);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loadPreferences]);

  return {
    // State
    preferences,
    isLoading,
    saveState,
    error,

    // Methods
    loadPreferences,
    savePreferences,
    updatePreferences,
    getPreference,
    resetPreferences,
    clearPreferences,
  };
}

export default usePreferencesManager;
