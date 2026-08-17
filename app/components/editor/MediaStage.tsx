import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { CSSProperties, ReactNode, RefObject } from "react";
import { CaptionStyle } from "../../lib/captionStyle";
import { formatClock, TimedLine } from "../../lib/captions";
import { CaptionPreview } from "../CaptionPreview";
import { CaptionTimeline } from "../CaptionTimeline";
import { WorkspaceTask } from "./workspace";

export type EditorMode = "tag" | "edit";
export type MediaElement = HTMLVideoElement | HTMLAudioElement;

type MediaStageProps = {
  activeTask: WorkspaceTask;
  playerRef: RefObject<HTMLDivElement | null>;
  mediaUrl: string;
  isVideo: boolean;
  fittedVideoSize: { width: number; height: number } | null;
  currentTime: number;
  duration: number;
  mode: EditorMode;
  isPlaying: boolean;
  lines: TimedLine[];
  activeIndex: number;
  activeLineText: string;
  selectedLineIndex: number | null;
  previewLine: TimedLine | null;
  previewWordIndex: number;
  captionStyle: CaptionStyle;
  previewFontSize: number;
  onMediaElement: (element: MediaElement | null) => void;
  onModeChange: (mode: EditorMode) => void;
  onBeginSession: () => void;
  onBeginHeldLine: () => void;
  onEndHeldLine: () => void;
  onUndoMarker: () => void;
  onTimeChange: (time: number) => void;
  onMetadata: (duration: number, width?: number, height?: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onSelectLine: (index: number) => void;
  onSeek: (time: number) => void;
  onLineChange: (index: number, line: TimedLine) => void;
  onOpenSource: () => void;
};

export function MediaStage(props: MediaStageProps) {
  const {
    activeTask, playerRef, mediaUrl, isVideo, fittedVideoSize, currentTime, duration, mode, isPlaying,
    lines, activeIndex, activeLineText, selectedLineIndex, previewLine, previewWordIndex,
    captionStyle, previewFontSize, onMediaElement, onModeChange, onBeginSession,
    onBeginHeldLine, onEndHeldLine, onUndoMarker, onTimeChange, onMetadata,
    onPlayingChange, onSelectLine, onSeek, onLineChange, onOpenSource,
  } = props;
  const canStart = mode === "tag" && Boolean(mediaUrl) && lines.length > 0;
  const canMark = canStart && activeIndex >= 0 && activeIndex < lines.length;
  const captionPreview: ReactNode = previewLine
    ? <CaptionPreview line={previewLine} activeWordIndex={previewWordIndex} currentTime={currentTime} isPlaying={isPlaying} style={captionStyle} fontSize={previewFontSize} />
    : null;

  return (
    <section className="stage-panel" data-active-task={activeTask}>
      <div className="transport-shell">
        <div className="timecode" aria-label={`${formatClock(currentTime)} of ${formatClock(duration)}`}>
          <span>{formatClock(currentTime)}</span>
          <small>{formatClock(duration)}</small>
        </div>
        <div className="transport-actions">
          <SegmentedControl value={mode} onChange={(value) => onModeChange(value as EditorMode)} label="Timing mode" size="sm" layout="fill">
            <SegmentedControlItem value="tag" label="Time lyrics" />
            <SegmentedControlItem value="edit" label="Fine-tune" />
          </SegmentedControl>
          <Button label={isPlaying ? "Restart timing" : "Start timing"} size="lg" variant="secondary" isDisabled={!canStart} onClick={onBeginSession} />
          <Button
            className="hold-button"
            label="Hold to show the current lyric"
            size="lg"
            variant="primary"
            isDisabled={!canMark}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              onBeginHeldLine();
            }}
            onPointerUp={onEndHeldLine}
            onPointerCancel={onEndHeldLine}
            onLostPointerCapture={onEndHeldLine}
          >
            <span className="hold-button-copy">Show lyric</span>
          </Button>
          <Button
            label="Undo last timing mark"
            size="lg"
            variant="ghost"
            isIconOnly
            icon={(
              <svg className="undo-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 7 5 11l4 4" />
                <path d="M5.5 11H14a5 5 0 0 1 5 5v1" />
              </svg>
            )}
            isDisabled={mode !== "tag"}
            onClick={onUndoMarker}
          />
        </div>
        <div className="now-marking">
          <span>{activeIndex >= lines.length && lines.length ? "COMPLETE" : "NOW MARKING"}</span>
          <strong>{activeLineText}</strong>
        </div>
      </div>

      <div className="player-wrap" ref={playerRef}>
        {mediaUrl ? renderPlayer() : (
          <EmptyState
            title="Start with your media"
            description="Choose an audio or video file, then add the lyrics you want to time."
            headingLevel={2}
            icon={<span className="empty-stage-icon">♪</span>}
            actions={<Button label="Open Source" variant="primary" onClick={onOpenSource} />}
          />
        )}
      </div>

      <CaptionTimeline
        lines={lines}
        duration={duration}
        currentTime={currentTime}
        selectedIndex={selectedLineIndex}
        onSelect={onSelectLine}
        onSeek={onSeek}
        onChange={onLineChange}
        editable={mode === "edit"}
      />
    </section>
  );

  function renderPlayer() {
    if (isVideo) {
      return (
        <div className="video-canvas" style={(fittedVideoSize ?? undefined) as CSSProperties | undefined}>
          {/* Captions are rendered by the custom synchronized overlay. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={onMediaElement} src={mediaUrl} controls playsInline onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime)} onLoadedMetadata={(event) => onMetadata(event.currentTarget.duration, event.currentTarget.videoWidth, event.currentTarget.videoHeight)} onPlay={() => onPlayingChange(true)} onPause={(event) => { onTimeChange(event.currentTarget.currentTime); onPlayingChange(false); }} />
          {captionPreview}
        </div>
      );
    }

    return (
      <div className="audio-player">
        <div className="record-groove" aria-hidden="true"><span>♪</span></div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={onMediaElement} src={mediaUrl} controls onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime)} onLoadedMetadata={(event) => onMetadata(event.currentTarget.duration)} onPlay={() => onPlayingChange(true)} onPause={(event) => { onTimeChange(event.currentTarget.currentTime); onPlayingChange(false); }} />
        {captionPreview}
      </div>
    );
  }
}
