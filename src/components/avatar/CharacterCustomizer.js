"use client";

import { useState, useCallback } from "react";
import "@/styles/character-customizer.css";

/**
 * Character Customization Panel
 * Allows users to customize the 3D character appearance and emotions
 */
export function CharacterCustomizer({
  characterRef = null,
  onUpdate = () => {},
}) {
  const [config, setConfig] = useState({
    skinTone: "#f4a460",
    hairColor: "#2c2c2c",
    clothingColor: "#90ee90",
    accentColor: "#ff69b4",
  });

  const [emotion, setEmotion] = useState("neutral");
  const [emotionIntensity, setEmotionIntensity] = useState(0.7);

  const emotions = [
    { id: "neutral", label: "Neutral", icon: "😐" },
    { id: "happy", label: "Happy", icon: "😊" },
    { id: "sad", label: "Sad", icon: "😢" },
    { id: "surprised", label: "Surprised", icon: "😮" },
    { id: "anxious", label: "Anxious", icon: "😰" },
    { id: "calm", label: "Calm", icon: "😌" },
  ];

  const presets = [
    {
      name: "Ocean Vibes",
      skinTone: "#d4af37",
      hairColor: "#1a1a1a",
      clothingColor: "#4a90e2",
      accentColor: "#00bcd4",
    },
    {
      name: "Sunset",
      skinTone: "#f4a460",
      hairColor: "#8b4513",
      clothingColor: "#ff6b6b",
      accentColor: "#ffa500",
    },
    {
      name: "Forest",
      skinTone: "#c9a876",
      hairColor: "#2d5016",
      clothingColor: "#228b22",
      accentColor: "#98d98e",
    },
    {
      name: "Purple Dreams",
      skinTone: "#e8b4a0",
      hairColor: "#4a148c",
      clothingColor: "#b39ddb",
      accentColor: "#ce93d8",
    },
  ];

  const handleColorChange = useCallback(
    (colorKey, value) => {
      const newConfig = { ...config, [colorKey]: value };
      setConfig(newConfig);
      onUpdate({ type: "appearance", config: newConfig });
    },
    [config, onUpdate],
  );

  const handleEmotionChange = useCallback(
    (emotionId) => {
      setEmotion(emotionId);
      onUpdate({
        type: "emotion",
        emotion: emotionId,
        intensity: emotionIntensity,
      });
    },
    [emotionIntensity, onUpdate],
  );

  const handleIntensityChange = useCallback(
    (value) => {
      const intensity = parseFloat(value);
      setEmotionIntensity(intensity);
      onUpdate({
        type: "emotion",
        emotion,
        intensity,
      });
    },
    [emotion, onUpdate],
  );

  const applyPreset = useCallback(
    (preset) => {
      setConfig({
        skinTone: preset.skinTone,
        hairColor: preset.hairColor,
        clothingColor: preset.clothingColor,
        accentColor: preset.accentColor,
      });
      onUpdate({
        type: "appearance",
        config: {
          skinTone: preset.skinTone,
          hairColor: preset.hairColor,
          clothingColor: preset.clothingColor,
          accentColor: preset.accentColor,
        },
      });
    },
    [onUpdate],
  );

  return (
    <div className="character-customizer">
      {/* Emotion Selection */}
      <div className="customizer-section">
        <h3>Emotion</h3>
        <div className="emotion-selector">
          {emotions.map((e) => (
            <button
              key={e.id}
              className={`emotion-btn ${emotion === e.id ? "active" : ""}`}
              onClick={() => handleEmotionChange(e.id)}
              title={e.label}
            >
              <span className="emotion-icon">{e.icon}</span>
              <span className="emotion-label">{e.label}</span>
            </button>
          ))}
        </div>

        <div className="intensity-control">
          <label>
            Expression Intensity: {(emotionIntensity * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={emotionIntensity}
            onChange={(e) => handleIntensityChange(e.target.value)}
            className="intensity-slider"
          />
        </div>
      </div>

      {/* Color Customization */}
      <div className="customizer-section">
        <h3>Appearance</h3>

        {/* Presets */}
        <div className="presets-grid">
          {presets.map((preset) => (
            <button
              key={preset.name}
              className="preset-btn"
              onClick={() => applyPreset(preset)}
              title={preset.name}
            >
              <div className="preset-preview">
                <div
                  className="preview-color skin"
                  style={{ backgroundColor: preset.skinTone }}
                />
                <div
                  className="preview-color clothing"
                  style={{ backgroundColor: preset.clothingColor }}
                />
                <div
                  className="preview-color accent"
                  style={{ backgroundColor: preset.accentColor }}
                />
              </div>
              <span>{preset.name}</span>
            </button>
          ))}
        </div>

        {/* Custom Colors */}
        <div className="color-controls">
          <div className="color-input-group">
            <label htmlFor="skinTone">Skin Tone</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="skinTone"
                value={config.skinTone}
                onChange={(e) => handleColorChange("skinTone", e.target.value)}
                className="color-input"
              />
              <span className="color-value">{config.skinTone}</span>
            </div>
          </div>

          <div className="color-input-group">
            <label htmlFor="hairColor">Hair Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="hairColor"
                value={config.hairColor}
                onChange={(e) => handleColorChange("hairColor", e.target.value)}
                className="color-input"
              />
              <span className="color-value">{config.hairColor}</span>
            </div>
          </div>

          <div className="color-input-group">
            <label htmlFor="clothingColor">Clothing Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="clothingColor"
                value={config.clothingColor}
                onChange={(e) =>
                  handleColorChange("clothingColor", e.target.value)
                }
                className="color-input"
              />
              <span className="color-value">{config.clothingColor}</span>
            </div>
          </div>

          <div className="color-input-group">
            <label htmlFor="accentColor">Accent Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="accentColor"
                value={config.accentColor}
                onChange={(e) =>
                  handleColorChange("accentColor", e.target.value)
                }
                className="color-input"
              />
              <span className="color-value">{config.accentColor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
