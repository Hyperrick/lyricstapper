export type HighlightMode = "none" | "text" | "wipe" | "background";

export type CaptionStyle = {
  fontFamily: string;
  fontSizePercent: number;
  maxWidthPercent: number;
  fontWeight: 400 | 500 | 700 | 900;
  textColor: string;
  pastOpacity: number;
  highlightMode: HighlightMode;
  highlightColor: string;
  highlightTextColor: string;
  shadow: boolean;
  outline: boolean;
  captionBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  centerXPercent: number;
  bottomPercent: number;
  uppercase: boolean;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Arial",
  fontSizePercent: 4.8,
  maxWidthPercent: 84,
  fontWeight: 900,
  textColor: "#ffffff",
  pastOpacity: 72,
  highlightMode: "text",
  highlightColor: "#62e6d2",
  highlightTextColor: "#07100f",
  shadow: true,
  outline: true,
  captionBackground: false,
  backgroundColor: "#090a0d",
  backgroundOpacity: 72,
  centerXPercent: 50,
  bottomPercent: 15,
  uppercase: false,
};

export const CAPTION_PRESETS: Array<{ name: string; style: CaptionStyle }> = [
  { name: "Karaoke", style: DEFAULT_CAPTION_STYLE },
  { name: "Punch", style: { ...DEFAULT_CAPTION_STYLE, fontFamily: "Impact", fontSizePercent: 5.4, highlightMode: "background", highlightColor: "#ffca61", shadow: true, uppercase: true } },
  { name: "Clean", style: { ...DEFAULT_CAPTION_STYLE, fontFamily: "Helvetica", fontWeight: 700, highlightColor: "#ff5e78", outline: false, shadow: true, captionBackground: true, backgroundOpacity: 58 } },
  { name: "Neon", style: { ...DEFAULT_CAPTION_STYLE, fontFamily: "Trebuchet MS", highlightMode: "background", highlightColor: "#62e6d2", outline: false, captionBackground: true, backgroundOpacity: 78 } },
  { name: "Halloween", style: { ...DEFAULT_CAPTION_STYLE, fontFamily: "Creepster", fontSizePercent: 5.8, maxWidthPercent: 88, fontWeight: 400, textColor: "#f6e7c1", pastOpacity: 64, highlightMode: "background", highlightColor: "#ff7a00", highlightTextColor: "#2b0a3d", captionBackground: true, backgroundColor: "#241033", backgroundOpacity: 76 } },
];

export const CAPTION_FONTS = [
  { value: "Creepster", label: "Creepster" },
  { value: "Inter Variable", label: "Inter" },
  { value: "Montserrat Variable", label: "Montserrat" },
  { value: "League Spartan Variable", label: "League Spartan" },
  { value: "Lexend Variable", label: "Lexend" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Impact", label: "Impact" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Verdana", label: "Verdana" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
];

const ALLOWED_FONT_FAMILIES = new Set(CAPTION_FONTS.map((font) => font.value));
const ALLOWED_FONT_WEIGHTS = new Set<CaptionStyle["fontWeight"]>([400, 500, 700, 900]);
const ALLOWED_HIGHLIGHT_MODES = new Set<HighlightMode>(["none", "text", "wipe", "background"]);
const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

type CaptionStyleRecord = Partial<Record<keyof CaptionStyle, unknown>>;

function invalidField(field: keyof CaptionStyle): never {
  throw new Error(`Caption style field "${field}" is invalid.`);
}

function numberField(record: CaptionStyleRecord, field: keyof CaptionStyle, fallback: number, minimum: number, maximum: number, strict: boolean): number {
  const value = record[field];
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum) return value;
  if (strict) invalidField(field);
  return fallback;
}

function booleanField(record: CaptionStyleRecord, field: keyof CaptionStyle, fallback: boolean, strict: boolean): boolean {
  const value = record[field];
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (strict) invalidField(field);
  return fallback;
}

function colorField(record: CaptionStyleRecord, field: keyof CaptionStyle, fallback: string, strict: boolean): string {
  const value = record[field];
  if (value === undefined) return fallback;
  if (typeof value === "string" && HEX_COLOR.test(value)) return value.toLowerCase();
  if (strict) invalidField(field);
  return fallback;
}

