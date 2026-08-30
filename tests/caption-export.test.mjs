import assert from "node:assert/strict";
import test from "node:test";
import "./typescript-loader.mjs";

const { DEFAULT_CAPTION_STYLE } = await import("../app/lib/captionStyle.ts");
const { boundedCaptionEnd, importCaptionFile, isTimedLine, toAss, toJson, toSrt } = await import("../app/lib/captions.ts");

const completedLine = {
  id: "complete",
  text: "Hello\nworld",
  start: 1.234,
  end: 3.456,
  words: [
    { word: "Hello", start: 1.234, end: 2 },
    { word: "world", start: 2, end: 3.456 },
  ],
};

const incompleteLines = [{
  id: "end-only",
  text: "Missing a start",
  start: null,
  end: 4,
}, {
  id: "start-only",
  text: "Missing an end",
  start: 4,
  end: null,
}, {
  id: "backwards",
  text: "Backwards timing",
  start: 5,
  end: 4,
}];

test("uses one completion rule for status and every text export", () => {
  assert.equal(isTimedLine(completedLine), true);
  assert.equal(isTimedLine(incompleteLines[0]), false);
  assert.equal(isTimedLine(incompleteLines[1]), false);
  assert.equal(isTimedLine(incompleteLines[2]), false);

  const lines = [completedLine, ...incompleteLines];
  const srt = toSrt(lines);
  const json = JSON.parse(toJson(lines, "synthetic.wav", 6));
  const ass = toAss(lines);

  assert.equal((srt.match(/-->/g) ?? []).length, 1);
  assert.equal(json.captions.length, 1);
  assert.equal((ass.match(/^Dialogue:/gm) ?? []).length, 1);
  assert.doesNotMatch(`${srt}\n${ass}`, /Missing a start|Backwards timing/);
});

test("keeps newly marked caption ends inside the media duration", () => {
  assert.equal(boundedCaptionEnd(3, 3, 4), 3.05);
  assert.equal(boundedCaptionEnd(3.98, 4, 4), 4);
  assert.equal(boundedCaptionEnd(3, 8, 4), 4);
  assert.equal(boundedCaptionEnd(4, 4, 4), null);
});

test("exports exact SRT timing and round-trips multiline caption text", () => {
  const srt = toSrt([completedLine]);
  assert.equal(srt, "1\n00:00:01,234 --> 00:00:03,456\nHello\nworld\n");

  const [imported] = importCaptionFile("captions.srt", srt);
  assert.equal(imported.text, "Hello\nworld");
  assert.equal(imported.start, 1.234);
  assert.equal(imported.end, 3.456);
});

test("exports JSON word timing that survives re-import", () => {
  const json = toJson([completedLine], "synthetic.wav", 6);
  const payload = JSON.parse(json);
  assert.deepEqual(payload, {
    version: 1,
    media: "synthetic.wav",
    duration: 6,
    captions: [{
      text: "Hello\nworld",
      start: 1.234,
      end: 3.456,
      words: completedLine.words,
    }],
  });

  const [imported] = importCaptionFile("captions.json", json);
  assert.equal(imported.text, completedLine.text);
  assert.deepEqual(imported.words, completedLine.words);
});

test("keeps JSON exported without loaded media self-consistent", () => {
  const json = toJson([completedLine], "", 0);
  const payload = JSON.parse(json);
  assert.equal(payload.duration, completedLine.end);

  const [imported] = importCaptionFile("captions.json", json);
  assert.equal(imported.start, completedLine.start);
  assert.equal(imported.end, completedLine.end);
});

test("opens caption JSON previously exported without loaded media", () => {
  const [imported] = importCaptionFile("legacy-captions.json", JSON.stringify({
    version: 1,
    media: "",
    duration: 0,
    captions: [{ text: "Old export", start: 1, end: 2 }],
  }));

  assert.equal(imported.text, "Old export");
  assert.equal(imported.start, 1);
  assert.equal(imported.end, 2);
});

test("exports ASS karaoke timing, forced breaks and escaped text", () => {
  const ass = toAss([completedLine], 720, 1280, DEFAULT_CAPTION_STYLE);
  assert.match(ass, /PlayResX: 720/);
  assert.match(ass, /Dialogue: 0,0:00:01\.23,0:00:03\.46/);
  assert.match(ass, /\{\\k77\}Hello\{\\k146\}\\Nworld/);

  const [imported] = importCaptionFile("captions.ass", ass);
  assert.equal(imported.text, "Hello\nworld");
  assert.equal(imported.start, 1.23);
  assert.equal(imported.end, 3.46);

  const escaped = toAss([{
    id: "escaped",
    text: "Sing {now}\\again",
    start: 0,
    end: 1,
  }], 720, 1280, { ...DEFAULT_CAPTION_STYLE, uppercase: true, highlightMode: "wipe" });
  assert.match(escaped, /\{\\kf50\}SING/);
  assert.match(escaped, /\\\{NOW\\\}/);
  assert.match(escaped, /\\\\AGAIN/);
});

test("keeps ASS word rounding within the exported dialogue range", () => {
  const words = Array.from({ length: 20 }, (_, index) => ({
    word: `word${index + 1}`,
    start: index * 0.1551,
    end: (index + 1) * 0.1551,
  }));
  const ass = toAss([{
    id: "rounding",
    text: words.map((word) => word.word).join(" "),
    start: 0,
    end: words.at(-1).end,
    words,
  }]);

  const karaokeDurations = [...ass.matchAll(/\{\\k(\d+)\}/g)].map((match) => Number(match[1]));
  assert.equal(karaokeDurations.reduce((sum, duration) => sum + duration, 0), 310);

  const [imported] = importCaptionFile("captions.ass", ass);
  assert.equal(imported.words.length, words.length);
  assert.ok(imported.words.at(-1).end <= imported.end);
});
