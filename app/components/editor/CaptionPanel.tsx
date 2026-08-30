import { EmptyState } from "@astryxdesign/core/EmptyState";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { useEffect, useRef } from "react";
import { formatClock, isTimedLine, TimedLine } from "../../lib/captions";
import { CaptionTextEditor } from "./CaptionTextEditor";

type CaptionPanelProps = {
  lines: TimedLine[];
  activeIndex: number;
  markingLineIndex: number | null;
  duration: number;
  onSelectLine: (index: number) => void;
  onUpdateText: (index: number, value: string) => void;
  onUpdateEnd: (index: number, value: number | null) => void;
};

export function CaptionPanel({ lines, activeIndex, markingLineIndex, duration, onSelectLine, onUpdateText, onUpdateEnd }: CaptionPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-caption-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!lines.length) {
    return (
      <div className="tool-panel-content empty-tool">
        <EmptyState
          title="No captions yet"
          description="Add lyrics in Source, then prepare them for timing."
          headingLevel={3}
          icon={<span className="empty-note">♪</span>}
        />
      </div>
    );
  }

  const selectedIndex = Math.min(Math.max(activeIndex, 0), lines.length - 1);
  const selectedLine = lines[selectedIndex];

  return (
    <div className="tool-panel-content caption-tool">
      <CaptionTextEditor
        key={`${selectedLine.id}:${selectedLine.text}`}
        line={selectedLine}
        lineNumber={selectedIndex + 1}
        onSave={(text) => onUpdateText(selectedIndex, text)}
      />
      <div className="caption-list-summary">
        <span>{lines.filter(isTimedLine).length} of {lines.length} timed</span>
        <span>{formatClock(duration)}</span>
      </div>
      <div className="caption-line-list" ref={listRef} role="list" aria-label="Caption lines">
        {lines.map((line, index) => {
          const isDone = isTimedLine(line);
          return (
            <div className={`caption-line-row ${index === activeIndex ? "is-active" : ""} ${index === markingLineIndex ? "is-marking" : ""}`} data-caption-index={index} key={line.id} role="listitem">
              <button className="caption-line-select" type="button" onClick={() => onSelectLine(index)}>
                <span className={`line-state ${isDone ? "is-done" : ""}`}>{isDone ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <span className="line-copy">
                  <strong>{line.text}</strong>
                  <small>{line.start === null ? "Not timed" : `Starts ${formatClock(line.start)}`}</small>
                </span>
              </button>
              <NumberInput
                label={`End time for line ${index + 1}`}
                isLabelHidden
                size="sm"
                step={0.01}
                min={line.start === null ? undefined : line.start + 0.05}
                max={duration || undefined}
                value={line.end}
                placeholder="End"
                hasClear
                isDisabled={line.start === null}
                disabledMessage="Set the line start before editing its end time."
                width={96}
                onChange={(value) => onUpdateEnd(index, value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
