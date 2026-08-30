import assert from "node:assert/strict";
import test from "node:test";
import "./typescript-loader.mjs";

const { DEFAULT_CAPTION_STYLE } = await import("../app/lib/captionStyle.ts");
const { parseProject, serializeProject } = await import("../app/lib/projectFile.ts");

const media = {
  name: "synthetic-demo.wav",
  duration: 12,
  width: 720,
  height: 1280,
  size: 48_000,
  lastModified: 1_788_112_800_000,
};

const captions = [{
  id: "line-1",
  text: "First\ncaption line",
  start: 0.5,
  end: 2.5,
  words: [
    { word: "First", start: 0.5, end: 1.1 },
    { word: "caption", start: 1.1, end: 1.8 },
    { word: "line", start: 1.8, end: 2.5 },
  ],
}, {
  id: "line-2",
  text: "Still waiting for timing",
  start: null,
  end: null,
  words: undefined,
}];

test("round-trips complete project state through the public file format", () => {
  const serialized = serializeProject(captions, DEFAULT_CAPTION_STYLE, media, "folder_2026");
  const parsed = parseProject(serialized);

  assert.match(parsed.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(parsed.sourceDirectoryId, "folder_2026");
  assert.deepEqual(parsed.media, media);
  assert.deepEqual(parsed.lyrics, ["First caption line", "Still waiting for timing"]);
  assert.deepEqual(parsed.captions, captions);
  assert.deepEqual(parsed.captionStyle, DEFAULT_CAPTION_STYLE);
});

test("keeps version 1 beatmark projects compatible with current defaults", () => {
  const parsed = parseProject(JSON.stringify({
    format: "beatmark-project",
    version: 1,
    savedAt: "",
    sourceDirectoryId: "",
    media: { name: "legacy.mp3", duration: 5 },
    captions: [{ text: "Legacy line", start: 0, end: 1 }],
  }));

  assert.equal(parsed.format, "lyricstapper-project");
  assert.equal(parsed.savedAt, "");
  assert.deepEqual(parsed.media, {
    name: "legacy.mp3",
    duration: 5,
    width: 720,
    height: 1280,
    size: undefined,
    lastModified: undefined,
  });
  assert.deepEqual(parsed.lyrics, ["Legacy line"]);
  assert.deepEqual(parsed.captionStyle, DEFAULT_CAPTION_STYLE);
});

test("normalizes legacy project lines that ended before they were started", () => {
  const parsed = parseProject(JSON.stringify({
    format: "lyricstapper-project",
    version: 1,
    media: { name: "legacy.mp3", duration: 5 },
    captions: [{ id: "legacy-end-only", text: "Needs retiming", start: null, end: 2 }],
  }));

  assert.deepEqual(parsed.captions, [{
    id: "legacy-end-only",
    text: "Needs retiming",
    start: null,
    end: null,
    words: undefined,
  }]);
});

test("opens legacy media-less projects without allowing new invalid saves", () => {
  const parsed = parseProject(JSON.stringify({
    format: "lyricstapper-project",
    version: 1,
    media: { name: "", duration: 0, width: 720, height: 1280 },
    captions: [{ id: "legacy-line", text: "Imported before media", start: 1, end: 2 }],
    captionStyle: DEFAULT_CAPTION_STYLE,
  }));

  assert.equal(parsed.media.name, "");
  assert.equal(parsed.media.duration, 0);
  assert.equal(parsed.captions[0].end, 2);
  assert.throws(
    () => serializeProject(parsed.captions, parsed.captionStyle, parsed.media),
    /media name/i,
  );
});

test("refuses to serialize projects that cannot be opened again", () => {
  assert.throws(
    () => serializeProject(captions, DEFAULT_CAPTION_STYLE, { ...media, name: "" }),
    /media name/i,
  );
  assert.throws(
    () => serializeProject(captions, DEFAULT_CAPTION_STYLE, { ...media, duration: 1 }),
    /exceeds the media duration/i,
  );
  assert.throws(
    () => serializeProject(captions, DEFAULT_CAPTION_STYLE, media, "../private"),
    /directory ID is invalid/i,
  );
});
