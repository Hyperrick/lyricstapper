import assert from "node:assert/strict";
import test from "node:test";
import { CAPTION_FONTS, CAPTION_PRESETS } from "../app/lib/captionStyle.ts";

const halloweenStyle = {
  fontFamily: "Creepster",
  fontSizePercent: 5.8,
  maxWidthPercent: 88,
  fontWeight: 400,
  textColor: "#f6e7c1",
  pastOpacity: 64,
  highlightMode: "background",
  highlightColor: "#ff7a00",
  highlightTextColor: "#2b0a3d",
  shadow: true,
  outline: true,
  captionBackground: true,
  backgroundColor: "#241033",
  backgroundOpacity: 76,
  centerXPercent: 50,
  bottomPercent: 15,
  uppercase: false,
};

test("offers the Creepster font and complete Halloween preset", () => {
  assert.ok(CAPTION_FONTS.some((font) => font.value === "Creepster"));
  assert.deepEqual(CAPTION_PRESETS.find((preset) => preset.name === "Halloween")?.style, halloweenStyle);
});
