import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export const lyricstapperTheme = defineTheme({
  name: "lyricstapper",
  extends: neutralTheme,
  color: {
    accent: "#0B8F7B",
    contrast: "high",
    neutralStyle: "cool",
  },
  motion: {
    fast: 140,
    medium: 260,
    ratio: 0.75,
  },
  radius: {
    base: 5,
    multiplier: 1.2,
  },
  typography: {
    scale: { base: 15, ratio: 1.18 },
    body: {
      family: "Lyricstapper Geist",
      fallbacks: "Arial, sans-serif",
    },
    heading: {
      family: "Lyricstapper Geist",
      fallbacks: "Arial, sans-serif",
    },
    code: {
      family: "Lyricstapper Geist Mono",
      fallbacks: "Courier New, monospace",
    },
  },
});
