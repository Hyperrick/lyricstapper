import assert from "node:assert/strict";
import test from "node:test";
import "./typescript-loader.mjs";

const { DEFAULT_CAPTION_STYLE, normalizeCaptionStyle, parseCaptionStyle } = await import("../app/lib/captionStyle.ts");
const { importCaptionFile } = await import("../app/lib/captions.ts");
const { IMPORT_LIMITS, assertImportFile, validateCaptionLines } = await import("../app/lib/importValidation.ts");
const { parseProject } = await import("../app/lib/projectFile.ts");

function project(overrides = {}) {
  return JSON.stringify({
    format: "lyricstapper-project",
    version: 1,
    savedAt: "2026-08-30T12:00:00.000Z",
    media: { name: "demo.mp4", duration: 12, width: 720, height: 1280 },
    lyrics: ["A valid lyric"],
    captions: [{ id: "line-1", text: "A valid lyric", start: 0, end: 1 }],
    captionStyle: DEFAULT_CAPTION_STYLE,
    ...overrides,
  });
}

test("rejects import files before reading more than the size limit", () => {
  assert.throws(
    () => assertImportFile({ name: "captions.json", size: 0 }),
    /import file size/i,
  );
  assert.throws(
    () => assertImportFile({ name: "captions.json", size: IMPORT_LIMITS.maxFileBytes + 1 }),
    /import file size/i,
  );
});

test("rejects caption collections and text beyond their limits", () => {
  const tooManyLines = Array.from({ length: IMPORT_LIMITS.maxCaptionLines + 1 }, () => ({ text: "line", start: 0, end: 1 }));
  assert.throws(
    () => validateCaptionLines(tooManyLines, { allowIncomplete: false, idPrefix: "test" }),
    /more than 10000 caption lines/i,
  );
  assert.throws(
    () => validateCaptionLines([{ text: "x".repeat(IMPORT_LIMITS.maxCaptionTextLength + 1), start: 0, end: 1 }], { allowIncomplete: false, idPrefix: "test" }),
    /too long/i,
  );
});

test("rejects malformed line and word timing", () => {
  assert.throws(
    () => validateCaptionLines([{ text: "backwards", start: 2, end: 1 }], { allowIncomplete: false, idPrefix: "test" }),
    /must end after/i,
  );
  assert.throws(
    () => validateCaptionLines([{
      text: "outside",
      start: 1,
      end: 2,
      words: [{ word: "outside", start: 0, end: 1.5 }],
    }], { allowIncomplete: false, idPrefix: "test" }),
    /within its caption line/i,
  );
  assert.throws(
    () => validateCaptionLines([{
      id: "duplicate",
      text: "first",
      start: 0,
      end: 1,
    }, {
      id: "duplicate",
      text: "second",
      start: 1,
      end: 2,
    }], { allowIncomplete: false, idPrefix: "test" }),
    /duplicate ID/i,
  );
  assert.throws(
    () => validateCaptionLines([{
      text: "overlapping words",
      start: 0,
      end: 2,
      words: [
        { word: "overlapping", start: 0, end: 1.2 },
        { word: "words", start: 1, end: 2 },
      ],
    }], { allowIncomplete: false, idPrefix: "test" }),
    /overlaps the preceding word/i,
  );
});

test("validates caption JSON instead of silently dropping malformed entries", () => {
  assert.throws(
    () => importCaptionFile("captions.json", JSON.stringify({ captions: [{ text: "broken", start: "0", end: 1 }] })),
    /finite number/i,
  );
  const imported = importCaptionFile("captions.json", JSON.stringify({
    captions: [{ text: "works", start: 0, end: 1, words: [{ word: "works", start: 0, end: 1 }] }],
  }));
  assert.equal(imported[0]?.text, "works");
  assert.deepEqual(imported[0]?.words, [{ word: "works", start: 0, end: 1 }]);
});

test("rejects invalid subtitle timestamps", () => {
  assert.throws(
    () => importCaptionFile("captions.srt", "This block has no timing row\n"),
    /no timing row/i,
  );
  assert.throws(
    () => importCaptionFile("captions.ass", "[Script Info]\nScriptType: v4.00+\n"),
    /no caption lines/i,
  );
  const excessiveKaraoke = Array.from({ length: IMPORT_LIMITS.maxWordsPerLine + 1 }, () => "{\\k1}x").join("");
  assert.throws(
    () => importCaptionFile("captions.ass", `Dialogue: 0,0:00:00.00,0:00:20.00,Default,,0,0,0,,${excessiveKaraoke}`),
    /too many timed words/i,
  );
  assert.throws(
    () => importCaptionFile("captions.srt", "1\n00:00:03,000 --> 00:00:02,000\nBackwards\n"),
    /must end after/i,
  );
  assert.throws(
    () => importCaptionFile("captions.srt", "1\n00:75:00,000 --> 00:75:01,000\nInvalid\n"),
    /valid timestamp/i,
  );
});

test("rejects unsafe project metadata and caption style fields", () => {
  assert.throws(
    () => parseProject(project({ captionStyle: { ...DEFAULT_CAPTION_STYLE, fontFamily: "Arial\nDialogue:" } })),
    /fontFamily/i,
  );
  assert.throws(
    () => parseProject(project({ media: { name: "demo.mp4", duration: 12, width: 99_999, height: 1280 } })),
    /media width/i,
  );
  assert.throws(
    () => parseProject(project({ captions: [{ id: "line-1", text: "Broken", start: 2, end: 1 }] })),
    /must end after/i,
  );
  assert.throws(
    () => parseProject(project({ media: { name: "../demo.mp4", duration: 12, width: 720, height: 1280 } })),
    /without path separators/i,
  );
  assert.throws(
    () => parseProject(project({ captions: [{ id: "line-1", text: "Too late", start: 11, end: 13 }] })),
    /exceeds the media duration/i,
  );
  assert.throws(
    () => parseProject(project({ captionStyle: null })),
    /must be an object/i,
  );
});

test("keeps missing legacy style fields compatible while sanitizing local preferences", () => {
  const parsed = parseProject(project({ captionStyle: { fontFamily: "Arial" } }));
  assert.deepEqual(parsed.captionStyle, DEFAULT_CAPTION_STYLE);
  assert.deepEqual(
    normalizeCaptionStyle({ fontFamily: "Arial\nDialogue:", fontSizePercent: 99 }),
    DEFAULT_CAPTION_STYLE,
  );
  assert.throws(() => parseCaptionStyle({ fontFamily: "Arial", textColor: "red" }), /textColor/i);
});
