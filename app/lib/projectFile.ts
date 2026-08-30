import { parseCaptionStyle } from "./captionStyle";
import type { CaptionStyle } from "./captionStyle";
import { captionSourceText } from "./captions";
import type { TimedLine } from "./captions";
import { IMPORT_LIMITS, isRecord, parseJsonRecord, validateBoundedNumber, validateCaptionLines, validateLyrics, validateMediaFilename, validateShortString } from "./importValidation";

export type ProjectMedia = {
  name: string;
  duration: number;
  width: number;
  height: number;
  size?: number;
  lastModified?: number;
};

export type LyricsTapperProject = {
  format: "lyricstapper-project";
  version: 1;
  savedAt: string;
  sourceDirectoryId?: string;
  media: ProjectMedia;
  lyrics: string[];
  captions: TimedLine[];
  captionStyle: CaptionStyle;
};

function sourceDirectoryIdFrom(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  const sourceDirectoryId = validateShortString(value, "Project directory ID", IMPORT_LIMITS.maxIdentifierLength);
  if (!/^[a-z0-9_-]+$/i.test(sourceDirectoryId)) throw new Error("Project directory ID is invalid.");
  return sourceDirectoryId;
}

function projectMediaFrom(value: unknown, allowMissingName: boolean): ProjectMedia {
  if (!isRecord(value)) throw new Error("The project contains no media reference.");
  return {
    name: allowMissingName && value.name === ""
      ? ""
      : validateMediaFilename(value.name, "Project media name"),
    duration: validateBoundedNumber(value.duration, "Project media duration", {
      minimum: 0,
      maximum: IMPORT_LIMITS.maxTimelineSeconds,
    }),
    width: value.width === undefined
      ? 720
      : validateBoundedNumber(value.width, "Project media width", { minimum: 1, maximum: IMPORT_LIMITS.maxVideoDimension, integer: true }),
    height: value.height === undefined
      ? 1280
      : validateBoundedNumber(value.height, "Project media height", { minimum: 1, maximum: IMPORT_LIMITS.maxVideoDimension, integer: true }),
    size: value.size === undefined
      ? undefined
      : validateBoundedNumber(value.size, "Project media size", { minimum: 0, maximum: Number.MAX_SAFE_INTEGER, integer: true }),
    lastModified: value.lastModified === undefined
      ? undefined
      : validateBoundedNumber(value.lastModified, "Project media modified time", { minimum: 0, maximum: Number.MAX_SAFE_INTEGER, integer: true }),
  };
}

function normalizeLegacyProjectCaptions(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!isRecord(entry)) return entry;
    const hasNoStart = entry.start === null || entry.start === undefined;
    const hasFiniteEnd = typeof entry.end === "number" && Number.isFinite(entry.end);
    return hasNoStart && hasFiniteEnd ? { ...entry, end: null } : entry;
  });
}

export function createProject(lines: TimedLine[], style: CaptionStyle, media: ProjectMedia, sourceDirectoryId?: string): LyricsTapperProject {
  const validatedMedia = projectMediaFrom(media, false);
  const validatedCaptions = validateCaptionLines(lines, {
    allowIncomplete: true,
    idPrefix: "project",
    maximumEndTime: validatedMedia.duration > 0 ? validatedMedia.duration : undefined,
  });
  return {
    format: "lyricstapper-project",
    version: 1,
    savedAt: new Date().toISOString(),
    sourceDirectoryId: sourceDirectoryIdFrom(sourceDirectoryId),
    media: validatedMedia,
    lyrics: validatedCaptions.map((line) => captionSourceText(line.text)),
    captions: validatedCaptions,
    captionStyle: parseCaptionStyle(style),
  };
}

export function serializeProject(lines: TimedLine[], style: CaptionStyle, media: ProjectMedia, sourceDirectoryId?: string): string {
  return JSON.stringify(createProject(lines, style, media, sourceDirectoryId), null, 2);
}

export function projectFingerprint(lines: TimedLine[], style: CaptionStyle, media: ProjectMedia): string {
  return JSON.stringify({ media, lyrics: lines.map((line) => captionSourceText(line.text)), captions: lines, captionStyle: style });
}

export function parseProject(content: string): LyricsTapperProject {
  const parsed = parseJsonRecord(content, "The project file");
  const supportedFormat = parsed.format === "lyricstapper-project" || parsed.format === "beatmark-project";
  if (!supportedFormat || parsed.version !== 1) throw new Error("This is not a supported lyricstapper project file.");
  const media = projectMediaFrom(parsed.media, true);
  const captions = validateCaptionLines(normalizeLegacyProjectCaptions(parsed.captions), {
    allowIncomplete: true,
    idPrefix: `project-${Date.now()}`,
    maximumEndTime: media.duration > 0 ? media.duration : undefined,
  });
  const savedAt = parsed.savedAt === undefined || parsed.savedAt === ""
    ? ""
    : validateShortString(parsed.savedAt, "Project savedAt", 64);
  if (savedAt && !Number.isFinite(Date.parse(savedAt))) throw new Error("Project savedAt must be a valid date.");
  const sourceDirectoryId = sourceDirectoryIdFrom(parsed.sourceDirectoryId);
  return {
    format: "lyricstapper-project",
    version: 1,
    savedAt,
    sourceDirectoryId,
    media,
    lyrics: parsed.lyrics === undefined ? captions.map((line) => line.text) : validateLyrics(parsed.lyrics),
    captions,
    captionStyle: parseCaptionStyle(parsed.captionStyle),
  };
}
