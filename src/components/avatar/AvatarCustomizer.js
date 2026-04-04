"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Avatar Customizer - Modern, unified customization UI
 * Handles all avatar preferences with proper save/persistence logic
 */
export default function AvatarCustomizer({
  currentPreferences = {},
  onSave = () => {},
  onPreview = () => {},
  isSaving = false,
  saveState = "idle",
}) {
  // Form state
  const [formData, setFormData] = useState({
    avatarPreset: currentPreferences.avatarPreset || "neutral_light",
    background: currentPreferences.background || "living_room",
    emotion: currentPreferences.emotion || "neutral",
    voiceProfile:
      currentPreferences.voiceSettings?.voiceProfile || "david_english",
    speed: currentPreferences.voiceSettings?.rate || 1.0,
    pitch: currentPreferences.voiceSettings?.pitch || 1.0,
    volume: currentPreferences.voiceSettings?.volume || 0.8,
    showCaptions: currentPreferences.showCaptions !== false,
    autoPlayVoice: currentPreferences.autoPlayVoice !== false,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const lastSavedState = useRef(formData);

  // Track changes - compare against the actual last saved state, not currentPreferences
  useEffect(() => {
    const hasActualChanges =
      JSON.stringify(formData) !== JSON.stringify(lastSavedState.current);
    setHasChanges(hasActualChanges);
  }, [formData]);

  // Update lastSavedState when preferences are actually saved
  useEffect(() => {
    if (saveState === "saved") {
      lastSavedState.current = { ...formData };
      setHasChanges(false); // Explicitly set hasChanges to false
    }
  }, [saveState, formData]);

  // Avatar and background presets
  const avatarPresets = [
    { id: "neutral_light", name: "Serene Light", color: "#E8B4A0" },
    { id: "neutral_dark", name: "Bold Dark", color: "#6B4423" },
    { id: "neutral_olive", name: "Gentle Olive", color: "#C9A885" },
    { id: "neutral_diverse", name: "Vibrant Diverse", color: "#9B6B4D" },
  ];

  const backgroundPresets = [
    { id: "living_room", name: "Living Room", emoji: "🏠" },
    { id: "office", name: "Office", emoji: "🏢" },
    { id: "garden", name: "Garden", emoji: "🌿" },
    { id: "abstract", name: "Abstract", emoji: "🎨" },
    { id: "space", name: "Space", emoji: "🚀" },
    { id: "none", name: "None", emoji: "⭕" },
  ];

  const emotions = [
    { id: "neutral", name: "Neutral", emoji: "😐" },
    { id: "happy", name: "Happy", emoji: "😊" },
    { id: "sad", name: "Sad", emoji: "😢" },
    { id: "thinking", name: "Thinking", emoji: "🤔" },
    { id: "curious", name: "Curious", emoji: "🤨" },
    { id: "excited", name: "Excited", emoji: "🤩" },
  ];

  const voiceProfiles = [
    { id: "david_english", name: "David (English)" },
    { id: "female_us", name: "Female (US)" },
    { id: "male_uk", name: "Male (UK)" },
    { id: "female_uk", name: "Female (UK)" },
  ];

  // Update status message based on save state
  useEffect(() => {
    if (saveState === "saving") {
      setStatusMessage("💾 Saving...");
    } else if (saveState === "saved") {
      setStatusMessage("✓ Changes saved successfully!");
      const timer = setTimeout(() => setStatusMessage(""), 2000);
      return () => clearTimeout(timer);
    } else if (saveState === "error") {
      setStatusMessage("✗ Failed to save. Please try again.");
      const timer = setTimeout(() => setStatusMessage(""), 3000);
      return () => clearTimeout(timer);
    } else {
      setStatusMessage("");
    }
  }, [saveState]);

  // Handle input changes
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Quick-save for preset and background (auto-save immediately)
  const handleQuickSave = useCallback(
    (field, value) => {
      const updatedFormData = {
        ...formData,
        [field]: value,
      };
      setFormData(updatedFormData);

      // Auto-save preset and background changes immediately
      const preferences = {
        avatarPreset: updatedFormData.avatarPreset,
        background: updatedFormData.background,
        voiceSettings: {
          voiceProfile: updatedFormData.voiceProfile,
          emotion: updatedFormData.emotion,
          pitch: updatedFormData.pitch,
          rate: updatedFormData.speed,
          volume: updatedFormData.volume,
        },
        showCaptions: updatedFormData.showCaptions,
        autoPlayVoice: updatedFormData.autoPlayVoice,
      };
      onSave(preferences);
    },
    [formData, onSave],
  );

  // Handle slider changes
  const handleSliderChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: parseFloat(value),
    }));
  }, []);

  // Handle checkbox changes
  const handleCheckboxChange = useCallback((field, checked) => {
    setFormData((prev) => ({
      ...prev,
      [field]: checked,
    }));
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    const preferences = {
      avatarPreset: formData.avatarPreset,
      background: formData.background,
      emotion: formData.emotion,
      voiceSettings: {
        voiceProfile: formData.voiceProfile,
        pitch: formData.pitch,
        rate: formData.speed,
        volume: formData.volume,
      },
      showCaptions: formData.showCaptions,
      autoPlayVoice: formData.autoPlayVoice,
    };
    onSave(preferences);
  }, [formData, onSave]);

  // Handle reset
  const handleReset = useCallback(() => {
    const resetState = {
      avatarPreset: currentPreferences.avatarPreset || "neutral_light",
      background: currentPreferences.background || "living_room",
      emotion: currentPreferences.emotion || "neutral",
      voiceProfile:
        currentPreferences.voiceSettings?.voiceProfile || "david_english",
      speed: currentPreferences.voiceSettings?.rate || 1.0,
      pitch: currentPreferences.voiceSettings?.pitch || 1.0,
      volume: currentPreferences.voiceSettings?.volume || 0.8,
      showCaptions: currentPreferences.showCaptions !== false,
      autoPlayVoice: currentPreferences.autoPlayVoice !== false,
    };
    setFormData(resetState);
    lastSavedState.current = resetState;
    setHasChanges(false);
  }, [currentPreferences]);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Customize Avatar
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Personalize your AI companion's appearance and behavior
      </p>

      {/* Avatar Preset Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          👤 Avatar Preset
        </label>
        <div className="grid grid-cols-2 gap-2">
          {avatarPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                handleChange("avatarPreset", preset.id);
                onPreview("avatarPreset", preset.id);
              }}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                formData.avatarPreset === preset.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              <div
                className="w-6 h-6 rounded-full mx-auto mb-1"
                style={{ backgroundColor: preset.color }}
              ></div>
              <p className="text-xs font-medium text-gray-700 text-center">
                {preset.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Background Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          🎨 Background Scene
        </label>
        <div className="grid grid-cols-5 gap-2">
          {backgroundPresets.map((bg) => (
            <button
              key={bg.id}
              onClick={() => {
                handleChange("background", bg.id);
                onPreview("background", bg.id);
              }}
              className={`p-2 rounded-lg border-2 transition-all duration-200 text-center ${
                formData.background === bg.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
              title={bg.name}
            >
              <span className="text-xl">{bg.emoji}</span>
              <p className="text-xs font-medium text-gray-600 mt-1">
                {bg.name.split(" ")[0]}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Emotion Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          😊 Avatar Emotion
        </label>
        <div className="grid grid-cols-3 gap-2">
          {emotions.map((emote) => (
            <button
              key={emote.id}
              onClick={() => {
                handleChange("emotion", emote.id);
                onPreview("emotion", emote.id);
              }}
              className={`p-2 rounded-lg border-2 transition-all duration-200 text-center ${
                formData.emotion === emote.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
              title={emote.name}
            >
              <span className="text-2xl">{emote.emoji}</span>
              <p className="text-xs font-medium text-gray-600 mt-1">
                {emote.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Profile */}
      <div className="mb-6">
        <label
          htmlFor="voice-profile"
          className="block text-sm font-semibold text-gray-800 mb-2"
        >
          🎙️ Voice Profile
        </label>
        <select
          id="voice-profile"
          value={formData.voiceProfile}
          onChange={(e) => handleChange("voiceProfile", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {voiceProfiles.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>

      {/* Voice Sliders */}
      <div className="space-y-4 mb-6">
        {/* Speed */}
        <div>
          <label className="flex justify-between text-sm font-semibold text-gray-800 mb-2">
            <span>⚡ Speed</span>
            <span className="font-normal text-gray-600">
              {formData.speed.toFixed(1)}x
            </span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={formData.speed}
            onChange={(e) => handleSliderChange("speed", e.target.value)}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Pitch */}
        <div>
          <label className="flex justify-between text-sm font-semibold text-gray-800 mb-2">
            <span>🎵 Pitch</span>
            <span className="font-normal text-gray-600">
              {formData.pitch.toFixed(1)}x
            </span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={formData.pitch}
            onChange={(e) => handleSliderChange("pitch", e.target.value)}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Volume */}
        <div>
          <label className="flex justify-between text-sm font-semibold text-gray-800 mb-2">
            <span>🔊 Volume</span>
            <span className="font-normal text-gray-600">
              {Math.round(formData.volume * 100)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={formData.volume}
            onChange={(e) => handleSliderChange("volume", e.target.value)}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.showCaptions}
            onChange={(e) =>
              handleCheckboxChange("showCaptions", e.target.checked)
            }
            className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-800">
            📝 Show Captions
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.autoPlayVoice}
            onChange={(e) =>
              handleCheckboxChange("autoPlayVoice", e.target.checked)
            }
            className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-800">
            🔊 Auto-play Voice
          </span>
        </label>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg mb-4 text-sm font-medium text-center ${
            saveState === "saving"
              ? "bg-blue-100 text-blue-800"
              : saveState === "saved"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`flex-1 px-4 py-2 font-semibold rounded-lg transition-all duration-200 ${
            !hasChanges
              ? "bg-green-500 text-white cursor-not-allowed opacity-75"
              : isSaving
                ? "bg-blue-500 text-white cursor-progress"
                : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
          }`}
        >
          {!hasChanges ? "✓ Saved" : isSaving ? "Saving..." : "💾 Save Changes"}
        </button>
        {hasChanges && (
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            ↶ Reset
          </button>
        )}
      </div>

      {/* Info text */}
      {!hasChanges && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Make changes above to customize your avatar
        </p>
      )}
    </div>
  );
}
