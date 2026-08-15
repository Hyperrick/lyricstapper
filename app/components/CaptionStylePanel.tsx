"use client";

import { CAPTION_FONTS, CAPTION_PRESETS, CaptionStyle } from "../lib/captionStyle";

type CaptionStylePanelProps = {
  value: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
};

export function CaptionStylePanel({ value, onChange }: CaptionStylePanelProps) {
  function update<Key extends keyof CaptionStyle>(key: Key, nextValue: CaptionStyle[Key]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="caption-styler">
      <div className="style-section">
        <span className="style-label">PRESETS</span>
        <div className="preset-grid">
          {CAPTION_PRESETS.map((preset) => <button key={preset.name} onClick={() => onChange({ ...preset.style })}>{preset.name}</button>)}
        </div>
      </div>

      <div className="style-section style-grid">
        <label><span>Font</span><select value={value.fontFamily} onChange={(event) => update("fontFamily", event.target.value)}>{CAPTION_FONTS.map((font) => <option key={font}>{font}</option>)}</select></label>
        <label><span>Weight</span><select value={value.fontWeight} onChange={(event) => update("fontWeight", Number(event.target.value) as CaptionStyle["fontWeight"])}><option value="500">Medium</option><option value="700">Bold</option><option value="900">Black</option></select></label>
        <label className="range-control"><span>Size <strong>{value.fontSizePercent.toFixed(1)}%</strong></span><input type="range" min="2.5" max="9" step="0.1" value={value.fontSizePercent} onChange={(event) => update("fontSizePercent", Number(event.target.value))} /></label>
        <label className="range-control"><span>Position <strong>{value.bottomPercent}%</strong></span><input type="range" min="5" max="45" value={value.bottomPercent} onChange={(event) => update("bottomPercent", Number(event.target.value))} /></label>
      </div>

      <div className="style-section">
        <span className="style-label">COLORS</span>
        <div className="color-grid">
          <label><span>Text</span><input type="color" value={value.textColor} onChange={(event) => update("textColor", event.target.value)} /></label>
          <label><span>Highlight</span><input type="color" value={value.highlightColor} onChange={(event) => update("highlightColor", event.target.value)} /></label>
          {value.highlightMode === "background" && <label><span>Active text</span><input type="color" value={value.highlightTextColor} onChange={(event) => update("highlightTextColor", event.target.value)} /></label>}
          <label><span>Panel</span><input type="color" value={value.backgroundColor} onChange={(event) => update("backgroundColor", event.target.value)} /></label>
        </div>
      </div>

      <div className="style-section">
        <span className="style-label">ACTIVE WORD</span>
        <div className="segmented-control">
          {(["none", "text", "background"] as const).map((mode) => <button className={value.highlightMode === mode ? "is-active" : ""} key={mode} onClick={() => update("highlightMode", mode)}>{mode}</button>)}
        </div>
        <label className="range-control"><span>Past words <strong>{value.pastOpacity}%</strong></span><input type="range" min="20" max="100" value={value.pastOpacity} onChange={(event) => update("pastOpacity", Number(event.target.value))} /></label>
      </div>

      <div className="style-section toggle-list">
        <label><span>Drop shadow</span><input type="checkbox" checked={value.shadow} onChange={(event) => update("shadow", event.target.checked)} /></label>
        <label><span>Dark outline</span><input type="checkbox" checked={value.outline} onChange={(event) => update("outline", event.target.checked)} /></label>
        <label><span>Caption background</span><input type="checkbox" checked={value.captionBackground} onChange={(event) => update("captionBackground", event.target.checked)} /></label>
        {value.captionBackground && <label className="range-control"><span>Background <strong>{value.backgroundOpacity}%</strong></span><input type="range" min="10" max="100" value={value.backgroundOpacity} onChange={(event) => update("backgroundOpacity", Number(event.target.value))} /></label>}
        <label><span>Uppercase</span><input type="checkbox" checked={value.uppercase} onChange={(event) => update("uppercase", event.target.checked)} /></label>
      </div>
    </div>
  );
}
