"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { getVoiceSynthesisEngine } from "@/lib/voiceSynthesisEngine";
import { initializeLipSync } from "@/components/avatar/LipSyncEngine";

/**
 * useVoicePlayback Hook
 * Comprehensive voice synthesis and playback management for AI companion
 * Handles TTS, emotion-based prosody, lip-sync integration, and audio events
 */
export function useVoicePlayback(onLipSyncUpdate = null, avatarRef = null) {
  const engine = useRef(getVoiceSynthesisEngine());
  const lipSyncRef = useRef(null);
  const currentUtteranceRef = useRef(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentEmotion, setCurrentEmotion] = useState("neutral");
  const [error, setError] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState({
    pitch: 1.0,
    rate: 1.0,
    volume: 0.8,
    profile: "ana_friendly",
  });

  /**
   * Speak text with emotion and optional lip-sync
   */
  const speak = useCallback(
    async (text, emotion = "neutral", options = {}) => {
      try {
        setError(null);
        setIsSynthesizing(true);
        setCurrentText(text);
        setCurrentEmotion(emotion);

        const eng = engine.current;

        // Set emotion first (affects prosody)
        if (emotion && emotion !== "neutral") {
          eng.setEmotion(emotion);
        }

        // Apply custom options if provided
        if (options.pitch) eng.setPitch(options.pitch);
        if (options.rate) eng.setRate(options.rate);
        if (options.volume) eng.setVolume(options.volume);

        // Speak the text
        const success = await eng.speak(text, options);

        if (!success) {
          setError("Failed to start speech synthesis");
          setIsSynthesizing(false);
          return false;
        }

        setIsPlaying(true);
        setIsSynthesizing(false);

        // Setup lip-sync if callback provided
        if (onLipSyncUpdate && currentUtteranceRef.current) {
          // Initialize lip sync for this utterance
          lipSyncRef.current = initializeLipSync(
            currentUtteranceRef.current,
            (data) => {
              if (onLipSyncUpdate) {
                onLipSyncUpdate(data);
              }
            },
          );
        }

        return true;
      } catch (err) {
        console.error("Voice playback error:", err);
        setError(err.message);
        setIsSynthesizing(false);
        return false;
      }
    },
    [onLipSyncUpdate],
  );

  /**
   * Speak text with current settings
   */
  const speakWithSettings = useCallback(
    (text, emotion = "neutral") => {
      return speak(text, emotion, voiceSettings);
    },
    [speak, voiceSettings],
  );

  /**
   * Pause speech
   */
  const pause = useCallback(() => {
    engine.current.pause();
    setIsPlaying(false);
  }, []);

  /**
   * Resume paused speech
   */
  const resume = useCallback(() => {
    engine.current.resume();
    setIsPlaying(true);
  }, []);

  /**
   * Stop speech completely
   */
  const stop = useCallback(() => {
    engine.current.stop();
    setIsPlaying(false);
    setCurrentText("");
    setCurrentEmotion("neutral");

    // Reset lip-sync
    if (lipSyncRef.current) {
      lipSyncRef.current = null;
    }
  }, []);

  /**
   * Update voice settings
   */
  const updateVoiceSettings = useCallback((newSettings) => {
    setVoiceSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));

    const eng = engine.current;
    if (newSettings.pitch) eng.setPitch(newSettings.pitch);
    if (newSettings.rate) eng.setRate(newSettings.rate);
    if (newSettings.volume) eng.setVolume(newSettings.volume);
    if (newSettings.profile) eng.setVoiceProfile(newSettings.profile);
  }, []);

  /**
   * Update emotion prosody
   */
  const updateEmotion = useCallback((newEmotion) => {
    setCurrentEmotion(newEmotion);
    engine.current.setEmotion(newEmotion);
  }, []);

  /**
   * Get current voice state
   */
  const getVoiceState = useCallback(() => {
    return {
      isPlaying,
      isSynthesizing,
      currentText,
      currentEmotion,
      voiceSettings,
      error,
    };
  }, [
    isPlaying,
    isSynthesizing,
    currentText,
    currentEmotion,
    voiceSettings,
    error,
  ]);

  /**
   * Test voice with sample text
   */
  const testVoice = useCallback(
    (emotion = "happy") => {
      const testTexts = {
        happy: "I am so happy to help you!",
        sad: "I understand you are going through a tough time.",
        calm: "Let us take a moment to breathe together.",
        anxious: "Let me help you work through this.",
        angry: "This is really frustrating!",
        neutral: "Hello, how are you doing today?",
        confident: "I am confident we can find a solution.",
        uncertain: "I am not quite sure about that.",
      };

      const text = testTexts[emotion] || testTexts.neutral;
      return speak(text, emotion);
    },
    [speak],
  );

  // Listen for utterance end events
  useEffect(() => {
    const eng = engine.current;

    const handleEnd = () => {
      setIsPlaying(false);
      setCurrentText("");
    };

    const handleError = (err) => {
      setError(`Voice error: ${err.error}`);
      setIsPlaying(false);
    };

    // Set up listeners
    const unsubEnd = eng.on("end", handleEnd);
    const unsubError = eng.on("error", handleError);

    return () => {
      if (unsubEnd) unsubEnd();
      if (unsubError) unsubError();
    };
  }, []);

  return {
    // State
    isPlaying,
    isSynthesizing,
    currentText,
    currentEmotion,
    voiceSettings,
    error,

    // Speech control
    speak,
    speakWithSettings,
    pause,
    resume,
    stop,

    // Settings management
    updateVoiceSettings,
    updateEmotion,
    getVoiceState,

    // Testing
    testVoice,
  };
}

export default useVoicePlayback;
