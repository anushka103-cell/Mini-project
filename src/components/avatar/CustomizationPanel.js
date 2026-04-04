"use client";

import { useState, useCallback, useEffect } from "react";
import { AVATAR_PRESETS, BACKGROUNDS, EMOTIONS } from "./avatarPresets";
import {
  getVoiceSynthesisEngine,
  VOICE_PROFILES,
} from "@/lib/voiceSynthesisEngine";
import VoiceSettings from "./VoiceSettings";

/**
 * Camera presets for the 3D avatar viewer
 */
export const CAMERA_PRESETS = {
  upper: { position: [0, 1.4, 2.5], label: "Upper body" },
  face: { position: [0, 1.5, 1.2], label: "Face close-up" },
  full: { position: [0, 0.8, 4.0], label: "Full body" },
  side: { position: [1.8, 1.2, 1.8], label: "Side view" },
};

/**
 * CustomizationPanel Component
 * Comprehensive UI for avatar, background, voice, and behavior customization
 * Includes preset selectors, toggles, and save functionality
 */
export default function CustomizationPanel({
  onPreferencesChange = () => {},
  onSave = () => {},
  isLoading = false,
  saveState = "idle",
  currentPreferences = {},
}) {
  const engine = getVoiceSynthesisEngine();

  // State
  const [selectedPreset, setSelectedPreset] = useState(
    currentPreferences.avatarPreset || "neutral_light",
  );
  const [selectedBackground, setSelectedBackground] = useState(
    currentPreferences.background || "living_room",
  );
  const [voiceSettings, setVoiceSettings] = useState(
    currentPreferences.voiceSettings || {
      voiceProfile: "ana_friendly",
      emotion: "neutral",
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
    },
  );
  const [showCaptions, setShowCaptions] = useState(
    currentPreferences.showCaptions !== false,
  );
  const [autoPlayVoice, setAutoPlayVoice] = useState(
    currentPreferences.autoPlayVoice !== false,
  );
  const [expandedSections, setExpandedSections] = useState({
    avatar: true,
    background: true,
    voice: false,
    behavior: true,
  });

  // Toggle section expansion
  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (presetId) => {
      setSelectedPreset(presetId);
      onPreferencesChange({
        avatarPreset: presetId,
        background: selectedBackground,
        voiceSettings,
        showCaptions,
        autoPlayVoice,
      });
    },
    [
      selectedBackground,
      voiceSettings,
      showCaptions,
      autoPlayVoice,
      onPreferencesChange,
    ],
  );

  // Handle background selection
  const handleBackgroundSelect = useCallback(
    (bgId) => {
      setSelectedBackground(bgId);
      onPreferencesChange({
        avatarPreset: selectedPreset,
        background: bgId,
        voiceSettings,
        showCaptions,
        autoPlayVoice,
      });
    },
    [
      selectedPreset,
      voiceSettings,
      showCaptions,
      autoPlayVoice,
      onPreferencesChange,
    ],
  );

  // Handle voice settings change
  const handleVoiceSettingsChange = useCallback(
    (newSettings) => {
      setVoiceSettings(newSettings);
      onPreferencesChange({
        avatarPreset: selectedPreset,
        background: selectedBackground,
        voiceSettings: newSettings,
        showCaptions,
        autoPlayVoice,
      });
    },
    [
      selectedPreset,
      selectedBackground,
      showCaptions,
      autoPlayVoice,
      onPreferencesChange,
    ],
  );

  // Handle captions toggle
  const handleCaptionsToggle = useCallback(
    (value) => {
      setShowCaptions(value);
      onPreferencesChange({
        avatarPreset: selectedPreset,
        background: selectedBackground,
        voiceSettings,
        showCaptions: value,
        autoPlayVoice,
      });
    },
    [
      selectedPreset,
      selectedBackground,
      voiceSettings,
      autoPlayVoice,
      onPreferencesChange,
    ],
  );

  // Handle autoplay toggle
  const handleAutoPlayToggle = useCallback(
    (value) => {
      setAutoPlayVoice(value);
      onPreferencesChange({
        avatarPreset: selectedPreset,
        background: selectedBackground,
        voiceSettings,
        showCaptions,
        autoPlayVoice: value,
      });
    },
    [
      selectedPreset,
      selectedBackground,
      voiceSettings,
      showCaptions,
      onPreferencesChange,
    ],
  );

  const presetsList = Object.values(AVATAR_PRESETS);
  const backgroundsList = Object.values(BACKGROUNDS);

  // Handle keyboard navigation for preset selection
  const handlePresetKeyDown = useCallback(
    (e, presetId) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handlePresetSelect(presetId);
      }
    },
    [handlePresetSelect],
  );

  // Handle keyboard navigation for background selection
  const handleBackgroundKeyDown = useCallback(
    (e, bgId) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleBackgroundSelect(bgId);
      }
    },
    [handleBackgroundSelect],
  );

  return (
    <div
      className="space-y-6"
      role="region"
      aria-label="Avatar Customization Panel"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Customization</h2>
        <p className="text-sm text-slate-400" id="customization-description">
          Personalize your avatar experience
        </p>
      </div>

      {/* Avatar Preset Section */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <button
          onClick={() => toggleSection("avatar")}
          className="flex w-full items-center justify-between text-lg font-semibold text-slate-100 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
          aria-expanded={expandedSections.avatar}
          aria-controls="avatar-presets-list"
          aria-label="Toggle avatar presets section"
        >
          <span>👤 Avatar Presets</span>
          <span
            className={`transition ${
              expandedSections.avatar ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {expandedSections.avatar && (
          <div
            className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4"
            id="avatar-presets-list"
            role="group"
            aria-label="Available avatar presets"
          >
            {presetsList.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                onKeyDown={(e) => handlePresetKeyDown(e, preset.id)}
                className={`rounded-lg border-2 p-3 transition focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  selectedPreset === preset.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-600 hover:border-cyan-500"
                }`}
                aria-pressed={selectedPreset === preset.id}
                aria-label={`${preset.name}: ${preset.description}`}
                role="button"
                tabIndex={selectedPreset === preset.id ? 0 : -1}
              >
                {/* Visual Preview */}
                <div
                  className="mb-2 h-20 rounded bg-gradient-to-b"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, ${preset.skinTone}, ${preset.hairColor})`,
                  }}
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-slate-100">
                  {preset.name}
                </p>
                <p className="text-xs text-slate-400">{preset.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Background Section */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <button
          onClick={() => toggleSection("background")}
          className="flex w-full items-center justify-between text-lg font-semibold text-slate-100 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
          aria-expanded={expandedSections.background}
          aria-controls="background-list"
          aria-label="Toggle background scene section"
        >
          <span>🌅 Background Scene</span>
          <span
            className={`transition ${
              expandedSections.background ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {expandedSections.background && (
          <div
            className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-5"
            id="background-list"
            role="group"
            aria-label="Available background scenes"
          >
            {backgroundsList.map((bg) => (
              <button
                key={bg.id}
                onClick={() => handleBackgroundSelect(bg.id)}
                onKeyDown={(e) => handleBackgroundKeyDown(e, bg.id)}
                className={`rounded-lg border-2 p-3 transition focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  selectedBackground === bg.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-600 hover:border-cyan-500"
                }`}
                aria-pressed={selectedBackground === bg.id}
                aria-label={`${bg.name}: ${bg.description}`}
                role="button"
                tabIndex={selectedBackground === bg.id ? 0 : -1}
              >
                {/* Visual Preview */}
                <div
                  className="mb-2 h-24 rounded"
                  style={{
                    backgroundColor: bg.backgroundColor,
                    borderBottom: `3px solid ${bg.accentColor}`,
                  }}
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-slate-100">{bg.name}</p>
                <p className="text-xs text-slate-400">{bg.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice Settings Section */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <button
          onClick={() => toggleSection("voice")}
          className="flex w-full items-center justify-between text-lg font-semibold text-slate-100 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
          aria-expanded={expandedSections.voice}
          aria-controls="voice-settings"
          aria-label="Toggle voice settings section"
        >
          <span>🔊 Voice Settings</span>
          <span
            className={`transition ${
              expandedSections.voice ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {expandedSections.voice && (
          <div
            className="mt-4"
            id="voice-settings"
            role="region"
            aria-label="Voice settings controls"
          >
            <VoiceSettings
              currentSettings={voiceSettings}
              onSettingsChange={handleVoiceSettingsChange}
              showPreview={true}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Behavior Section */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <button
          onClick={() => toggleSection("behavior")}
          className="flex w-full items-center justify-between text-lg font-semibold text-slate-100 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
          aria-expanded={expandedSections.behavior}
          aria-controls="behavior-settings"
          aria-label="Toggle behavior settings section"
        >
          <span>⚙️ Behavior</span>
          <span
            className={`transition ${
              expandedSections.behavior ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {expandedSections.behavior && (
          <div
            className="mt-4 space-y-4"
            id="behavior-settings"
            role="group"
            aria-label="Behavior settings"
          >
            {/* Captions Toggle */}
            <label className="flex items-center gap-3 cursor-pointer focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 rounded px-2 py-1">
              <input
                type="checkbox"
                checked={showCaptions}
                onChange={(e) => handleCaptionsToggle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-describedby="captions-description"
              />
              <div>
                <p className="font-medium text-slate-100">Show Captions</p>
                <p className="text-sm text-slate-400" id="captions-description">
                  Display text for all spoken responses
                </p>
              </div>
            </label>

            {/* Autoplay Toggle */}
            <label className="flex items-center gap-3 cursor-pointer focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 rounded px-2 py-1">
              <input
                type="checkbox"
                checked={autoPlayVoice}
                onChange={(e) => handleAutoPlayToggle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-describedby="autoplay-description"
              />
              <div>
                <p className="font-medium text-slate-100">
                  Autoplay Voice Responses
                </p>
                <p className="text-sm text-slate-400" id="autoplay-description">
                  Automatically speak responses (if enabled)
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={isLoading || saveState === "saving"}
        className={`w-full rounded-lg px-4 py-3 font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed ${
          saveState === "saved"
            ? "bg-emerald-600 text-white"
            : saveState === "error"
              ? "bg-rose-600 text-white"
              : isLoading || saveState === "saving"
                ? "bg-slate-700 text-slate-400"
                : "bg-cyan-600 text-white hover:bg-cyan-500"
        }`}
        aria-busy={saveState === "saving"}
        aria-label={
          saveState === "saving"
            ? "Saving preferences"
            : saveState === "saved"
              ? "Preferences saved successfully"
              : saveState === "error"
                ? "Failed to save preferences"
                : "Save preferences"
        }
      >
        {saveState === "saving"
          ? "Saving..."
          : saveState === "saved"
            ? "✓ Saved!"
            : saveState === "error"
              ? "✗ Save Failed"
              : "Save Preferences"}
      </button>

      {/* Info Box */}
      <div
        className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs text-slate-400">
          💾 Your preferences are automatically saved and will be restored when
          you return.
        </p>
      </div>
    </div>
  );
}
