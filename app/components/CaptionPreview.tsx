"use client";

import { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { CaptionStyle, colorWithOpacity } from "../lib/captionStyle";
import { distributeWords, replaceTimedLineText, TimedLine, wordProgress } from "../lib/captions";

type CaptionPreviewProps = {
  line: TimedLine;
  activeWordIndex: number;
  currentTime: number;
  isPlaying: boolean;
  style: CaptionStyle;
  fontSize: number;
  isEditable?: boolean;
  onTextChange?: (text: string) => void;
  onStyleChange?: (style: CaptionStyle) => void;
  onGuidesChange?: (guides: CaptionGuideState) => void;
};

export type CaptionGuideState = { vertical: boolean; horizontal: boolean };

type TransformSession = {
  kind: "move" | "scale" | "width";
  side?: "left" | "right";
  pointerId: number;
  startX: number;
  startY: number;
  playerWidth: number;
  playerHeight: number;
  captionWidth: number;
  captionHeight: number;
  startCenterX: number;
  startCenterY: number;
  style: CaptionStyle;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function previewTextShadow(style: CaptionStyle): string {
  const shadows: string[] = [];
  if (style.outline) {
    shadows.push(
      "-.045em -.045em 0 #090a0d",
      "0 -.045em 0 #090a0d",
      ".045em -.045em 0 #090a0d",
      "-.045em 0 0 #090a0d",
      ".045em 0 0 #090a0d",
      "-.045em .045em 0 #090a0d",
      "0 .045em 0 #090a0d",
      ".045em .045em 0 #090a0d",
    );
  }
  if (style.shadow) shadows.push("0 .08em .03em #090a0d", "0 0 .38em #090a0d", "0 0 .7em #090a0d");
  return shadows.length ? shadows.join(", ") : "none";
}

export function CaptionPreview({ line, activeWordIndex, currentTime, isPlaying, style, fontSize, isEditable = false, onTextChange, onStyleChange, onGuidesChange }: CaptionPreviewProps) {
  const [animatedTime, setAnimatedTime] = useState(currentTime);
  const [draftState, setDraftState] = useState({ baseText: line.text, text: line.text });
  const transformSessionRef = useRef<TransformSession | null>(null);
  const hasLocalDraft = draftState.text !== draftState.baseText;
  const draft = !hasLocalDraft && draftState.baseText !== line.text ? line.text : draftState.text;
  const renderedLine = isEditable && draft !== line.text ? replaceTimedLineText(line, draft) : line;
  const timedWords = distributeWords(renderedLine);
  const textRows = renderedLine.text.split(/\r?\n/).map((row) => row.split(/\s+/).filter(Boolean));
  let absoluteWordIndex = 0;
  const previewTime = isPlaying && style.highlightMode === "wipe" ? animatedTime : currentTime;

  useEffect(() => {
    if (!isPlaying || style.highlightMode !== "wipe") return;
    const startedAt = performance.now();
    let frame = 0;
    const update = (now: number) => {
      setAnimatedTime(currentTime + (now - startedAt) / 1000);
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [currentTime, isPlaying, style.highlightMode]);

  function saveInlineEdit() {
    const text = draft.replace(/\r\n/g, "\n").trim();
    if (!text) {
      setDraftState({ baseText: line.text, text: line.text });
      return;
    }
    if (text !== line.text) {
      setDraftState({ baseText: text, text });
      onTextChange?.(text);
    }
  }

  function handleInlineKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setDraftState({ baseText: line.text, text: line.text });
    event.currentTarget.blur();
  }

  function beginTransform(event: ReactPointerEvent<HTMLButtonElement>, kind: TransformSession["kind"], side?: TransformSession["side"]) {
    const player = event.currentTarget.closest<HTMLElement>(".video-canvas, .audio-player");
    if (!player || !onStyleChange) return;
    event.preventDefault();
    event.stopPropagation();
    const playerBounds = player.getBoundingClientRect();
    const captionBounds = event.currentTarget.closest<HTMLElement>(".caption-preview")?.getBoundingClientRect();
    if (!captionBounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onGuidesChange?.({ vertical: false, horizontal: false });
    transformSessionRef.current = {
      kind,
      side,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      playerWidth: playerBounds.width,
      playerHeight: playerBounds.height,
      captionWidth: captionBounds.width,
      captionHeight: captionBounds.height,
      startCenterX: captionBounds.left - playerBounds.left + captionBounds.width / 2,
      startCenterY: captionBounds.top - playerBounds.top + captionBounds.height / 2,
      style,
    };
  }

  function continueTransform(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = transformSessionRef.current;
    if (!session || session.pointerId !== event.pointerId || !onStyleChange) return;
    event.preventDefault();
    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    if (session.kind === "move") {
      const snapDistance = 10;
      const horizontalCenter = session.playerWidth / 2;
      const verticalCenter = session.playerHeight / 2;
      const rawCenterX = session.startCenterX + deltaX;
      const rawCenterY = session.startCenterY + deltaY;
      const snapsVertically = Math.abs(rawCenterX - horizontalCenter) <= snapDistance;
      const snapsHorizontally = Math.abs(rawCenterY - verticalCenter) <= snapDistance;
      const centerX = clamp(
        snapsVertically ? horizontalCenter : rawCenterX,
        session.captionWidth / 2,
        session.playerWidth - session.captionWidth / 2,
      );
      const centerY = clamp(
        snapsHorizontally ? verticalCenter : rawCenterY,
        session.captionHeight / 2,
        session.playerHeight - session.captionHeight / 2,
      );
      onGuidesChange?.({ vertical: snapsVertically, horizontal: snapsHorizontally });
      onStyleChange({
        ...session.style,
        centerXPercent: centerX / session.playerWidth * 100,
        bottomPercent: (session.playerHeight - centerY - session.captionHeight / 2) / session.playerHeight * 100,
      });
      return;
    }
    if (session.kind === "width") {
      const widthDelta = (session.side === "right" ? deltaX : -deltaX) / session.playerWidth * 200;
      onStyleChange({
        ...session.style,
        maxWidthPercent: clamp(session.style.maxWidthPercent + widthDelta, 20, 96),
      });
      return;
    }
    const scaleDelta = (deltaX + deltaY) / 2 / session.playerHeight * 100;
    onStyleChange({
      ...session.style,
      fontSizePercent: clamp(session.style.fontSizePercent + scaleDelta, 2.5, 12),
    });
  }

  function endTransform(event: ReactPointerEvent<HTMLButtonElement>) {
    if (transformSessionRef.current?.pointerId !== event.pointerId) return;
    transformSessionRef.current = null;
    onGuidesChange?.({ vertical: false, horizontal: false });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const containerStyle = {
    bottom: `${style.bottomPercent}%`,
    left: `${style.centerXPercent}%`,
    right: "auto",
    width: `${style.maxWidthPercent}%`,
    maxWidth: `${style.maxWidthPercent}%`,
    margin: 0,
    transform: "translateX(-50%)",
    transformOrigin: "center bottom",
    color: style.textColor,
    fontFamily: `"${style.fontFamily}", sans-serif`,
    fontSize: `${fontSize}px`,
    fontWeight: style.fontWeight,
    textShadow: previewTextShadow(style),
    background: "transparent",
    textTransform: style.uppercase ? "uppercase" : "none",
  } as CSSProperties;
  const contentStyle = {
    background: style.captionBackground ? colorWithOpacity(style.backgroundColor, style.backgroundOpacity) : "transparent",
  } as CSSProperties;

  return (
    <div className={`caption-preview ${isEditable ? "is-editable" : ""}`} aria-live="polite" style={containerStyle}>
      <span className="caption-preview-content" style={contentStyle}>
        <span className="caption-preview-render" aria-hidden={isEditable || undefined}>
          {textRows.map((wordsInRow, rowIndex) => (
            <span className="caption-preview-line" key={`row-${rowIndex}`}>
            {wordsInRow.map((word, wordIndex) => {
              const index = absoluteWordIndex++;
              const isActive = index === activeWordIndex;
              const isPast = index < activeWordIndex;
              const activeBackground = isActive && style.highlightMode === "background";
              const wipeProgress = isActive && style.highlightMode === "wipe" && timedWords[index]
                ? wordProgress(timedWords[index], previewTime) * 100
                : null;
              const wordStyle: CSSProperties = {
                color: style.highlightMode === "wipe" && isPast
                  ? style.highlightColor
                  : isActive && style.highlightMode === "text"
                    ? style.highlightColor
                    : activeBackground ? style.highlightTextColor : style.textColor,
                backgroundColor: activeBackground ? style.highlightColor : "transparent",
                opacity: isPast && style.highlightMode !== "wipe" ? style.pastOpacity / 100 : 1,
              };
              return (
                <span key={`${word}-${index}`}>
                  {wordIndex > 0 && " "}
                  <span className={`caption-word ${activeBackground ? "has-highlight" : ""}`} style={wordStyle}>
                    {word}
                  {wipeProgress !== null && (
                    <span
                      className="caption-word-wipe"
                      aria-hidden="true"
                      style={{
                        color: style.highlightColor,
                        clipPath: `inset(0 ${100 - wipeProgress}% 0 0)`,
                        WebkitClipPath: `inset(0 ${100 - wipeProgress}% 0 0)`,
                      }}
                    >
                      {word}
                    </span>
                  )}
                  </span>
                </span>
              );
            })}
            </span>
          ))}
        </span>
      </span>
      {isEditable && (
        <>
          <textarea
            className="caption-preview-editor"
            aria-label="Edit caption on video"
            value={draft}
            rows={Math.max(1, draft.split(/\r?\n/).length)}
            onChange={(event) => setDraftState({ baseText: line.text, text: event.target.value })}
            onBlur={saveInlineEdit}
            onKeyDown={handleInlineKeyDown}
            spellCheck={false}
          />
          <button
            className="caption-transform-control caption-move-handle"
            type="button"
            aria-label="Move caption"
            onPointerDown={(event) => beginTransform(event, "move")}
            onPointerMove={continueTransform}
            onPointerUp={endTransform}
            onPointerCancel={endTransform}
          ><span aria-hidden="true">⠿</span></button>
          <button
            className="caption-transform-control caption-width-handle is-left"
            type="button"
            aria-label="Adjust caption line width from left"
            onPointerDown={(event) => beginTransform(event, "width", "left")}
            onPointerMove={continueTransform}
            onPointerUp={endTransform}
            onPointerCancel={endTransform}
          />
          <button
            className="caption-transform-control caption-width-handle is-right"
            type="button"
            aria-label="Adjust caption line width from right"
            onPointerDown={(event) => beginTransform(event, "width", "right")}
            onPointerMove={continueTransform}
            onPointerUp={endTransform}
            onPointerCancel={endTransform}
          />
          <button
            className="caption-transform-control caption-scale-handle"
            type="button"
            aria-label="Scale caption"
            onPointerDown={(event) => beginTransform(event, "scale")}
            onPointerMove={continueTransform}
            onPointerUp={endTransform}
            onPointerCancel={endTransform}
          />
        </>
      )}
    </div>
  );
}
