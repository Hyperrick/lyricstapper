import { assColor, DEFAULT_CAPTION_STYLE, normalizeCaptionStyle } from "./captionStyle";
import type { CaptionStyle } from "./captionStyle";
import { assertImportContentSize, assertImportFilename, IMPORT_LIMITS, parseJsonRecord, validateBoundedNumber, validateCaptionLines } from "./importValidation";

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

export type CompletedTimedLine = TimedLine & {
  start: number;
  end: number;
};

export function isTimedLine(line: TimedLine): line is CompletedTimedLine {
  return line.start !== null && line.end !== null && line.end > line.start;
}

export function boundedCaptionEnd(start: number, requestedEnd: number, mediaDuration: number): number | null {
  if (!Number.isFinite(start) || !Number.isFinite(requestedEnd) || start < 0) return null;
  const maximumEnd = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : Number.POSITIVE_INFINITY;
  if (maximumEnd <= start) return null;
  return Math.min(maximumEnd, Math.max(requestedEnd, start + 0.05));
}

export function captionSourceText(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function forcedLineBreakWordIndexes(text: string): Set<number> {
  const indexes = new Set<number>();
  let wordCount = 0;
  text.split(/\r?\n/).forEach((row, rowIndex) => {
    if (rowIndex > 0 && row.trim() && wordCount > 0) indexes.add(wordCount);
    wordCount += row.split(/\s+/).filter(Boolean).length;
  });
  return indexes;
}

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

export function replaceTimedLineText(line: TimedLine, text: string): TimedLine {
  const words = text.split(/\s+/).filter(Boolean);
  const timedWords = distributeWords(line);

  return {
    ...line,
    text,
    words: timedWords.length === words.length
      ? timedWords.map((timedWord, index) => ({ ...timedWord, word: words[index] }))
      : undefined,
  };
}

export function wordProgress(word: TimedWord, time: number): number {
  const duration = word.end - word.start;
  if (duration <= 0) return time >= word.end ? 1 : 0;
  return Math.max(0, Math.min(1, (time - word.start) / duration));
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

function assTimeFromCentiseconds(cs: number): string {
  const hours = Math.floor(cs / 360_000);
  const minutes = Math.floor((cs % 360_000) / 6000);
  const secs = Math.floor((cs % 6000) / 100);
  const centis = cs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function distributeAssCentiseconds(words: TimedWord[], totalCentiseconds: number): number[] {
  if (!words.length) return [];
  const target = Math.max(words.length, totalCentiseconds);
  const remaining = target - words.length;
  const weights = words.map((word) => Math.max(0, word.end - word.start));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map((weight) => remaining * (totalWeight > 0 ? weight / totalWeight : 1 / words.length));
  const durations = shares.map((share) => 1 + Math.floor(share));
  const undistributed = target - durations.reduce((sum, duration) => sum + duration, 0);
  const remainderOrder = shares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < undistributed; index += 1) durations[remainderOrder[index].index] += 1;
  return durations;
}

function completed(lines: TimedLine[]): CompletedTimedLine[] {
  return lines.filter(isTimedLine);
}

export function toSrt(lines: TimedLine[]): string {
  return completed(lines)
    .map((line, index) => `${index + 1}\n${srtTime(line.start)} --> ${srtTime(line.end)}\n${line.text}\n`)
    .join("\n");
}

export function toJson(lines: TimedLine[], mediaName: string, duration: number): string {
  const captions = completed(lines).map((line) => ({
    text: line.text,
    start: line.start,
    end: line.end,
    words: distributeWords(line),
  }));
  const captionDuration = captions.reduce((maximum, caption) => Math.max(maximum, caption.end), 0);
  const effectiveDuration = Math.max(Number.isFinite(duration) ? duration : 0, captionDuration);
  return JSON.stringify({ version: 1, media: mediaName, duration: effectiveDuration, captions }, null, 2);
}

function assEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
}

export function toAss(lines: TimedLine[], videoWidth = 720, videoHeight = 1280, inputStyle: CaptionStyle = DEFAULT_CAPTION_STYLE): string {
  const style = normalizeCaptionStyle(inputStyle);
  const width = Math.max(1, Math.round(videoWidth));
  const height = Math.max(1, Math.round(videoHeight));
  const fontSize = Math.max(18, Math.round(height * style.fontSizePercent / 100));
  const sideMargin = Math.max(0, Math.round(width * (100 - style.maxWidthPercent) / 200));
  const bottomMargin = Math.max(20, Math.round(height * style.bottomPercent / 100));
  const positionX = Math.round(width * style.centerXPercent / 100);
  const positionY = Math.round(height * (1 - style.bottomPercent / 100));
  const outline = style.outline ? Math.max(2, Math.round(height * 0.004)) : 0;
  const shadow = style.shadow ? Math.max(1, Math.round(height * 0.002)) : 0;
  const activeColor = style.highlightMode === "none" ? style.textColor : style.highlightColor;
  const backgroundAlpha = 255 - Math.round(style.backgroundOpacity * 2.55);
  const borderStyle = style.captionBackground ? 3 : 1;
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Lyric,${style.fontFamily},${fontSize},${assColor(activeColor)},${assColor(style.textColor)},${assColor("#090a0d")},${assColor(style.backgroundColor, backgroundAlpha)},${style.fontWeight >= 700 ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${sideMargin},${sideMargin},${bottomMargin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const events = completed(lines).map((line) => {
    const words = distributeWords(line);
    const forcedBreaks = forcedLineBreakWordIndexes(line.text);
    const karaokeTag = style.highlightMode === "wipe" ? "\\kf" : "\\k";
    const startCentiseconds = Math.max(0, Math.round(line.start * 100));
    const lineCentiseconds = Math.max(1, Math.round(line.end * 100) - startCentiseconds);
    const wordDurations = distributeAssCentiseconds(words, lineCentiseconds);
    const karaoke = words
      .map((word, index) => `{${karaokeTag}${wordDurations[index]}}${index === 0 ? "" : forcedBreaks.has(index) ? "\\N" : " "}${assEscape(style.uppercase ? word.word.toUpperCase() : word.word)}`)
      .join("");
    const endCentiseconds = startCentiseconds + wordDurations.reduce((sum, duration) => sum + duration, 0);
    return `Dialogue: 0,${assTimeFromCentiseconds(startCentiseconds)},${assTimeFromCentiseconds(endCentiseconds)},Lyric,,0,0,0,,{\\an2\\pos(${positionX},${positionY})\\fad(120,140)}${karaoke}`;
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

function parseTimestamp(value: string, label: string, fractionScale: number): number {
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})$/);
  if (!match) throw new Error(`${label} is not a valid timestamp.`);
  const fraction = Number(match[4].padEnd(fractionScale, "0").slice(0, fractionScale)) / 10 ** fractionScale;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
  if (!Number.isFinite(seconds) || seconds > IMPORT_LIMITS.maxTimelineSeconds) {
    throw new Error(`${label} exceeds the ${IMPORT_LIMITS.maxTimelineSeconds / 3600}-hour timeline limit.`);
  }
  return seconds;
}

function parseSrtTime(value: string, label: string): number {
  return parseTimestamp(value, label, 3);
}

function parseAssTime(value: string, label: string): number {
  return parseTimestamp(value, label, 2);
}

export function importCaptionFile(filename: string, content: string): TimedLine[] {
  assertImportFilename(filename);
  assertImportContentSize(content);
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "json") {
    const parsed = parseJsonRecord(content, "The caption JSON file");
    const parsedDuration = parsed.duration === undefined
      ? undefined
      : validateBoundedNumber(parsed.duration, "Caption media duration", {
        minimum: 0,
        maximum: IMPORT_LIMITS.maxTimelineSeconds,
      });
    return validateCaptionLines(parsed.captions, {
      allowIncomplete: false,
      idPrefix: `import-${Date.now()}`,
      maximumEndTime: parsedDuration !== undefined && parsedDuration > 0 ? parsedDuration : undefined,
      requireNonEmpty: true,
    });
  }

  if (extension === "srt") {
    const blocks = content.trim() ? content.trim().split(/\r?\n\s*\r?\n/) : [];
    if (blocks.length > IMPORT_LIMITS.maxCaptionLines) {
      throw new Error(`Import files may not contain more than ${IMPORT_LIMITS.maxCaptionLines} caption lines.`);
    }
    const captions = blocks.map((block, index) => {
      const rows = block.split(/\r?\n/);
      const timingIndex = rows.findIndex((row) => row.includes("-->"));
      if (timingIndex === -1) throw new Error(`SRT caption ${index + 1} has no timing row.`);
      const [startText, endText] = rows[timingIndex].split("-->");
      const text = rows.slice(timingIndex + 1).join("\n").replace(/<[^>]+>/g, "").trim();
      if (!text) throw new Error(`SRT caption ${index + 1} has no text.`);
      return {
        text,
        start: parseSrtTime(startText ?? "", `SRT caption ${index + 1} start`),
        end: parseSrtTime(endText ?? "", `SRT caption ${index + 1} end`),
      };
    });
    return validateCaptionLines(captions, {
      allowIncomplete: false,
      idPrefix: `import-${Date.now()}`,
      requireNonEmpty: true,
    });
  }

  if (extension === "ass") {
    const dialogueRows = content.split(/\r?\n/).filter((row) => row.startsWith("Dialogue:"));
    if (dialogueRows.length > IMPORT_LIMITS.maxCaptionLines) {
      throw new Error(`Import files may not contain more than ${IMPORT_LIMITS.maxCaptionLines} caption lines.`);
    }
    const captions = dialogueRows.map((row, index) => {
      const fields = row.slice("Dialogue:".length).split(",");
      if (fields.length < 10) throw new Error(`ASS dialogue ${index + 1} is incomplete.`);
      const start = parseAssTime(fields[1] ?? "", `ASS dialogue ${index + 1} start`);
      const end = parseAssTime(fields[2] ?? "", `ASS dialogue ${index + 1} end`);
      const assText = fields.slice(9).join(",");
      const words: TimedWord[] = [];
      const wordRows: string[][] = [[]];
      let cursor = start;
      const karaokePattern = /\{\\k(?:f|o)?(\d+)\}([^{}]*)/gi;
      let match: RegExpExecArray | null;
      while ((match = karaokePattern.exec(assText))) {
        const hasLineBreak = /\\N/.test(match[2]);
        const word = match[2].replace(/\\[Nn]/g, " ").trim();
        const duration = Number(match[1]) / 100;
        if (!Number.isFinite(duration) || duration <= 0 || duration > IMPORT_LIMITS.maxTimelineSeconds) {
          throw new Error(`ASS dialogue ${index + 1} contains invalid karaoke timing.`);
        }
        const wordEnd = cursor + duration;
        if (word) {
          if (words.length >= IMPORT_LIMITS.maxWordsPerLine) {
            throw new Error(`ASS dialogue ${index + 1} contains too many timed words.`);
          }
          if (hasLineBreak && wordRows[wordRows.length - 1].length) wordRows.push([]);
          wordRows[wordRows.length - 1].push(word);
          words.push({ word, start: cursor, end: wordEnd });
        }
        cursor = wordEnd;
      }
      const text = (words.length
        ? wordRows.map((wordsInRow) => wordsInRow.join(" ")).join("\n")
        : assText.replace(/\{[^}]*\}/g, "").replace(/\\N/g, "\n").replace(/\\n/g, " ")).trim();
      return { text, start, end, words: words.length ? words : undefined };
    }).filter((line) => line.text);
    return validateCaptionLines(captions, {
      allowIncomplete: false,
      idPrefix: `import-${Date.now()}`,
      requireNonEmpty: true,
    });
  }

  throw new Error("Please choose a JSON, SRT, or ASS caption file.");
}
