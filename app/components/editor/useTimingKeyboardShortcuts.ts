import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { EditorMode, MediaElement } from "./MediaStage";

type TimingKeyboardShortcutOptions = {
  beginHeldLine: () => void;
  endHeldLine: () => void;
  mediaRef: RefObject<MediaElement | null>;
  mode: EditorMode;
  playMedia: (media: MediaElement) => void;
  undoMarker: () => void;
};

const INTERACTIVE_TARGETS = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='menuitem']",
  "[role='radio']",
  "[role='slider']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']",
].join(", ");

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_TARGETS));
}

export function useTimingKeyboardShortcuts({
  beginHeldLine,
  endHeldLine,
  mediaRef,
  mode,
  playMedia,
  undoMarker,
}: TimingKeyboardShortcutOptions): void {
  const isTimingSpaceHeldRef = useRef(false);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;
      if (mode !== "tag") {
        if (event.code === "Space") {
          event.preventDefault();
          if (!event.repeat && mediaRef.current) {
            if (mediaRef.current.paused) playMedia(mediaRef.current);
            else mediaRef.current.pause();
          }
        } else if (["Backspace", "KeyP", "ArrowLeft", "ArrowRight"].includes(event.code)) {
          event.preventDefault();
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) {
          isTimingSpaceHeldRef.current = true;
          beginHeldLine();
        }
      } else if (event.code === "Backspace") {
        event.preventDefault();
        undoMarker();
      } else if (event.code === "KeyP" && mediaRef.current) {
        event.preventDefault();
        if (mediaRef.current.paused) playMedia(mediaRef.current);
        else mediaRef.current.pause();
      } else if ((event.code === "ArrowLeft" || event.code === "ArrowRight") && mediaRef.current) {
        event.preventDefault();
        mediaRef.current.currentTime += event.code === "ArrowLeft" ? -0.5 : 0.5;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (mode !== "tag" || event.code !== "Space" || !isTimingSpaceHeldRef.current) return;
      event.preventDefault();
      isTimingSpaceHeldRef.current = false;
      endHeldLine();
    };
    const handleWindowBlur = () => {
      if (!isTimingSpaceHeldRef.current) return;
      isTimingSpaceHeldRef.current = false;
      endHeldLine();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [beginHeldLine, endHeldLine, mediaRef, mode, playMedia, undoMarker]);
}
