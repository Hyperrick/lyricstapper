import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { ChangeEventHandler, RefObject } from "react";
import { ProjectMedia } from "../../lib/projectFile";

type SourcePanelProps = {
  mediaInputRef: RefObject<HTMLInputElement | null>;
  mediaName: string;
  projectMediaReference: ProjectMedia | null;
  lyricsRows: string[];
  preparedLyrics: string[];
  onChooseMedia: () => void;
  onLoadMedia: ChangeEventHandler<HTMLInputElement>;
  onLyricsChange: (rows: string[]) => void;
  onPrepareLyrics: () => void;
};

export function SourcePanel({
  mediaInputRef,
  mediaName,
  projectMediaReference,
  lyricsRows,
  preparedLyrics,
  onChooseMedia,
  onLoadMedia,
  onLyricsChange,
  onPrepareLyrics,
}: SourcePanelProps) {
  const sourceLines = lyricsRows.map((row) => row.trim()).filter((row) => row && !/^\[.+\]$/.test(row));
  const preparedLineCount = sourceLines.length;
  const isPrepared = sourceLines.length > 0 && sourceLines.length === preparedLyrics.length && sourceLines.every((line, index) => line === preparedLyrics[index]);
  const mediaLabel = projectMediaReference
    ? `Reconnect ${projectMediaReference.name}`
    : mediaName
      ? `Replace ${mediaName}`
      : "Choose audio or video";

  function openMediaPicker() {
    onChooseMedia();
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
          label={isPrepared
            ? `${preparedLineCount} ${preparedLineCount === 1 ? "line" : "lines"} prepared`
            : `Prepare ${preparedLineCount} ${preparedLineCount === 1 ? "line" : "lines"}`}
          variant="primary"
          width="100%"
          isDisabled={!preparedLineCount || isPrepared}
          onClick={onPrepareLyrics}
        />
      </section>

    </div>
  );
}
