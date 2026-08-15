import { CaptionStyle, normalizeCaptionStyle } from "./captionStyle";
import { TimedLine, TimedWord } from "./captions";

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
  media: ProjectMedia;
  lyrics: string[];
  captions: TimedLine[];
  captionStyle: CaptionStyle;
};

function validWord(value: unknown): value is TimedWord {
  if (!value || typeof value !== "object") return false;
  const word = value as Partial<TimedWord>;
  return typeof word.word === "string" && Number.isFinite(word.start) && Number.isFinite(word.end);
}

function parseLines(value: unknown): TimedLine[] {
  if (!Array.isArray(value)) throw new Error("The project contains no caption lines.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Caption line ${index + 1} is invalid.`);
    const line = item as Partial<TimedLine>;
    if (typeof line.text !== "string") throw new Error(`Caption line ${index + 1} has no text.`);
    const start = line.start === null || Number.isFinite(line.start) ? line.start ?? null : null;
    const end = line.end === null || Number.isFinite(line.end) ? line.end ?? null : null;
    const words = Array.isArray(line.words) && line.words.every(validWord) ? line.words : undefined;
    return { id: typeof line.id === "string" ? line.id : `project-${Date.now()}-${index}`, text: line.text, start, end, words };
  });
}

export function createProject(lines: TimedLine[], style: CaptionStyle, media: ProjectMedia): LyricsTapperProject {
  return {
    format: "lyricstapper-project",
    version: 1,
    savedAt: new Date().toISOString(),
    media,
    lyrics: lines.map((line) => line.text),
    captions: lines,
    captionStyle: style,
  };
}

export function serializeProject(lines: TimedLine[], style: CaptionStyle, media: ProjectMedia): string {
  return JSON.stringify(createProject(lines, style, media), null, 2);
}

export function parseProject(content: string): LyricsTapperProject {
  const parsed = JSON.parse(content) as Partial<LyricsTapperProject> & { format?: string };
  const supportedFormat = parsed.format === "lyricstapper-project" || parsed.format === "beatmark-project";
  if (!supportedFormat || parsed.version !== 1) throw new Error("This is not a supported lyricstapper project file.");
  const media = parsed.media;
  if (!media || typeof media.name !== "string") throw new Error("The project contains no media reference.");
  const captions = parseLines(parsed.captions);
  return {
    format: "lyricstapper-project",
    version: 1,
    savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    media: {
      name: media.name,
      duration: Number.isFinite(media.duration) ? media.duration : 0,
      width: Number.isFinite(media.width) ? media.width : 720,
      height: Number.isFinite(media.height) ? media.height : 1280,
      size: Number.isFinite(media.size) ? media.size : undefined,
      lastModified: Number.isFinite(media.lastModified) ? media.lastModified : undefined,
    },
    lyrics: Array.isArray(parsed.lyrics) ? parsed.lyrics.filter((item): item is string => typeof item === "string") : captions.map((line) => line.text),
    captions,
    captionStyle: normalizeCaptionStyle(parsed.captionStyle),
  };
}
