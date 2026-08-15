"use client";

import { CSSProperties } from "react";
import { CaptionStyle, colorWithOpacity } from "../lib/captionStyle";
import { TimedLine } from "../lib/captions";

type CaptionPreviewProps = {
  line: TimedLine;
  activeWordIndex: number;
  style: CaptionStyle;
  fontSize: number;
};

export function CaptionPreview({ line, activeWordIndex, style, fontSize }: CaptionPreviewProps) {
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
        const wordStyle: CSSProperties = {
          color: isActive && style.highlightMode === "text" ? style.highlightColor : activeBackground ? style.highlightTextColor : style.textColor,
          background: activeBackground ? style.highlightColor : "transparent",
          opacity: index < activeWordIndex ? style.pastOpacity / 100 : 1,
        };
        return <span key={`${word}-${index}`} className={activeBackground ? "has-highlight" : ""} style={wordStyle}>{word}</span>;
      })}
    </div>
  );
}
