"use client";

import { CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { distributeWords, formatClock, TimedLine } from "../lib/captions";

type CaptionTimelineProps = {
  lines: TimedLine[];
  duration: number;
  currentTime: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onSeek: (time: number) => void;
  onChange: (index: number, line: TimedLine) => void;
  editable: boolean;
};

type WordSelection = { lineIndex: number; wordIndex: number };

function hasWord(selection: WordSelection[], lineIndex: number, wordIndex: number) {
  return selection.some((item) => item.lineIndex === lineIndex && item.wordIndex === wordIndex);
}

function retimeWords(line: TimedLine, start: number, end: number): TimedLine["words"] {
  if (!line.words?.length || line.start === null || line.end === null || line.end <= line.start) return line.words;
  const oldDuration = line.end - line.start;
  const newDuration = end - start;
  return line.words.map((word) => ({
    ...word,
    start: start + ((word.start - line.start!) / oldDuration) * newDuration,
    end: start + ((word.end - line.start!) / oldDuration) * newDuration,
  }));
}

export function CaptionTimeline({ lines, duration, currentTime, selectedIndex, onSelect, onSeek, onChange, editable }: CaptionTimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draggedRef = useRef(false);
  const [viewMode, setViewMode] = useState<"lines" | "words">("lines");
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [selectedWords, setSelectedWords] = useState<WordSelection[]>([]);
  const [zoom, setZoom] = useState(1);
  const [timelineHeight, setTimelineHeight] = useState(155);
  const timelineDuration = useMemo(() => Math.max(duration, ...lines.map((line) => line.end ?? 0), 1), [duration, lines]);
  const completedLines = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.start !== null && line.end !== null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedZoom = Number(window.localStorage.getItem("lyricstapper-timeline-zoom"));
      const savedHeight = Number(window.localStorage.getItem("lyricstapper-timeline-height"));
      if (Number.isFinite(savedZoom) && savedZoom >= 1 && savedZoom <= 8) setZoom(savedZoom);
      if (Number.isFinite(savedHeight) && savedHeight >= 150 && savedHeight <= 340) setTimelineHeight(savedHeight);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function timeAtPointer(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.min(timelineDuration, Math.max(0, ((clientX - rect.left) / rect.width) * timelineDuration));
  }

  function beginEdgeDrag(index: number, edge: "start" | "end", event: ReactPointerEvent<HTMLElement>) {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const line = lines[index];
    if (line.start === null || line.end === null || !trackRef.current) return;
    onSelect(index);
    const group = selectedLines.includes(index) ? selectedLines : [index];
    if (!selectedLines.includes(index)) setSelectedLines([index]);
    const pointerStart = timeAtPointer(event.clientX);
    draggedRef.current = false;
    const move = (pointerEvent: PointerEvent) => {
      draggedRef.current = true;
      const pointerTime = timeAtPointer(pointerEvent.clientX);
      const requestedDelta = pointerTime - pointerStart;
      const minimumDelta = Math.max(...group.map((lineIndex) => {
        const item = lines[lineIndex];
        return edge === "start" ? -(item.start ?? 0) : (item.start ?? 0) + 0.05 - (item.end ?? 0);
      }));
      const maximumDelta = Math.min(...group.map((lineIndex) => {
        const item = lines[lineIndex];
        return edge === "start" ? (item.end ?? 0) - 0.05 - (item.start ?? 0) : timelineDuration - (item.end ?? 0);
      }));
      const delta = Math.min(maximumDelta, Math.max(minimumDelta, requestedDelta));
      group.forEach((lineIndex) => {
        const item = lines[lineIndex];
        if (item.start === null || item.end === null) return;
        const start = edge === "start" ? item.start + delta : item.start;
        const end = edge === "end" ? item.end + delta : item.end;
        onChange(lineIndex, { ...item, start, end, words: retimeWords(item, start, end) });
      });
    };
    const endDrag = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endDrag);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endDrag, { once: true });
  }

  function beginLineMove(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!editable) return;
    if ((event.target as HTMLElement).closest(".block-edge")) return;
    const line = lines[index];
    if (line.start === null || line.end === null) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(index);
    const additiveSelection = event.shiftKey || event.metaKey || event.ctrlKey;
    if (additiveSelection) {
      setSelectedLines((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
      return;
    }
    const group = selectedLines.includes(index) ? selectedLines : [index];
    if (!selectedLines.includes(index)) setSelectedLines([index]);
    draggedRef.current = false;
    const pointerStart = timeAtPointer(event.clientX);
    const move = (pointerEvent: PointerEvent) => {
      draggedRef.current = true;
      const requestedDelta = timeAtPointer(pointerEvent.clientX) - pointerStart;
      const minimumDelta = Math.max(...group.map((lineIndex) => -(lines[lineIndex].start ?? 0)));
      const maximumDelta = Math.min(...group.map((lineIndex) => timelineDuration - (lines[lineIndex].end ?? timelineDuration)));
      const delta = Math.min(maximumDelta, Math.max(minimumDelta, requestedDelta));
      group.forEach((lineIndex) => {
        const item = lines[lineIndex];
        if (item.start === null || item.end === null) return;
        const start = item.start + delta;
        const end = item.end + delta;
        onChange(lineIndex, { ...item, start, end, words: retimeWords(item, start, end) });
      });
    };
    const endMove = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endMove);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endMove, { once: true });
  }

  function beginWordEdit(lineIndex: number, wordIndex: number, mode: "start" | "move" | "end", event: ReactPointerEvent<HTMLElement>) {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const line = lines[lineIndex];
    if (line.start === null || line.end === null) return;
    const additiveSelection = mode === "move" && (event.shiftKey || event.metaKey || event.ctrlKey);
    if (additiveSelection) {
      setSelectedWords((current) => hasWord(current, lineIndex, wordIndex)
        ? current.filter((item) => item.lineIndex !== lineIndex || item.wordIndex !== wordIndex)
        : [...current, { lineIndex, wordIndex }]);
      return;
    }

    const clickedSelection = { lineIndex, wordIndex };
    const group = hasWord(selectedWords, lineIndex, wordIndex) ? selectedWords : [clickedSelection];
    if (!hasWord(selectedWords, lineIndex, wordIndex)) setSelectedWords(group);
    const snapshots = new Map<number, NonNullable<TimedLine["words"]>>();
    group.forEach((item) => {
      if (!snapshots.has(item.lineIndex)) snapshots.set(item.lineIndex, distributeWords(lines[item.lineIndex]).map((word) => ({ ...word })));
    });
    const word = snapshots.get(lineIndex)?.[wordIndex];
    if (!word || !trackRef.current) return;
    onSelect(lineIndex);
    draggedRef.current = false;
    const pointerStart = timeAtPointer(event.clientX);

    const move = (pointerEvent: PointerEvent) => {
      draggedRef.current = true;
      const requestedDelta = timeAtPointer(pointerEvent.clientX) - pointerStart;
      const selected = new Set(group.map((item) => `${item.lineIndex}:${item.wordIndex}`));
      const minimumDelta = Math.max(...group.map((item) => {
        const itemLine = lines[item.lineIndex];
        const words = snapshots.get(item.lineIndex)!;
        const current = words[item.wordIndex];
        const previous = words[item.wordIndex - 1];
        if (mode === "end") return current.start + 0.03 - current.end;
        if (mode === "move" && previous && selected.has(`${item.lineIndex}:${item.wordIndex - 1}`)) return -Infinity;
        return (previous ? previous.start + 0.03 : itemLine.start!) - current.start;
      }));
      const maximumDelta = Math.min(...group.map((item) => {
        const itemLine = lines[item.lineIndex];
        const words = snapshots.get(item.lineIndex)!;
        const current = words[item.wordIndex];
        const next = words[item.wordIndex + 1];
        if (mode === "start") return current.end - 0.03 - current.start;
        if (mode === "move" && next && selected.has(`${item.lineIndex}:${item.wordIndex + 1}`)) return Infinity;
        return (next ? next.end - 0.03 : itemLine.end!) - current.end;
      }));
      const delta = Math.min(maximumDelta, Math.max(minimumDelta, requestedDelta));

      snapshots.forEach((snapshot, changedLineIndex) => {
        const updatedWords = snapshot.map((item) => ({ ...item }));
        const lineSelection = group.filter((item) => item.lineIndex === changedLineIndex);
        lineSelection.forEach(({ wordIndex: changedWordIndex }) => {
          const current = updatedWords[changedWordIndex];
          if (mode !== "end") current.start += delta;
          if (mode !== "start") current.end += delta;
        });
        lineSelection.forEach(({ wordIndex: changedWordIndex }) => {
          const current = updatedWords[changedWordIndex];
          const previous = updatedWords[changedWordIndex - 1];
          const next = updatedWords[changedWordIndex + 1];
          if (mode === "start" && previous) previous.end = current.start;
          if (mode === "end" && next) next.start = current.end;
          if (mode === "move") {
            if (previous && !selected.has(`${changedLineIndex}:${changedWordIndex - 1}`)) previous.end = current.start;
            if (next && !selected.has(`${changedLineIndex}:${changedWordIndex + 1}`)) next.start = current.end;
          }
        });
        onChange(changedLineIndex, { ...lines[changedLineIndex], words: updatedWords });
      });
    };
    const endEdit = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endEdit);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endEdit, { once: true });
  }

  function beginHeightResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = timelineHeight;
    const move = (pointerEvent: PointerEvent) => setTimelineHeight(Math.min(340, Math.max(150, startHeight + startY - pointerEvent.clientY)));
    const end = (pointerEvent: PointerEvent) => {
      const height = Math.min(340, Math.max(150, startHeight + startY - pointerEvent.clientY));
      window.localStorage.setItem("lyricstapper-timeline-height", String(height));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function changeZoom(nextZoom: number) {
    const clampedZoom = Math.min(8, Math.max(1, nextZoom));
    setZoom(clampedZoom);
    window.localStorage.setItem("lyricstapper-timeline-zoom", String(clampedZoom));
    window.requestAnimationFrame(() => {
      const viewport = scrollRef.current;
      if (!viewport) return;
      const playheadPosition = (currentTime / timelineDuration) * viewport.scrollWidth;
      viewport.scrollLeft = Math.max(0, playheadPosition - viewport.clientWidth / 2);
    });
  }

  return (
    <section className={`caption-timeline ${editable ? "is-editable" : "is-readonly"}`} aria-label="Caption timeline" style={{ "--timeline-height": `${timelineHeight}px` } as CSSProperties}>
      <header>
        <div><span>CAPTION TIMELINE</span><strong>{viewMode === "words" && selectedWords.length > 1 ? `${selectedWords.length} words selected` : selectedLines.length > 1 ? `${selectedLines.length} lines selected` : selectedIndex === null ? "Select a block to fine-tune it" : lines[selectedIndex]?.text}</strong></div>
        <div className="timeline-toggle" aria-label="Timeline detail">
          <button className={viewMode === "lines" ? "is-active" : ""} onClick={() => { setViewMode("lines"); setSelectedWords([]); }}>SHOW LINES</button>
          <button className={viewMode === "words" ? "is-active" : ""} onClick={() => setViewMode("words")}>SHOW WORDS</button>
        </div>
        <div className="timeline-zoom" aria-label="Timeline zoom">
          <button onClick={() => changeZoom(zoom - 0.5)} disabled={zoom <= 1} aria-label="Zoom out">−</button>
          <button className="zoom-value" onClick={() => changeZoom(1)} title="Fit timeline">{Math.round(zoom * 100)}%</button>
          <button onClick={() => changeZoom(zoom + 0.5)} disabled={zoom >= 8} aria-label="Zoom in">＋</button>
        </div>
        <small>{formatClock(currentTime)} / {formatClock(timelineDuration)}</small>
      </header>
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-content" style={{ width: `${zoom * 100}%` }}>
          <div className="timeline-ruler">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <span key={ratio} style={{ left: `${ratio * 100}%` }}>{formatClock(timelineDuration * ratio)}</span>)}
          </div>
          <div
            className="timeline-track"
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Video position"
            aria-valuemin={0}
            aria-valuemax={timelineDuration}
            aria-valuenow={Math.min(currentTime, timelineDuration)}
            style={{ minHeight: `${Math.max(54, completedLines.length * 42)}px` }}
            onClick={(event) => {
              if (!editable) return;
              setSelectedLines([]);
              setSelectedWords([]);
              onSeek(timeAtPointer(event.clientX));
            }}
            onKeyDown={(event) => {
              if (!editable) return;
              if (event.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 0.1));
              if (event.key === "ArrowRight") onSeek(Math.min(timelineDuration, currentTime + 0.1));
              if (event.key === "Home") onSeek(0);
              if (event.key === "End") onSeek(timelineDuration);
            }}
          >
        {completedLines.map(({ line, index }) => {
          const selected = selectedLines.includes(index) || selectedIndex === index;
          return (
            <div className={`timeline-lane ${selected ? "is-selected" : ""}`} key={line.id}>
              <span className="lane-label">L{String(index + 1).padStart(2, "0")}</span>
              {viewMode === "lines" ? (
                <button
                  className={`caption-block ${selected ? "is-selected" : ""}`}
                  style={{ left: `${(line.start! / timelineDuration) * 100}%`, width: `${Math.max(0.3, ((line.end! - line.start!) / timelineDuration) * 100)}%` }}
                  onPointerDown={(event) => beginLineMove(index, event)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!editable) return;
                    if (event.shiftKey || event.metaKey || event.ctrlKey) return;
                    if (draggedRef.current) { draggedRef.current = false; return; }
                    onSelect(index);
                    onSeek(line.start!);
                  }}
                  title={`${line.text} · ${formatClock(line.start)}–${formatClock(line.end)}`}
                >
                  <strong>{line.text}</strong>
                  {editable && selected && <>
                    <i className="block-edge start-edge" onPointerDown={(event) => beginEdgeDrag(index, "start", event)} role="separator" aria-label={`Move start of line ${index + 1}`} />
                    <i className="block-edge end-edge" onPointerDown={(event) => beginEdgeDrag(index, "end", event)} role="separator" aria-label={`Move end of line ${index + 1}`} />
                  </>}
                </button>
              ) : distributeWords(line).map((word, wordIndex) => (
                <button
                  className={`caption-block word-block ${hasWord(selectedWords, index, wordIndex) ? "is-selected-word" : selected ? "is-parent-selected" : ""}`}
                  key={`${line.id}-${wordIndex}`}
                  style={{ left: `${(word.start / timelineDuration) * 100}%`, width: `${Math.max(0.25, ((word.end - word.start) / timelineDuration) * 100)}%` }}
                  onPointerDown={(event) => beginWordEdit(index, wordIndex, "move", event)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!editable) return;
                    if (event.shiftKey || event.metaKey || event.ctrlKey) return;
                    if (draggedRef.current) { draggedRef.current = false; return; }
                    onSelect(index);
                    setSelectedWords([{ lineIndex: index, wordIndex }]);
                    onSeek(word.start);
                  }}
                  title={`${word.word} · ${formatClock(word.start)}–${formatClock(word.end)}`}
                >
                  <strong>{word.word}</strong>
                  {editable && hasWord(selectedWords, index, wordIndex) && <>
                    <i className="block-edge start-edge" onPointerDown={(event) => beginWordEdit(index, wordIndex, "start", event)} role="separator" aria-label={`Move start of ${word.word}`} />
                    <i className="block-edge end-edge" onPointerDown={(event) => beginWordEdit(index, wordIndex, "end", event)} role="separator" aria-label={`Move end of ${word.word}`} />
                  </>}
                </button>
              ))}
            </div>
          );
        })}
            <div className="timeline-playhead" style={{ left: `${(Math.min(currentTime, timelineDuration) / timelineDuration) * 100}%`, height: `${Math.max(54, completedLines.length * 42)}px` }} />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="timeline-height-resizer"
        onPointerDown={beginHeightResize}
        aria-label="Resize caption timeline"
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") setTimelineHeight((height) => Math.min(340, height + 10));
          if (event.key === "ArrowDown") setTimelineHeight((height) => Math.max(150, height - 10));
        }}
      />
    </section>
  );
}
