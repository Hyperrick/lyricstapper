import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { ChangeEventHandler, RefObject, useRef } from "react";
import { supportsRememberedMedia } from "../../lib/mediaLibrary";
import { ProjectMedia } from "../../lib/projectFile";

type SourcePanelProps = {
  mediaInputRef: RefObject<HTMLInputElement | null>;
  mediaName: string;
  projectMediaReference: ProjectMedia | null;
  lyricsRows: string[];
  onChooseMedia: () => void;
  onLoadMedia: ChangeEventHandler<HTMLInputElement>;
  onLyricsChange: (rows: string[]) => void;
  onPrepareLyrics: () => void;
  onLoadProject: ChangeEventHandler<HTMLInputElement>;
  onImportCaptions: ChangeEventHandler<HTMLInputElement>;
};

export function SourcePanel({
  mediaInputRef,
  mediaName,
  projectMediaReference,
  lyricsRows,
  onChooseMedia,
  onLoadMedia,
  onLyricsChange,
  onPrepareLyrics,
  onLoadProject,
  onImportCaptions,
}: SourcePanelProps) {
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const captionInputRef = useRef<HTMLInputElement | null>(null);
  const preparedLineCount = lyricsRows.filter((row) => row.trim() && !/^\[.+\]$/.test(row.trim())).length;
  const mediaLabel = projectMediaReference
    ? `Reconnect ${projectMediaReference.name}`
    : mediaName
      ? `Replace ${mediaName}`
      : "Choose audio or video";

  function openMediaPicker() {
    if (supportsRememberedMedia()) onChooseMedia();
    else mediaInputRef.current?.click();
  }

  return (
    <div className="tool-panel-content source-tool">
      <section className="tool-section">
        <div className="source-summary">
          <span className={`source-status-dot ${mediaName ? "is-ready" : ""}`} aria-hidden="true" />
          <div>
            <strong>{mediaName || "No media selected"}</strong>
            <small>{projectMediaReference ? "This project needs its original media file." : "MP3, WAV, MP4, or MOV stays on this device."}</small>
          </div>
        </div>
        <input className="visually-hidden-input" ref={mediaInputRef} type="file" accept="audio/*,video/*" onChange={onLoadMedia} />
        <Button label={mediaLabel} variant={mediaName ? "secondary" : "primary"} width="100%" onClick={openMediaPicker} />
      </section>

      <section className="tool-section lyrics-source">
        <TextArea
          label="Lyrics"
          description="Paste one lyric line per row. Empty lines and [section labels] are ignored."
          value={lyricsRows.join("\n")}
          rows={12}
          placeholder={"First lyric line\nSecond lyric line\nThird lyric line"}
          hasSpellCheck={false}
          width="100%"
          onChange={(value) => onLyricsChange(value.split(/\r?\n/))}
        />
        <Button
          label={`Prepare ${preparedLineCount} ${preparedLineCount === 1 ? "line" : "lines"}`}
          variant="primary"
          width="100%"
          isDisabled={!preparedLineCount}
          onClick={onPrepareLyrics}
        />
      </section>

      <section className="tool-section import-section">
        <div className="section-copy">
          <strong>Open existing work</strong>
          <small>Resume a Lyricstapper project or import timed captions.</small>
        </div>
        <input className="visually-hidden-input" ref={projectInputRef} type="file" accept=".json" onChange={onLoadProject} />
        <input className="visually-hidden-input" ref={captionInputRef} type="file" accept=".json,.srt,.ass" onChange={onImportCaptions} />
        <div className="button-stack">
          <Button label="Open Lyricstapper project" variant="secondary" width="100%" onClick={() => projectInputRef.current?.click()} />
          <Button label="Import JSON, SRT, or ASS" variant="ghost" width="100%" onClick={() => captionInputRef.current?.click()} />
        </div>
      </section>
    </div>
  );
}
