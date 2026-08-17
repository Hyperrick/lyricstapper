import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";

type ExportPanelProps = {
  lineCount: number;
  completedCount: number;
  canExportMp4: boolean;
  renderProgress: number | null;
  onExportProject: () => void;
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
  onExportProject,
  onExportAss,
  onExportSrt,
  onExportJson,
  onExportMp4,
}: ExportPanelProps) {
  const hasCaptions = completedCount > 0;
  const allTimed = lineCount > 0 && completedCount === lineCount;

  return (
    <div className="tool-panel-content export-tool">
      {!allTimed && (
        <Banner
          status={hasCaptions ? "warning" : "info"}
          title={hasCaptions ? `${lineCount - completedCount} lines still need timing` : "Time at least one line to export captions"}
          description="You can save the editable project at any point."
        />
      )}

      <section className="tool-section export-section">
        <div className="section-copy">
          <strong>Editable project</strong>
          <small>Save lyrics, timings, style, and the media reference for later.</small>
        </div>
        <Button label="Save Lyricstapper project" variant="primary" width="100%" isDisabled={!lineCount} onClick={onExportProject} />
      </section>

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
        {renderProgress !== null && <ProgressBar label="Rendering MP4" value={renderProgress} max={1} hasValueLabel />}
        <Button
          label="Export captioned MP4"
          variant="secondary"
          width="100%"
          isDisabled={!canExportMp4 || !hasCaptions || renderProgress !== null}
          isLoading={renderProgress !== null}
          onClick={onExportMp4}
        />
      </section>
    </div>
  );
}
