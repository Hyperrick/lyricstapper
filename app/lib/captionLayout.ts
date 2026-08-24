export type CaptionLayoutWord = {
  index: number;
  width: number;
};

export function wrapCaptionWords(
  words: readonly string[],
  measureText: (text: string) => number,
  maxWidth: number,
  forcedBreaks: ReadonlySet<number>,
): CaptionLayoutWord[][] {
  const spaceWidth = measureText(" ");
  const rows: CaptionLayoutWord[][] = [];
  let row: CaptionLayoutWord[] = [];
  let rowWidth = 0;

  words.forEach((word, index) => {
    const width = measureText(word);
    if (row.length && (forcedBreaks.has(index) || rowWidth + spaceWidth + width > maxWidth)) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push({ index, width });
    rowWidth += (row.length > 1 ? spaceWidth : 0) + width;
  });

  if (row.length) rows.push(row);
  return rows;
}
