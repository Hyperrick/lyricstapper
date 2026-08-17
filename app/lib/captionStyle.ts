export type HighlightMode = "none" | "text" | "wipe" | "background";

export type CaptionStyle = {
  fontFamily: string;
  fontSizePercent: number;
  maxWidthPercent: number;
  fontWeight: 500 | 700 | 900;
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
];

export const CAPTION_FONTS = [
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

export function normalizeCaptionStyle(value: unknown): CaptionStyle {
  if (!value || typeof value !== "object") return DEFAULT_CAPTION_STYLE;
  const candidate = value as Partial<CaptionStyle>;
  return { ...DEFAULT_CAPTION_STYLE, ...candidate };
}

export function colorWithOpacity(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  const expanded = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const number = Number.parseInt(expanded, 16);
  if (!Number.isFinite(number)) return `rgba(0,0,0,${opacity / 100})`;
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${opacity / 100})`;
}

export function assColor(hex: string, alpha = 0): string {
  const clean = hex.replace("#", "").padEnd(6, "0");
  const red = clean.slice(0, 2);
  const green = clean.slice(2, 4);
  const blue = clean.slice(4, 6);
  return `&H${Math.round(alpha).toString(16).padStart(2, "0").toUpperCase()}${blue}${green}${red}`.toUpperCase();
}
