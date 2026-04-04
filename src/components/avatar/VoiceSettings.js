"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  getVoiceSynthesisEngine,
  VOICE_PROFILES,
  EMOTION_PROSODY,
} from "@/lib/voiceSynthesisEngine";
import { useAnnouncer, a11yMessages } from "@/components/AriaAnnouncer";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useEmotionDebouncer } from "@/lib/performanceOptimizations";

/**
 * VoiceSettings Component
 * UI for controlling voice synthesis, pitch, speed, volume, and emotion
 * Fully accessible with keyboard navigation and screen reader support
 */
export default function VoiceSettings({
  currentSettings = {},
  onSettingsChange = () => {},
  showPreview = true,
  compact = false,
}) {
  const engine = getVoiceSynthesisEngine();
  const containerRef = useRef(null);
  const { announce } = useAnnouncer();
  const emotionDebouncer = useEmotionDebouncer(300);

  // Local state
  const [voiceProfile, setVoiceProfile] = useState(
    currentSettings.voiceProfile || "ana_friendly",
  );
  const [emotion, setEmotion] = useState(currentSettings.emotion || "neutral");
  const [pitch, setPitch] = useState(currentSettings.pitch || 1.0);
  const [rate, setRate] = useState(currentSettings.rate || 1.0);
  const [volume, setVolume] = useState(currentSettings.volume || 1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewText, setPreviewText] = useState(
    "Hello, I am your AI companion.",
  );
  const [focusedSlider, setFocusedSlider] = useState(null);

  // Keyboard navigation setup
  useKeyboardNavigation({
    containerRef,
    enableArrowKeys: focusedSlider !== null,
    onArrowUp: () => {
      if (focusedSlider === "pitch") {
        handlePitchChange(Math.min(2.0, pitch + 0.1));
        announce(
          a11yMessages.sliderAdjusted("Pitch", (pitch + 0.1).toFixed(1)),
        );
      } else if (focusedSlider === "rate") {
        handleRateChange(Math.min(2.0, rate + 0.1));
        announce(a11yMessages.sliderAdjusted("Speed", (rate + 0.1).toFixed(1)));
      } else if (focusedSlider === "volume") {
        handleVolumeChange(Math.min(1, volume + 0.05));
        announce(
          a11yMessages.sliderAdjusted(
            "Volume",
            `${Math.round((volume + 0.05) * 100)}%`,
          ),
        );
      }
    },
    onArrowDown: () => {
      if (focusedSlider === "pitch") {
        handlePitchChange(Math.max(0.5, pitch - 0.1));
        announce(
          a11yMessages.sliderAdjusted("Pitch", (pitch - 0.1).toFixed(1)),
        );
      } else if (focusedSlider === "rate") {
        handleRateChange(Math.max(0.5, rate - 0.1));
        announce(a11yMessages.sliderAdjusted("Speed", (rate - 0.1).toFixed(1)));
      } else if (focusedSlider === "volume") {
        handleVolumeChange(Math.max(0, volume - 0.05));
        announce(
          a11yMessages.sliderAdjusted(
            "Volume",
            `${Math.round((volume - 0.05) * 100)}%`,
          ),
        );
      }
    },
  });

  // Handle voice profile change
  const handleVoiceProfileChange = useCallback(
    (profileId) => {
      engine.setVoiceProfile(profileId);
      setVoiceProfile(profileId);

      const profile = VOICE_PROFILES[profileId];
      setPitch(profile.pitch);
      setRate(profile.rate);

      // Announce change for screen readers
      announce(
        a11yMessages.voiceSettingChanged("profile", profile.name),
        "polite",
      );

      onSettingsChange({
        voiceProfile: profileId,
        emotion,
        pitch: profile.pitch,
        rate: profile.rate,
        volume,
      });
    },
    [engine, emotion, volume, onSettingsChange, announce],
  );

  // Handle emotion change
  const handleEmotionChange = useCallback(
    (newEmotion) => {
      // Debounce emotion updates to prevent rapid changes
      emotionDebouncer.updateEmotion(newEmotion, (debouncedEmotion) => {
        engine.setEmotion(debouncedEmotion);
        setEmotion(debouncedEmotion);

        // Announce change for screen readers
        const emotionLabel =
          debouncedEmotion.charAt(0).toUpperCase() + debouncedEmotion.slice(1);
        announce(a11yMessages.emotionChanged(emotionLabel), "polite");

        onSettingsChange({
          voiceProfile,
          emotion: debouncedEmotion,
          pitch,
          rate,
          volume,
        });
      });
    },
    [
      engine,
      voiceProfile,
      pitch,
      rate,
      volume,
      onSettingsChange,
      announce,
      emotionDebouncer,
    ],
  );

  // Cleanup debouncer on unmount
  useEffect(() => {
    return () => {
      emotionDebouncer.clear();
    };
  }, [emotionDebouncer]);

  // Handle pitch change
  const handlePitchChange = useCallback(
    (newPitch) => {
      const boundedPitch = Math.max(0.5, Math.min(2.0, newPitch));
      engine.setPitch(boundedPitch);
      setPitch(boundedPitch);

      onSettingsChange({
        voiceProfile,
        emotion,
        pitch: boundedPitch,
        rate,
        volume,
      });
    },
    [engine, voiceProfile, emotion, rate, volume, onSettingsChange],
  );

  // Handle rate change
  const handleRateChange = useCallback(
    (newRate) => {
      const boundedRate = Math.max(0.5, Math.min(2.0, newRate));
      engine.setRate(boundedRate);
      setRate(boundedRate);

      onSettingsChange({
        voiceProfile,
        emotion,
        pitch,
        rate: boundedRate,
        volume,
      });
    },
    [engine, voiceProfile, emotion, pitch, volume, onSettingsChange],
  );

  // Handle volume change
  const handleVolumeChange = useCallback(
    (newVolume) => {
      const boundedVolume = Math.max(0, Math.min(1, newVolume));
      engine.setVolume(boundedVolume);
      setVolume(boundedVolume);

      onSettingsChange({
        voiceProfile,
        emotion,
        pitch,
        rate,
        volume: boundedVolume,
      });
    },
    [engine, voiceProfile, emotion, pitch, rate, onSettingsChange],
  );

  // Preview current voice
  const handlePreview = useCallback(() => {
    setIsPlaying(true);
    announce("Playing voice preview", "assertive");

    engine.speakWithEmotion(previewText, emotion, {
      pitch,
      rate,
      volume,
    });

    // Reset playing state after speech ends
    const checkPlaying = () => {
      if (!engine.isPlaying) {
        setIsPlaying(false);
        announce("Voice preview complete", "polite");
      } else {
        setTimeout(checkPlaying, 100);
      }
    };
    setTimeout(checkPlaying, 100);
  }, [engine, previewText, emotion, pitch, rate, volume, announce]);

  // Pre-defined preview texts
  const previewTexts = {
    neutral: "Hello, I am your AI companion.",
    happy: "I am so happy to help you today!",
    calm: "Let us take a moment to relax together.",
    excited: "This is absolutely amazing!",
    sad: "I understand you are going through a difficult time.",
    anxious: "Let me help you work through this.",
    confident: "I am confident we can find a solution.",
    uncertain: "I am not quite sure about this.",
  };

  // Update preview text when emotion changes
  useEffect(() => {
    if (previewTexts[emotion]) {
      setPreviewText(previewTexts[emotion]);
    }
  }, [emotion]);

  const voiceProfilesList = Object.values(VOICE_PROFILES);
  const emotionsList = Object.keys(EMOTION_PROSODY);
  const genderGroups = {
    female: voiceProfilesList.filter((v) => v.gender === "female"),
    male: voiceProfilesList.filter((v) => v.gender === "male"),
    "non-binary": voiceProfilesList.filter((v) => v.gender === "non-binary"),
  };

  return (
    <div
      ref={containerRef}
      className={`space-y-6 ${compact ? "space-y-4" : ""}`}
      role="region"
      aria-label="Voice Settings"
    >
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Voice Settings</h3>
        <p className="text-sm text-slate-400">
          Customize how your AI companion speaks to you. Use Tab to navigate,
          Enter to select, and Arrow keys to adjust sliders.
        </p>
      </div>

      {/* Voice Profile Selection */}
      <fieldset className="space-y-3">
        <legend className="block text-sm font-medium text-slate-200">
          Voice Profile
        </legend>
        <div
          className="space-y-2"
          role="group"
          aria-labelledby="voice-profile-group"
        >
          {Object.entries(genderGroups).map(([gender, profiles]) => (
            <div key={gender} className="space-y-1">
              <p
                className="text-xs font-medium uppercase text-slate-400"
                id={`voice-gender-${gender}`}
              >
                {gender}
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleVoiceProfileChange(profile.id)}
                    aria-pressed={voiceProfile === profile.id}
                    aria-describedby={`voice-desc-${profile.id}`}
                    title={`${profile.name} - ${profile.description}`}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      voiceProfile === profile.id
                        ? "bg-cyan-600 text-white ring-2 ring-cyan-400"
                        : "border border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400"
                    }`}
                  >
                    {profile.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Emotion Selection */}
      <fieldset className="space-y-3">
        <legend className="block text-sm font-medium text-slate-200">
          Voice Tone (Emotion)
        </legend>
        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
          role="group"
          aria-labelledby="emotion-group"
        >
          {emotionsList.map((emo) => (
            <button
              key={emo}
              onClick={() => handleEmotionChange(emo)}
              aria-pressed={emotion === emo}
              title={`Set emotion to ${emo}`}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                emotion === emo
                  ? "bg-cyan-600 text-white ring-2 ring-cyan-400"
                  : "border border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400"
              }`}
            >
              {emo.charAt(0).toUpperCase() + emo.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Pitch Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="pitch-slider"
            className="text-sm font-medium text-slate-200"
          >
            Pitch
          </label>
          <span className="text-xs text-slate-400" aria-live="polite">
            {pitch.toFixed(1)}x
          </span>
        </div>
        <input
          id="pitch-slider"
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={pitch}
          onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
          onFocus={() => {
            setFocusedSlider("pitch");
            announce(a11yMessages.settingFocused("Pitch slider"), "polite");
          }}
          onBlur={() => setFocusedSlider(null)}
          aria-label="Pitch control"
          aria-valuemin={0.5}
          aria-valuemax={2.0}
          aria-valuenow={pitch}
          aria-valuetext={`${pitch.toFixed(1)} times`}
          className="w-full accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Lower</span>
          <span>Higher</span>
        </div>
      </div>

      {/* Rate (Speed) Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="rate-slider"
            className="text-sm font-medium text-slate-200"
          >
            Speed
          </label>
          <span className="text-xs text-slate-400" aria-live="polite">
            {rate.toFixed(1)}x
          </span>
        </div>
        <input
          id="rate-slider"
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={rate}
          onChange={(e) => handleRateChange(parseFloat(e.target.value))}
          onFocus={() => {
            setFocusedSlider("rate");
            announce(a11yMessages.settingFocused("Speed slider"), "polite");
          }}
          onBlur={() => setFocusedSlider(null)}
          aria-label="Speech rate control"
          aria-valuemin={0.5}
          aria-valuemax={2.0}
          aria-valuenow={rate}
          aria-valuetext={`${rate.toFixed(1)} times`}
          className="w-full accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Slower</span>
          <span>Faster</span>
        </div>
      </div>

      {/* Volume Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="volume-slider"
            className="text-sm font-medium text-slate-200"
          >
            Volume
          </label>
          <span className="text-xs text-slate-400" aria-live="polite">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          onFocus={() => {
            setFocusedSlider("volume");
            announce(a11yMessages.settingFocused("Volume slider"), "polite");
          }}
          onBlur={() => setFocusedSlider(null)}
          aria-label="Volume control"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          aria-valuetext={`${Math.round(volume * 100)} percent`}
          className="w-full accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Silent</span>
          <span>Loud</span>
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <label
            htmlFor="preview-textarea"
            className="block text-sm font-medium text-slate-200"
          >
            Preview
          </label>
          <textarea
            id="preview-textarea"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            aria-label="Text for voice preview"
            aria-describedby="preview-help"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            rows={2}
            placeholder="Enter text for preview..."
          />
          <p id="preview-help" className="text-xs text-slate-500">
            Edit the text above and click Preview to hear how your voice sounds
          </p>
          <button
            onClick={handlePreview}
            disabled={isPlaying}
            aria-label={
              isPlaying ? "Voice preview playing" : "Play voice preview"
            }
            aria-busy={isPlaying}
            className={`w-full rounded-lg px-4 py-2 font-medium transition ${
              isPlaying
                ? "cursor-not-allowed bg-slate-700 text-slate-400"
                : "bg-cyan-600 text-white hover:bg-cyan-500"
            }`}
          >
            {isPlaying ? "Playing..." : "Preview Voice"}
          </button>
        </div>
      )}

      {/* Info Box */}
      <div
        className="rounded-lg border border-slate-700 bg-slate-900/50 p-3"
        role="note"
      >
        <p className="text-xs text-slate-400">
          💡 <strong>Tip:</strong> Emotion changes how the voice sounds. Try
          different combinations of voice, tone, and pitch for the perfect
          sound! Use Tab to navigate, Enter to select, and arrow keys to adjust
          sliders.
        </p>
      </div>
    </div>
  );
}
