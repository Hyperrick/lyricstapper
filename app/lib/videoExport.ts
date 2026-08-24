import { distributeWords, forcedLineBreakWordIndexes, TimedLine, TimedWord, wordProgress } from "./captions";
import { wrapCaptionWords } from "./captionLayout";
import { CaptionStyle, colorWithOpacity } from "./captionStyle";

type RenderWord = TimedWord & { width: number };

function activeCaption(lines: TimedLine[], time: number): TimedLine | undefined {
  return lines.find((line) => line.start !== null && line.end !== null && time >= line.start && time < line.end);
}

function roundedRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCaption(ctx: OffscreenCanvasRenderingContext2D, lines: TimedLine[], time: number, style: CaptionStyle): void {
  const caption = activeCaption(lines, time);
  if (!caption) return;
  const words = distributeWords(caption).map((word) => ({ ...word, word: style.uppercase ? word.word.toUpperCase() : word.word }));
  if (!words.length) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const fontSize = Math.max(18, Math.round(height * style.fontSizePercent / 100));
  const lineHeight = fontSize * 1.12;
  ctx.font = `${style.fontWeight} ${fontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = style.outline ? Math.max(2, height * 0.0045) : 0;
  ctx.strokeStyle = "#090a0d";

  const rows: RenderWord[][] = wrapCaptionWords(
    words.map((word) => word.word),
    (text) => ctx.measureText(text).width,
    width * style.maxWidthPercent / 100,
    forcedLineBreakWordIndexes(caption.text),
  ).map((row) => row.map((layoutWord) => ({ ...words[layoutWord.index], width: layoutWord.width })));
  const spaceWidth = ctx.measureText(" ").width;
  const centerX = width * style.centerXPercent / 100;
  const fontMetrics = ctx.measureText("Mg");
  const ascent = fontMetrics.actualBoundingBoxAscent || fontSize * 0.82;
  const descent = fontMetrics.actualBoundingBoxDescent || fontSize * 0.22;
  const paddingY = style.captionBackground ? fontSize * 0.2 : 0;
  const captionBottom = height * (1 - style.bottomPercent / 100);
  const lastBaseline = captionBottom - descent - paddingY;
  const firstBaseline = lastBaseline - (rows.length - 1) * lineHeight;
  const rowWidths = rows.map((row) => row.reduce((total, word, index) => total + word.width + (index ? spaceWidth : 0), 0));
  if (style.captionBackground) {
    const paddingX = fontSize * 0.32;
    const widestRow = Math.max(...rowWidths);
    const boxY = firstBaseline - ascent - paddingY;
    const boxHeight = captionBottom - boxY;
    ctx.save();
    ctx.fillStyle = colorWithOpacity(style.backgroundColor, style.backgroundOpacity);
    roundedRect(ctx, centerX - widestRow / 2 - paddingX, boxY, widestRow + paddingX * 2, boxHeight, fontSize * 0.18);
    ctx.fill();
    ctx.restore();
  }

  const activeIndex = words.findIndex((item) => time >= item.start && time < item.end);
  let absoluteIndex = 0;
  rows.forEach((row, rowIndex) => {
    const rowWidth = rowWidths[rowIndex];
    let x = centerX - rowWidth / 2;
    const y = firstBaseline + rowIndex * lineHeight;
    row.forEach((word) => {
      const isActive = absoluteIndex === activeIndex;
      if (isActive && style.highlightMode === "background") {
        const padX = fontSize * 0.14;
        ctx.save();
        ctx.fillStyle = style.highlightColor;
        roundedRect(ctx, x - padX, y - fontSize * 0.84, word.width + padX * 2, fontSize * 1.04, fontSize * 0.12);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      if (style.shadow) {
        ctx.shadowColor = "rgba(0,0,0,.9)";
        ctx.shadowBlur = Math.max(5, height * 0.012);
        ctx.shadowOffsetY = Math.max(2, height * 0.003);
      }
      if (style.outline) ctx.strokeText(word.word, x, y);
      ctx.fillStyle = isActive && style.highlightMode === "text"
        ? style.highlightColor
        : isActive && style.highlightMode === "background"
          ? style.highlightTextColor
          : style.highlightMode === "wipe" && absoluteIndex < activeIndex
            ? style.highlightColor
            : absoluteIndex < activeIndex ? colorWithOpacity(style.textColor, style.pastOpacity) : style.textColor;
      ctx.fillText(word.word, x, y);
      ctx.restore();
      if (isActive && style.highlightMode === "wipe") {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y - fontSize, word.width * wordProgress(word, time), lineHeight);
        ctx.clip();
        ctx.fillStyle = style.highlightColor;
        ctx.fillText(word.word, x, y);
        ctx.restore();
      }
      x += word.width + spaceWidth;
      absoluteIndex += 1;
    });
  });
}

export async function renderCaptionedMp4(file: File, lines: TimedLine[], style: CaptionStyle, onProgress: (progress: number) => void): Promise<Blob> {
  await document.fonts.load(`${style.fontWeight} 1em "${style.fontFamily}"`);
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  let context: OffscreenCanvasRenderingContext2D | null = null;

  const conversion = await Conversion.init({
    input,
    output,
    tracks: "primary",
    video: {
      codec: "avc",
      quality: new Quality("high"),
      process: (sample) => {
        if (!context) {
          const canvas = new OffscreenCanvas(sample.displayWidth, sample.displayHeight);
          context = canvas.getContext("2d")!;
        }
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        sample.draw(context, 0, 0);
        drawCaption(context, lines, sample.timestamp, style);
        return context.canvas;
      },
    },
  });
  if (!conversion.isValid) throw new Error(`This video cannot be encoded in this browser: ${conversion.discardedTracks.map((item) => item.reason).join(", ")}`);
  conversion.onProgress = onProgress;
  await conversion.execute();
  if (!target.buffer) throw new Error("The MP4 encoder returned no data.");
  return new Blob([target.buffer], { type: "video/mp4" });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
