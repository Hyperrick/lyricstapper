"use client";

import { CSSProperties, useEffect, useState } from "react";
import { CaptionStyle, colorWithOpacity } from "../lib/captionStyle";
import { distributeWords, TimedLine, wordProgress } from "../lib/captions";

type CaptionPreviewProps = {
  line: TimedLine;
  activeWordIndex: number;
  currentTime: number;
  isPlaying: boolean;
  style: CaptionStyle;
  fontSize: number;
};

export function CaptionPreview({ line, activeWordIndex, currentTime, isPlaying, style, fontSize }: CaptionPreviewProps) {
  const [animatedTime, setAnimatedTime] = useState(currentTime);
  const timedWords = distributeWords(line);
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
  const containerStyle = {
    bottom: `${style.bottomPercent}%`,
    color: style.textColor,
    fontFamily: `"${style.fontFamily}", sans-serif`,
    fontSize: `${fontSize}px`,
    fontWeight: style.fontWeight,
    textShadow: style.shadow ? "0 .08em .03em #090a0d, 0 0 .38em #090a0d, 0 0 .7em #090a0d" : "none",
    WebkitTextStroke: style.outline ? ".045em #090a0d" : "0 transparent",
    background: style.captionBackground ? colorWithOpacity(style.backgroundColor, style.backgroundOpacity) : "transparent",
    textTransform: style.uppercase ? "uppercase" : "none",
  } as CSSProperties;

  return (
    <div className="caption-preview" aria-live="polite" style={containerStyle}>
      {line.text.split(/\s+/).map((word, index) => {
        const isActive = index === activeWordIndex;
        const activeBackground = isActive && style.highlightMode === "background";
        const wipeProgress = isActive && style.highlightMode === "wipe" && timedWords[index]
          ? wordProgress(timedWords[index], previewTime) * 100
          : null;
        const wordStyle: CSSProperties = {
          color: isActive && style.highlightMode === "text" ? style.highlightColor : activeBackground ? style.highlightTextColor : style.textColor,
          backgroundColor: activeBackground ? style.highlightColor : "transparent",
          opacity: index < activeWordIndex ? style.pastOpacity / 100 : 1,
          ...(wipeProgress === null ? {} : {
            backgroundImage: `linear-gradient(to right, ${style.highlightColor} 0%, ${style.highlightColor} ${wipeProgress}%, ${style.textColor} ${wipeProgress}%, ${style.textColor} 100%)`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }),
        };
        return <span key={`${word}-${index}`} className={activeBackground ? "has-highlight" : ""} style={wordStyle}>{word}</span>;
      })}
    </div>
  );
}
