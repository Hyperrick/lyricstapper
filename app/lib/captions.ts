import { assColor, CaptionStyle, DEFAULT_CAPTION_STYLE } from "./captionStyle";

export type TimedLine = {
  id: string;
  text: string;
  start: number | null;
  end: number | null;
  words?: TimedWord[];
};

export type TimedWord = {
  word: string;
  start: number;
  end: number;
};

export function parseLyrics(value: string): TimedLine[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[.+\]$/.test(line))
    .map((text, index) => ({ id: `${Date.now()}-${index}`, text, start: null, end: null }));
}

export function distributeWords(line: TimedLine): TimedWord[] {
  if (line.start === null || line.end === null || line.end <= line.start) return [];
  if (line.words?.length) return line.words;
  const words = line.text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const duration = (line.end - line.start) / words.length;
  return words.map((word, index) => ({
    word,
    start: line.start! + duration * index,
    end: index === words.length - 1 ? line.end! : line.start! + duration * (index + 1),
  }));
}

export function wordsFromBoundaries(text: string, boundaries: number[], end: number): TimedWord[] | undefined {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || boundaries.length < 2) return undefined;
  const starts = boundaries.slice(0, words.length).map((value, index, values) => index === 0 ? value : Math.max(value, values[index - 1] + 0.01));
  const remaining = words.length - starts.length;
  if (remaining > 0) {
    const step = Math.max(0.01, (end - starts[starts.length - 1]) / (remaining + 1));
    for (let index = 1; index <= remaining; index += 1) starts.push(starts[starts.length - 1] + step);
  }
  return words.map((word, index) => ({
    word,
    start: starts[index],
    end: index === words.length - 1 ? end : starts[index + 1],
  }));
}

export function formatClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--.---";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(3).padStart(6, "0")}`;
}

function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function assTime(seconds: number): string {
  const cs = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(cs / 360_000);
  const minutes = Math.floor((cs % 360_000) / 6000);
  const secs = Math.floor((cs % 6000) / 100);
  const centis = cs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function completed(lines: TimedLine[]): TimedLine[] {
  return lines.filter((line) => line.start !== null && line.end !== null && line.end > line.start);
}

export function toSrt(lines: TimedLine[]): string {
  return completed(lines)
    .map((line, index) => `${index + 1}\n${srtTime(line.start!)} --> ${srtTime(line.end!)}\n${line.text}\n`)
    .join("\n");
}

export function toJson(lines: TimedLine[], mediaName: string, duration: number): string {
  const captions = completed(lines).map((line) => ({
    text: line.text,
    start: line.start,
    end: line.end,
    words: distributeWords(line),
  }));
  return JSON.stringify({ version: 1, media: mediaName, duration, captions }, null, 2);
}

function assEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
}

export function toAss(lines: TimedLine[], videoWidth = 720, videoHeight = 1280, style: CaptionStyle = DEFAULT_CAPTION_STYLE): string {
  const width = Math.max(1, Math.round(videoWidth));
  const height = Math.max(1, Math.round(videoHeight));
  const fontSize = Math.max(18, Math.round(height * style.fontSizePercent / 100));
  const sideMargin = Math.max(24, Math.round(width * 0.08));
  const bottomMargin = Math.max(20, Math.round(height * style.bottomPercent / 100));
  const outline = style.outline ? Math.max(2, Math.round(height * 0.004)) : 0;
  const shadow = style.shadow ? Math.max(1, Math.round(height * 0.002)) : 0;
  const activeColor = style.highlightMode === "none" ? style.textColor : style.highlightColor;
  const backgroundAlpha = 255 - Math.round(style.backgroundOpacity * 2.55);
  const borderStyle = style.captionBackground ? 3 : 1;
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Lyric,${style.fontFamily},${fontSize},${assColor(activeColor)},${assColor(style.textColor)},${assColor("#090a0d")},${assColor(style.backgroundColor, backgroundAlpha)},${style.fontWeight >= 700 ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${sideMargin},${sideMargin},${bottomMargin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const events = completed(lines).map((line) => {
    const words = distributeWords(line);
    const karaoke = words
      .map((word) => `{\\kf${Math.max(1, Math.round((word.end - word.start) * 100))}}${assEscape(style.uppercase ? word.word.toUpperCase() : word.word)}`)
      .join(" ");
    return `Dialogue: 0,${assTime(line.start!)},${assTime(line.end!)},Lyric,,0,0,0,,{\\fad(120,140)}${karaoke}`;
  });
  return header + events.join("\n") + "\n";
}

export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseSrtTime(value: string): number {
  const match = value.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, "0").slice(0, 3)) / 1000;
}

function parseAssTime(value: string): number {
  const match = value.trim().match(/(\d+):(\d+):(\d+)[.](\d+)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(2, "0").slice(0, 2)) / 100;
}

function importedLine(text: string, start: number, end: number, index: number, words?: TimedWord[]): TimedLine {
  return { id: `import-${Date.now()}-${index}`, text, start, end, words };
}

export function importCaptionFile(filename: string, content: string): TimedLine[] {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "json") {
    const parsed = JSON.parse(content) as { captions?: Array<{ text?: string; start?: number; end?: number; words?: TimedWord[] }> };
    if (!Array.isArray(parsed.captions)) throw new Error("No captions found in JSON file.");
    return parsed.captions
      .filter((caption) => typeof caption.text === "string" && Number.isFinite(caption.start) && Number.isFinite(caption.end))
      .map((caption, index) => importedLine(caption.text!, caption.start!, caption.end!, index, caption.words));
  }

  if (extension === "srt") {
    return content.trim().split(/\r?\n\s*\r?\n/).flatMap((block, index) => {
      const rows = block.split(/\r?\n/);
      const timingIndex = rows.findIndex((row) => row.includes("-->"));
      if (timingIndex === -1) return [];
      const [startText, endText] = rows[timingIndex].split("-->");
      const text = rows.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
      return text ? [importedLine(text, parseSrtTime(startText), parseSrtTime(endText), index)] : [];
    });
  }

  if (extension === "ass") {
    return content.split(/\r?\n/).filter((row) => row.startsWith("Dialogue:")).map((row, index) => {
      const fields = row.slice("Dialogue:".length).split(",");
      const start = parseAssTime(fields[1] ?? "0:00:00.00");
      const end = parseAssTime(fields[2] ?? "0:00:00.00");
      const assText = fields.slice(9).join(",");
      const words: TimedWord[] = [];
      let cursor = start;
      const karaokePattern = /\{\\k(?:f|o)?(\d+)\}([^{}]*)/gi;
      let match: RegExpExecArray | null;
      while ((match = karaokePattern.exec(assText))) {
        const word = match[2].replace(/\\[Nn]/g, " ").trim();
        const wordEnd = cursor + Number(match[1]) / 100;
        if (word) words.push({ word, start: cursor, end: wordEnd });
        cursor = wordEnd;
      }
      const text = (words.length ? words.map((word) => word.word).join(" ") : assText.replace(/\{[^}]*\}/g, "").replace(/\\[Nn]/g, " ")).trim();
      return importedLine(text, start, end, index, words.length ? words : undefined);
    }).filter((line) => line.text);
  }

  throw new Error("Please choose a JSON, SRT, or ASS caption file.");
}
