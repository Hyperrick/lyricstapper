import assert from "node:assert/strict";
import test from "node:test";
import { wrapCaptionWords } from "../app/lib/captionLayout.ts";

const words = ["We", "hit", "every", "porch", "on", "Maple", "Street"];
const widths = new Map([
  [" ", 4],
  ["We", 12],
  ["hit", 10],
  ["every", 24],
  ["porch", 25],
  ["on", 11],
  ["Maple", 27],
  ["Street", 25],
]);
const measureText = (text) => widths.get(text) ?? 0;

test("wraps preview and export words at the same measured boundary", () => {
  const rows = wrapCaptionWords(words, measureText, 105, new Set());

  assert.deepEqual(rows.map((row) => row.map((word) => word.index)), [
    [0, 1, 2, 3, 4],
    [5, 6],
  ]);
});

test("keeps explicit caption line breaks authoritative", () => {
  const rows = wrapCaptionWords(words, measureText, 200, new Set([4]));

  assert.deepEqual(rows.map((row) => row.map((word) => word.index)), [
    [0, 1, 2, 3],
    [4, 5, 6],
  ]);
});
