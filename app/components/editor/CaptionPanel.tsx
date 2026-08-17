import { EmptyState } from "@astryxdesign/core/EmptyState";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { formatClock, TimedLine } from "../../lib/captions";

type CaptionPanelProps = {
  lines: TimedLine[];
  activeIndex: number;
  duration: number;
  onSelectLine: (index: number) => void;
  onUpdateEnd: (index: number, value: number | null) => void;
};

export function CaptionPanel({ lines, activeIndex, duration, onSelectLine, onUpdateEnd }: CaptionPanelProps) {
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

  return (
    <div className="tool-panel-content caption-tool">
      <div className="caption-list-summary">
        <span>{lines.filter((line) => line.end !== null).length} of {lines.length} timed</span>
        <span>{formatClock(duration)}</span>
      </div>
      <div className="caption-line-list" role="list" aria-label="Caption lines">
        {lines.map((line, index) => {
          const isDone = line.start !== null && line.end !== null;
          return (
            <div className={`caption-line-row ${index === activeIndex ? "is-active" : ""}`} key={line.id} role="listitem">
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
                min={line.start === null ? 0 : line.start + 0.05}
                max={duration || undefined}
                value={line.end}
                placeholder="End"
                hasClear
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