function captionStyleFrom(value: unknown, strict: boolean): CaptionStyle {
  if (value === undefined) return { ...DEFAULT_CAPTION_STYLE };
  if (value === null) {
    if (strict) throw new Error("Caption style must be an object.");
    return { ...DEFAULT_CAPTION_STYLE };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    if (strict) throw new Error("Caption style must be an object.");
    return { ...DEFAULT_CAPTION_STYLE };
  }
  const record = value as CaptionStyleRecord;
  const fontFamily = record.fontFamily === undefined
    ? DEFAULT_CAPTION_STYLE.fontFamily
    : typeof record.fontFamily === "string" && ALLOWED_FONT_FAMILIES.has(record.fontFamily)
      ? record.fontFamily
      : strict ? invalidField("fontFamily") : DEFAULT_CAPTION_STYLE.fontFamily;
  const fontWeight = record.fontWeight === undefined
    ? DEFAULT_CAPTION_STYLE.fontWeight
    : typeof record.fontWeight === "number" && ALLOWED_FONT_WEIGHTS.has(record.fontWeight as CaptionStyle["fontWeight"])
      ? record.fontWeight as CaptionStyle["fontWeight"]
      : strict ? invalidField("fontWeight") : DEFAULT_CAPTION_STYLE.fontWeight;
  const highlightMode = record.highlightMode === undefined
    ? DEFAULT_CAPTION_STYLE.highlightMode
    : typeof record.highlightMode === "string" && ALLOWED_HIGHLIGHT_MODES.has(record.highlightMode as HighlightMode)
      ? record.highlightMode as HighlightMode
      : strict ? invalidField("highlightMode") : DEFAULT_CAPTION_STYLE.highlightMode;

  return {
    fontFamily,
    fontSizePercent: numberField(record, "fontSizePercent", DEFAULT_CAPTION_STYLE.fontSizePercent, 2.5, 12, strict),
    maxWidthPercent: numberField(record, "maxWidthPercent", DEFAULT_CAPTION_STYLE.maxWidthPercent, 20, 96, strict),
    fontWeight,
    textColor: colorField(record, "textColor", DEFAULT_CAPTION_STYLE.textColor, strict),
    pastOpacity: numberField(record, "pastOpacity", DEFAULT_CAPTION_STYLE.pastOpacity, 0, 100, strict),
    highlightMode,
    highlightColor: colorField(record, "highlightColor", DEFAULT_CAPTION_STYLE.highlightColor, strict),
    highlightTextColor: colorField(record, "highlightTextColor", DEFAULT_CAPTION_STYLE.highlightTextColor, strict),
    shadow: booleanField(record, "shadow", DEFAULT_CAPTION_STYLE.shadow, strict),
    outline: booleanField(record, "outline", DEFAULT_CAPTION_STYLE.outline, strict),
    captionBackground: booleanField(record, "captionBackground", DEFAULT_CAPTION_STYLE.captionBackground, strict),
    backgroundColor: colorField(record, "backgroundColor", DEFAULT_CAPTION_STYLE.backgroundColor, strict),
    backgroundOpacity: numberField(record, "backgroundOpacity", DEFAULT_CAPTION_STYLE.backgroundOpacity, 0, 100, strict),
    centerXPercent: numberField(record, "centerXPercent", DEFAULT_CAPTION_STYLE.centerXPercent, 0, 100, strict),
    bottomPercent: numberField(record, "bottomPercent", DEFAULT_CAPTION_STYLE.bottomPercent, 0, 100, strict),
    uppercase: booleanField(record, "uppercase", DEFAULT_CAPTION_STYLE.uppercase, strict),
  };
}

export function normalizeCaptionStyle(value: unknown): CaptionStyle {
  return captionStyleFrom(value, false);
}

export function parseCaptionStyle(value: unknown): CaptionStyle {
  return captionStyleFrom(value, true);
}

export function colorWithOpacity(hex: string, opacity: number): string {
  const safeHex = HEX_COLOR.test(hex) ? hex : "#000000";
  const clean = safeHex.replace("#", "");
  const expanded = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const number = Number.parseInt(expanded, 16);
  const alpha = Math.max(0, Math.min(100, Number.isFinite(opacity) ? opacity : 0)) / 100;
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`;
}

export function assColor(hex: string, alpha = 0): string {
  const safeHex = HEX_COLOR.test(hex) ? hex : "#000000";
  const clean = safeHex.replace("#", "");
  const expanded = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const red = expanded.slice(0, 2);
  const green = expanded.slice(2, 4);
  const blue = expanded.slice(4, 6);
  const safeAlpha = Math.max(0, Math.min(255, Number.isFinite(alpha) ? Math.round(alpha) : 0));
  return `&H${safeAlpha.toString(16).padStart(2, "0").toUpperCase()}${blue}${green}${red}`.toUpperCase();
}
