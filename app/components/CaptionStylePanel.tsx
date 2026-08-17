"use client";

import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Slider } from "@astryxdesign/core/Slider";
import { Switch } from "@astryxdesign/core/Switch";
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
    <div className="tool-panel-content caption-styler">
      <section className="tool-section style-section">
        <div className="section-copy">
          <strong>Presets</strong>
          <small>Start with a look, then tune every detail below.</small>
        </div>
        <div className="preset-grid">
          {CAPTION_PRESETS.map((preset) => (
            <Button key={preset.name} label={`Apply ${preset.name} preset`} variant="secondary" size="sm" onClick={() => onChange({ ...preset.style })}>{preset.name}</Button>
          ))}
        </div>
      </section>

      <section className="tool-section style-section control-stack">
        <Selector label="Font" options={[...CAPTION_FONTS]} value={value.fontFamily} onChange={(font) => update("fontFamily", font)} width="100%" />
        <Selector
          label="Weight"
          options={[{ value: "500", label: "Medium" }, { value: "700", label: "Bold" }, { value: "900", label: "Black" }]}
          value={String(value.fontWeight)}
          onChange={(weight) => update("fontWeight", Number(weight) as CaptionStyle["fontWeight"])}
          width="100%"
        />
        <Slider label="Caption size" min={2.5} max={9} step={0.1} value={value.fontSizePercent} valueDisplay="text" formatValue={(size: number) => `${size.toFixed(1)}%`} onChange={(size: number) => update("fontSizePercent", size)} />
        <Slider label="Distance from bottom" min={5} max={45} value={value.bottomPercent} valueDisplay="text" formatValue={(position: number) => `${position}%`} onChange={(position: number) => update("bottomPercent", position)} />
      </section>

      <section className="tool-section style-section">
        <div className="section-copy">
          <strong>Colors</strong>
          <small>These colors belong to the exported captions, independent of the app theme.</small>
        </div>
        <div className="color-grid">
          <ColorControl label="Text" value={value.textColor} onChange={(color) => update("textColor", color)} />
          <ColorControl label="Highlight" value={value.highlightColor} onChange={(color) => update("highlightColor", color)} />
          {value.highlightMode === "background" && <ColorControl label="Active text" value={value.highlightTextColor} onChange={(color) => update("highlightTextColor", color)} />}
          <ColorControl label="Background" value={value.backgroundColor} onChange={(color) => update("backgroundColor", color)} />
        </div>
      </section>

      <section className="tool-section style-section control-stack">
        <SegmentedControl value={value.highlightMode} onChange={(mode) => update("highlightMode", mode as CaptionStyle["highlightMode"])} label="Active word highlight" layout="fill">
          <SegmentedControlItem value="none" label="None" />
          <SegmentedControlItem value="text" label="Text" />
          <SegmentedControlItem value="wipe" label="Wipe" />
          <SegmentedControlItem value="background" label="Block" />
        </SegmentedControl>
        <Slider label="Past word opacity" min={20} max={100} value={value.pastOpacity} valueDisplay="text" formatValue={(opacity: number) => `${opacity}%`} onChange={(opacity: number) => update("pastOpacity", opacity)} />
      </section>

      <section className="tool-section style-section switch-stack">
        <Switch label="Drop shadow" value={value.shadow} onChange={(enabled) => update("shadow", enabled)} labelSpacing="spread" width="100%" />
        <Switch label="Dark outline" value={value.outline} onChange={(enabled) => update("outline", enabled)} labelSpacing="spread" width="100%" />
        <Switch label="Caption background" value={value.captionBackground} onChange={(enabled) => update("captionBackground", enabled)} labelSpacing="spread" width="100%" />
        {value.captionBackground && <Slider label="Background opacity" min={10} max={100} value={value.backgroundOpacity} valueDisplay="text" formatValue={(opacity: number) => `${opacity}%`} onChange={(opacity: number) => update("backgroundOpacity", opacity)} />}
        <Switch label="Uppercase" value={value.uppercase} onChange={(enabled) => update("uppercase", enabled)} labelSpacing="spread" width="100%" />
      </section>
    </div>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <span className="color-control-input">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label} color`} />
        <code>{value.toUpperCase()}</code>
      </span>
    </label>
  );
}
