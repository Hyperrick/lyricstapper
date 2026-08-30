export const IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxCaptionLines: 10_000,
  maxCaptionTextLength: 4_000,
  maxWordsPerLine: 1_000,
  maxWordLength: 256,
  maxTimelineSeconds: 24 * 60 * 60,
  maxMediaNameLength: 255,
  maxVideoDimension: 16_384,
  maxIdentifierLength: 128,
} as const;

export type ValidatedTimedWord = {
  word: string;
  start: number;
  end: number;
};

export type ValidatedTimedLine = {
  id: string;
  text: string;
  start: number | null;
  end: number | null;
  words?: ValidatedTimedWord[];
};

type CaptionValidationOptions = {
  allowIncomplete: boolean;
  idPrefix: string;
  maximumEndTime?: number;
  requireNonEmpty?: boolean;
};

type NumberValidationOptions = {
  minimum: number;
  maximum: number;
  integer?: boolean;
};

const utf8Encoder = new TextEncoder();
const TIMING_TOLERANCE_SECONDS = 0.05;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafeControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint === 127 || (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13);
  });
}

export function validateShortString(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  if (value.length > maximumLength) throw new Error(`${label} is too long.`);
  if (hasUnsafeControlCharacters(value)) throw new Error(`${label} contains unsupported control characters.`);
  return value;
}

export function validateBoundedNumber(value: unknown, label: string, options: NumberValidationOptions): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (value < options.minimum || value > options.maximum) {
    throw new Error(`${label} must be between ${options.minimum} and ${options.maximum}.`);
  }
  if (options.integer && !Number.isInteger(value)) throw new Error(`${label} must be an integer.`);
  return value;
}

export function assertImportFilename(filename: string): void {
  validateShortString(filename, "The import filename", IMPORT_LIMITS.maxMediaNameLength);
  if (!/\.(?:json|srt|ass)$/i.test(filename)) throw new Error("Please choose a JSON, SRT, or ASS caption file.");
}

export function assertImportFile(file: Pick<File, "name" | "size">): void {
  assertImportFilename(file.name);
  validateBoundedNumber(file.size, "The import file size", {
    minimum: 1,
    maximum: IMPORT_LIMITS.maxFileBytes,
    integer: true,
  });
}

export function validateMediaFilename(value: unknown, label: string): string {
  const filename = validateShortString(value, label, IMPORT_LIMITS.maxMediaNameLength);
  if (filename === "." || filename === ".." || /[\\/]/.test(filename)) {
    throw new Error(`${label} must be a filename without path separators.`);
  }
  return filename;
}

export function assertImportContentSize(content: string): void {
  if (typeof content !== "string") throw new Error("The import content must be text.");
  if (content.length > IMPORT_LIMITS.maxFileBytes || utf8Encoder.encode(content).byteLength > IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`Import files may not exceed ${IMPORT_LIMITS.maxFileBytes / 1024 / 1024} MB.`);
  }
}

export function parseJsonRecord(content: string, label: string): Record<string, unknown> {
  assertImportContentSize(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (!isRecord(parsed)) throw new Error(`${label} must contain a JSON object.`);
  return parsed;
}

export function validateCaptionText(value: unknown, label: string): string {
  const text = validateShortString(value, label, IMPORT_LIMITS.maxCaptionTextLength).replace(/\r\n/g, "\n");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > IMPORT_LIMITS.maxWordsPerLine) {
    throw new Error(`${label} contains more than ${IMPORT_LIMITS.maxWordsPerLine} words.`);
  }
  return text;
}

function validateTime(value: unknown, label: string): number {
  return validateBoundedNumber(value, label, {
    minimum: 0,
    maximum: IMPORT_LIMITS.maxTimelineSeconds,
  });
}

function validateWords(value: unknown, lineLabel: string, lineStart: number | null, lineEnd: number | null): ValidatedTimedWord[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${lineLabel} has invalid word timing.`);
  if (value.length > IMPORT_LIMITS.maxWordsPerLine) {
    throw new Error(`${lineLabel} contains too many timed words.`);
  }
  if (!value.length) return undefined;
  if (lineStart === null || lineEnd === null) throw new Error(`${lineLabel} cannot contain words without complete line timing.`);

  let previousEnd = lineStart;
  return value.map((entry, index) => {
    const wordLabel = `${lineLabel}, word ${index + 1}`;
    if (!isRecord(entry)) throw new Error(`${wordLabel} is invalid.`);
    const word = validateShortString(entry.word, `${wordLabel} text`, IMPORT_LIMITS.maxWordLength);
    const start = validateTime(entry.start, `${wordLabel} start`);
    const end = validateTime(entry.end, `${wordLabel} end`);
    if (end <= start) throw new Error(`${wordLabel} must end after it starts.`);
    if (start < lineStart - TIMING_TOLERANCE_SECONDS || end > lineEnd + TIMING_TOLERANCE_SECONDS) {
      throw new Error(`${wordLabel} must stay within its caption line.`);
    }
    if (start < previousEnd) throw new Error(`${wordLabel} overlaps the preceding word.`);
    previousEnd = end;
    return { word, start, end };
  });
}

export function validateCaptionLines(value: unknown, options: CaptionValidationOptions): ValidatedTimedLine[] {
  if (!Array.isArray(value)) throw new Error("The file contains no caption lines.");
  if (value.length > IMPORT_LIMITS.maxCaptionLines) {
    throw new Error(`Import files may not contain more than ${IMPORT_LIMITS.maxCaptionLines} caption lines.`);
  }
  if (options.requireNonEmpty && value.length === 0) throw new Error("The file contains no caption lines.");

  if (options.maximumEndTime !== undefined) {
    validateBoundedNumber(options.maximumEndTime, "The media duration", {
      minimum: 0,
      maximum: IMPORT_LIMITS.maxTimelineSeconds,
    });
  }

  const identifiers = new Set<string>();
  return value.map((entry, index) => {
    const lineLabel = `Caption line ${index + 1}`;
    if (!isRecord(entry)) throw new Error(`${lineLabel} is invalid.`);
    const text = validateCaptionText(entry.text, `${lineLabel} text`);
    const start = entry.start === null || entry.start === undefined
      ? null
      : validateTime(entry.start, `${lineLabel} start`);
    const end = entry.end === null || entry.end === undefined
      ? null
      : validateTime(entry.end, `${lineLabel} end`);

    if (!options.allowIncomplete && (start === null || end === null)) throw new Error(`${lineLabel} has incomplete timing.`);
    if (start === null && end !== null) throw new Error(`${lineLabel} has an end time without a start time.`);
    if (start !== null && end !== null && end <= start) throw new Error(`${lineLabel} must end after it starts.`);
    if (options.maximumEndTime !== undefined
      && ((start !== null && start > options.maximumEndTime) || (end !== null && end > options.maximumEndTime))) {
      throw new Error(`${lineLabel} exceeds the media duration.`);
    }

    const id = entry.id === undefined
      ? `${options.idPrefix}-${index}`
      : validateShortString(entry.id, `${lineLabel} ID`, IMPORT_LIMITS.maxIdentifierLength);
    if (identifiers.has(id)) throw new Error(`${lineLabel} has a duplicate ID.`);
    identifiers.add(id);
    const words = validateWords(entry.words, lineLabel, start, end);
    return { id, text, start, end, words };
  });
}

export function validateLyrics(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Project lyrics must be an array.");
  if (value.length > IMPORT_LIMITS.maxCaptionLines) throw new Error("The project contains too many lyric lines.");
  return value.map((entry, index) => validateCaptionText(entry, `Lyric line ${index + 1}`));
}
