import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";

type ExportPanelProps = {
  lineCount: number;
  completedCount: number;
  canExportMp4: boolean;
  renderProgress: number | null;
  onExportAss: () => void;
  onExportSrt: () => void;
  onExportJson: () => void;
  onExportMp4: () => void;
};

export function ExportPanel({
  lineCount,
  completedCount,
  canExportMp4,
  renderProgress,
  onExportAss,
  onExportSrt,
  onExportJson,
  onExportMp4,
}: ExportPanelProps) {
  const hasCaptions = completedCount > 0;
  const allTimed = lineCount > 0 && completedCount === lineCount;
  const renderPercentage = renderProgress === null ? 0 : Math.round(Math.min(1, Math.max(0, renderProgress)) * 100);

  return (
    <div className="tool-panel-content export-tool">
      {!allTimed && (
        <Banner
          status={hasCaptions ? "warning" : "info"}
          title={hasCaptions ? `${lineCount - completedCount} lines still need timing` : "Time at least one line to export captions"}
          description="Finish timing every line for a complete caption export."
        />
      )}

      <section className="tool-section export-section">
        <div className="section-copy">
          <strong>Captions & timing data</strong>
          <small>Choose the format that matches your editing workflow.</small>
        </div>
        <div className="export-options">
          <Button label="Export ASS with karaoke styling" variant="secondary" isDisabled={!hasCaptions} onClick={onExportAss}>ASS <span>Styled karaoke</span></Button>
          <Button label="Export SRT captions" variant="secondary" isDisabled={!hasCaptions} onClick={onExportSrt}>SRT <span>Standard captions</span></Button>
          <Button label="Export JSON word timings" variant="secondary" isDisabled={!hasCaptions} onClick={onExportJson}>JSON <span>Word timings</span></Button>
        </div>
      </section>

      <section className="tool-section export-section">
        <div className="section-copy">
          <strong>Captioned video</strong>
          <small>{canExportMp4 ? "Render an MP4 locally in this browser." : "Choose a video source to enable MP4 export."}</small>
        </div>
        {renderProgress !== null ? (
          <div
            className="render-progress"
            role="progressbar"
            aria-label="Rendering MP4"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={renderPercentage}
          >
            <div className="render-progress-label">
              <strong>Rendering MP4</strong>
              <span>{renderPercentage}%</span>
            </div>
            <div className="render-progress-track" aria-hidden="true">
              <span style={{ width: `${renderPercentage}%` }} />
            </div>
          </div>
        ) : (
          <Button
            label="Export captioned MP4"
            variant="secondary"
            width="100%"
            isDisabled={!canExportMp4 || !hasCaptions}
            onClick={onExportMp4}
          />
        )}
      </section>
    </div>
  );
}
