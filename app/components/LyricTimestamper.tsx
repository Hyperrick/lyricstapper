"use client";

import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distributeWords, downloadText, formatClock, importCaptionFile, parseLyrics, TimedLine, toAss, toJson, toSrt } from "../lib/captions";
import { DEFAULT_CAPTION_STYLE, normalizeCaptionStyle, CaptionStyle } from "../lib/captionStyle";
import { parseProject, ProjectMedia, serializeProject } from "../lib/projectFile";
import { chooseRememberedMedia, recallMedia, rememberMedia, supportsRememberedMedia } from "../lib/mediaLibrary";
import { downloadBlob, renderCaptionedMp4 } from "../lib/videoExport";
import { LyricsTable } from "./LyricsTable";
import { CaptionTimeline } from "./CaptionTimeline";
import { CaptionPreview } from "./CaptionPreview";
import { CaptionStylePanel } from "./CaptionStylePanel";

type MediaElement = HTMLVideoElement | HTMLAudioElement;
type TimingSnapshot = { lines: TimedLine[]; activeIndex: number; time: number };

export function LyricTimestamper() {
  const mediaRef = useRef<MediaElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<TimingSnapshot[]>([]);
  const holdingLineRef = useRef<number | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [projectMediaReference, setProjectMediaReference] = useState<ProjectMedia | null>(null);
  const [isVideo, setIsVideo] = useState(true);
  const [lyricsRows, setLyricsRows] = useState<string[]>([]);
  const [lines, setLines] = useState<TimedLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 720, height: 1280 });
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [mode, setMode] = useState<"tag" | "edit">("tag");
  const [rightPanelMode, setRightPanelMode] = useState<"timing" | "style">("timing");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [timingPanelWidth, setTimingPanelWidth] = useState(440);
  const [setupPanelWidth, setSetupPanelWidth] = useState(390);

  const completedCount = lines.filter((line) => line.end !== null).length;
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;

  const previewLine = useMemo(() => {
    const timed = lines.find((line) => line.start !== null && line.end !== null && currentTime >= line.start && currentTime < line.end);
    const open = lines.find((line) => line.start !== null && line.end === null);
    return timed ?? open ?? null;
  }, [currentTime, lines]);

  const activeWordIndex = useMemo(() => {
    if (previewLine?.start === null || previewLine?.start === undefined || previewLine.end === null) return -1;
    return distributeWords(previewLine).findIndex((word) => currentTime >= word.start && currentTime < word.end);
  }, [currentTime, previewLine]);
  const previewWordIndex = activeWordIndex;

  const fittedVideoSize = useMemo(() => {
    if (!playerSize.width || !playerSize.height || !videoSize.width || !videoSize.height) return null;
    const videoRatio = videoSize.width / videoSize.height;
    const playerRatio = playerSize.width / playerSize.height;
    return playerRatio > videoRatio
      ? { width: playerSize.height * videoRatio, height: playerSize.height }
      : { width: playerSize.width, height: playerSize.width / videoRatio };
  }, [playerSize, videoSize]);

  const loadLyrics = useCallback(() => {
    const parsed = parseLyrics(lyricsRows.join("\n"));
    setLines(parsed);
    setActiveIndex(parsed.length ? 0 : -1);
    setSelectedLineIndex(null);
    historyRef.current = [];
  }, [lyricsRows]);

  const playMedia = useCallback((media: MediaElement) => {
    void media.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "Playback could not be started.");
    });
  }, []);

  const beginHeldLine = useCallback(() => {
    const media = mediaRef.current;
    if (!media || holdingLineRef.current !== null || activeIndex < 0 || activeIndex >= lines.length) return;
    const time = Math.max(0, media.currentTime);
    historyRef.current.push({ lines, activeIndex, time });
    holdingLineRef.current = activeIndex;
    setLines((previous) => previous.map((line, index) => {
      if (index === activeIndex) return { ...line, start: time, end: null, words: undefined };
      return line;
    }));
  }, [activeIndex, lines]);

  const endHeldLine = useCallback(() => {
    const media = mediaRef.current;
    const lineIndex = holdingLineRef.current;
    if (!media || lineIndex === null) return;
    const time = Math.max(0, media.currentTime);
    holdingLineRef.current = null;
    setLines((previous) => previous.map((line, index) => index === lineIndex && line.start !== null
      ? { ...line, end: Math.max(time, line.start + 0.05), words: undefined }
      : line));
    setActiveIndex(lineIndex + 1);
  }, []);

  const undoMarker = useCallback(() => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    holdingLineRef.current = null;
    setLines(snapshot.lines);
    setActiveIndex(snapshot.activeIndex);
    if (mediaRef.current) mediaRef.current.currentTime = snapshot.time;
  }, []);

  const switchMode = useCallback((nextMode: "tag" | "edit") => {
    if (nextMode === "edit") {
      if (holdingLineRef.current !== null) endHeldLine();
      mediaRef.current?.pause();
      const firstCompleted = lines.findIndex((line) => line.start !== null && line.end !== null);
      setSelectedLineIndex(firstCompleted === -1 ? null : firstCompleted);
    } else {
      setSelectedLineIndex(null);
    }
    setMode(nextMode);
  }, [endHeldLine, lines]);

  const beginSession = useCallback(() => {
    const media = mediaRef.current;
    if (!media || !lines.length) return;
    const firstUntimed = lines.findIndex((line) => line.start === null);
    setActiveIndex(firstUntimed === -1 ? 0 : firstUntimed);
    playMedia(media);
  }, [lines, playMedia]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("textarea, input, select")) return;
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
        if (!event.repeat) beginHeldLine();
      } else if (event.code === "Backspace") {
        event.preventDefault();
        undoMarker();
      } else if (event.code === "KeyP" && mediaRef.current) {
        event.preventDefault();
        if (mediaRef.current.paused) playMedia(mediaRef.current);
        else mediaRef.current.pause();
      } else if ((event.code === "ArrowLeft" || event.code === "ArrowRight") && mediaRef.current) {
        event.preventDefault();
        mediaRef.current.currentTime += event.code === "ArrowLeft" ? -0.1 : 0.1;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (mode !== "tag") return;
      if (event.code !== "Space") return;
      event.preventDefault();
      endHeldLine();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [beginHeldLine, endHeldLine, mode, playMedia, undoMarker]);

  useEffect(() => () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const updateSize = () => setPlayerSize({ width: player.clientWidth, height: player.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(player);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedTimingWidth = Number(window.localStorage.getItem("lyricstapper-timing-panel-width"));
      const savedSetupWidth = Number(window.localStorage.getItem("lyricstapper-setup-panel-width"));
      if (Number.isFinite(savedTimingWidth) && savedTimingWidth >= 320 && savedTimingWidth <= 680) setTimingPanelWidth(savedTimingWidth);
      if (Number.isFinite(savedSetupWidth) && savedSetupWidth >= 300 && savedSetupWidth <= 620) setSetupPanelWidth(savedSetupWidth);
      const savedCaptionStyle = window.localStorage.getItem("lyricstapper-caption-style");
      if (savedCaptionStyle) {
        try { setCaptionStyle(normalizeCaptionStyle(JSON.parse(savedCaptionStyle))); } catch { /* Ignore invalid local preferences. */ }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateCaptionStyle = useCallback((nextStyle: CaptionStyle) => {
    setCaptionStyle(nextStyle);
    window.localStorage.setItem("lyricstapper-caption-style", JSON.stringify(nextStyle));
  }, []);

  function beginPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = timingPanelWidth;
    const move = (pointerEvent: PointerEvent) => {
      const width = Math.min(680, Math.max(320, startWidth + startX - pointerEvent.clientX));
      setTimingPanelWidth(width);
    };
    const end = (pointerEvent: PointerEvent) => {
      const width = Math.min(680, Math.max(320, startWidth + startX - pointerEvent.clientX));
      window.localStorage.setItem("lyricstapper-timing-panel-width", String(width));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function beginSetupPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = setupPanelWidth;
    const move = (pointerEvent: PointerEvent) => {
      const width = Math.min(620, Math.max(300, startWidth + pointerEvent.clientX - startX));
      setSetupPanelWidth(width);
    };
    const end = (pointerEvent: PointerEvent) => {
      const width = Math.min(620, Math.max(300, startWidth + pointerEvent.clientX - startX));
      window.localStorage.setItem("lyricstapper-setup-panel-width", String(width));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function loadMediaFile(file: File) {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(URL.createObjectURL(file));
    setMediaFile(file);
    setMediaName(file.name);
    setIsVideo(file.type.startsWith("video/"));
    setCurrentTime(0);
  }

  function loadMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    loadMediaFile(file);
    event.target.value = "";
  }

  async function chooseMedia() {
    try {
      const selected = await chooseRememberedMedia();
      if (!selected) return;
      loadMediaFile(selected.file);
      if (selected.handle) await rememberMedia(selected.file, selected.handle);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The media file could not be opened.");
    }
  }

  function connectLoadedMedia(actualDuration: number, width?: number, height?: number) {
    setDuration(actualDuration);
    if (width && height) setVideoSize({ width, height });
    if (!projectMediaReference) return;
    const nameMatches = mediaName === projectMediaReference.name;
    const durationMatches = Math.abs(actualDuration - projectMediaReference.duration) < 0.25;
    setNotice(nameMatches && durationMatches
      ? "Project and media connected."
      : `Media connected, but ${!nameMatches ? "the filename" : "the duration"} differs from the saved project. Check the timing before export.`);
    setProjectMediaReference(null);
  }

  async function applyProject(content: string) {
    const project = parseProject(content);
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl("");
    setMediaFile(null);
    setMediaName(project.media.name);
    setProjectMediaReference(project.media);
    setIsVideo(true);
    setCurrentTime(0);
    setDuration(project.media.duration);
    setVideoSize({ width: project.media.width, height: project.media.height });
    setLines(project.captions);
    setLyricsRows(project.lyrics.length ? project.lyrics : project.captions.map((line) => line.text));
    setCaptionStyle(project.captionStyle);
    window.localStorage.setItem("lyricstapper-caption-style", JSON.stringify(project.captionStyle));
    setActiveIndex(project.captions.length ? 0 : -1);
    setSelectedLineIndex(null);
    setMode("edit");
    historyRef.current = [];
    const rememberedMedia = await recallMedia(project.media).catch(() => null);
    if (rememberedMedia) {
      loadMediaFile(rememberedMedia);
      setNotice("Project loaded. Reconnecting remembered media…");
    } else {
      setNotice(`Project loaded. Select ${project.media.name} once to remember it for future sessions.`);
    }
  }

  async function loadProjectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await applyProject(await file.text());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Project import failed.");
    } finally {
      event.target.value = "";
    }
  }

  async function loadCaptionImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      if (/\.(?:lyricstapper|beatmark)\.json$/i.test(file.name) || /"format"\s*:\s*"(?:lyricstapper|beatmark)-project"/.test(content)) {
        await applyProject(content);
        return;
      }
      const imported = importCaptionFile(file.name, content);
      if (!imported.length) throw new Error("The file contains no usable captions.");
      setLines(imported);
      setLyricsRows(imported.map((line) => line.text));
      setActiveIndex(0);
      setSelectedLineIndex(null);
      historyRef.current = [];
      setNotice(`${imported.length} lines imported from ${file.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  }

  async function exportMp4() {
    if (!mediaFile || !isVideo) return;
    try {
      setNotice("Rendering MP4 locally…");
      setRenderProgress(0);
      const blob = await renderCaptionedMp4(mediaFile, lines, captionStyle, setRenderProgress);
      downloadBlob(`${baseName}-captioned.mp4`, blob);
      setNotice("MP4 saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MP4 export failed.");
    } finally {
      setRenderProgress(null);
    }
  }

  function updateEnd(index: number, value: string) {
    if (!value.trim()) {
      setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? { ...line, end: null, words: undefined } : line));
      return;
    }
    const end = Number(value);
    if (!Number.isFinite(end)) return;
    setLines((previous) => previous.map((line, lineIndex) => {
      if (lineIndex === index) return { ...line, end };
      return line;
    }));
  }

  const baseName = (mediaName || "captions").replace(/\.[^.]+$/, "");
  const previewFontSize = Math.max(12, ((fittedVideoSize?.height ?? playerSize.height) || 500) * captionStyle.fontSizePercent / 100);
  const captionPreview = previewLine ? <CaptionPreview line={previewLine} activeWordIndex={previewWordIndex} style={captionStyle} fontSize={previewFontSize} /> : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><span />lyricstapper</div>
        <div className="header-copy">
          <p>Manual lyric timing</p>
          <span>Local only · no transcription · no upload</span>
        </div>
        <div className="progress-chip"><strong>{completedCount}</strong><span>/ {lines.length || 0} lines</span></div>
      </header>

      <section className="workspace" style={{ "--setup-panel-width": `${setupPanelWidth}px`, "--timing-panel-width": `${timingPanelWidth}px` } as CSSProperties}>
        <aside className="setup-panel panel">
          <div className="panel-resizer setup-resizer" onPointerDown={beginSetupPanelResize} role="separator" aria-orientation="vertical" aria-label="Resize source panel" />
          <div className="section-heading">
            <span className="eyebrow">01 · SOURCE</span>
            <h1>Load. Play.<br />Mark the beat.</h1>
          </div>

          <input className="media-file-input" ref={mediaInputRef} type="file" accept="audio/*,video/*" onChange={loadMedia} />
          <button type="button" className="file-drop" onClick={() => {
            if (supportsRememberedMedia()) void chooseMedia();
            else mediaInputRef.current?.click();
          }}>
            <span className="file-icon">{projectMediaReference ? "↻" : "↗"}</span>
            <strong>{projectMediaReference ? `Reconnect ${projectMediaReference.name}` : mediaName || "Choose audio or video"}</strong>
            <small>{projectMediaReference ? "Select the original file from your Desktop" : "MP3, WAV, MP4 or MOV"}</small>
          </button>

          <LyricsTable rows={lyricsRows} onChange={setLyricsRows} />
          <button className="secondary-button" onClick={loadLyrics}>Prepare {lyricsRows.filter((row) => row.trim()).length} lines</button>
          <label className="secondary-button import-button">Open lyricstapper project<input type="file" accept=".json" onChange={loadProjectFile} /></label>
          <label className="secondary-button import-button">Import captions JSON, SRT or ASS<input type="file" accept=".json,.srt,.ass" onChange={loadCaptionImport} /></label>
          {notice && <p className="notice" role="status">{renderProgress === null ? notice : `${notice} ${Math.round(renderProgress * 100)}%`}</p>}

          <div className="shortcut-grid">
            <div><kbd>HOLD SPACE</kbd><span>show lyric</span></div>
            <div><kbd>⌫</kbd><span>undo marker</span></div>
            <div><kbd>P</kbd><span>play / pause</span></div>
            <div><kbd>← →</kbd><span>nudge 0.1 sec</span></div>
          </div>
        </aside>

        <section className="stage-panel panel">
          <div className="transport">
            <div className="timecode"><span>{formatClock(currentTime)}</span><small>{formatClock(duration)}</small></div>
            <div className="transport-actions">
              <div className="mode-toggle" aria-label="Editor mode">
                <button className={mode === "tag" ? "is-active" : ""} onClick={() => switchMode("tag")}>TAG</button>
                <button className={mode === "edit" ? "is-active" : ""} onClick={() => switchMode("edit")}>EDIT</button>
              </div>
              <button className="secondary-button compact" onClick={beginSession} disabled={mode !== "tag" || !mediaUrl || !lines.length}>{isPlaying ? "Restart timing" : "Start timing"}</button>
              <button className="mark-button" onPointerDown={(event) => { event.preventDefault(); beginHeldLine(); }} onPointerUp={endHeldLine} onPointerCancel={endHeldLine} disabled={mode !== "tag" || !mediaUrl || activeIndex < 0 || activeIndex >= lines.length}><span>HOLD SPACE</span> Hold for lyric</button>
              <button className="icon-button" onClick={undoMarker} disabled={mode !== "tag"} aria-label="Undo last marker">↶</button>
            </div>
            <div className="now-marking">
              <span>NOW MARKING</span>
              <strong>{activeLine?.text || (lines.length && activeIndex >= lines.length ? "Timing complete" : "Prepare your lyrics")}</strong>
            </div>
          </div>

          <div className="player-wrap" ref={playerRef}>
            {mediaUrl ? (
              isVideo ? (
                <div className="video-canvas" style={fittedVideoSize ?? undefined}>
                  {/* Captions are rendered by the custom synchronized overlay. */}
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video ref={(node) => { mediaRef.current = node; }} src={mediaUrl} controls playsInline onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => {
                    connectLoadedMedia(event.currentTarget.duration, event.currentTarget.videoWidth, event.currentTarget.videoHeight);
                  }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
                  {captionPreview}
                </div>
              ) : (
                <div className="audio-player">
                  <div className="record-groove"><span /></div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio ref={(node) => { mediaRef.current = node; }} src={mediaUrl} controls onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => connectLoadedMedia(event.currentTarget.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
                  {captionPreview}
                </div>
              )
            ) : (
              <div className="empty-stage"><div className="empty-orbit" /><p>Your media stays on this device.</p></div>
            )}

          </div>

          <CaptionTimeline
            lines={lines}
            duration={duration}
            currentTime={currentTime}
            selectedIndex={selectedLineIndex}
            onSelect={(index) => { setSelectedLineIndex(index); setActiveIndex(index); }}
            onSeek={(time) => { if (mediaRef.current) mediaRef.current.currentTime = time; }}
            onChange={(index, updatedLine) => setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? updatedLine : line))}
            editable={mode === "edit"}
          />

        </section>

        <aside className="timing-panel panel">
          <div className="panel-resizer timing-resizer" onPointerDown={beginPanelResize} role="separator" aria-orientation="vertical" aria-label="Resize timing panel" />
          <div className="timing-header">
            <div><span className="eyebrow">02 · CAPTIONS</span><h2>{rightPanelMode === "timing" ? "Caption map" : "Caption style"}</h2></div>
            <span className="duration-pill">{formatClock(duration)}</span>
          </div>

          <div className="panel-mode-toggle" aria-label="Caption panel">
            <button className={rightPanelMode === "timing" ? "is-active" : ""} onClick={() => setRightPanelMode("timing")}>TIMING</button>
            <button className={rightPanelMode === "style" ? "is-active" : ""} onClick={() => setRightPanelMode("style")}>STYLE</button>
          </div>

          {rightPanelMode === "timing" ? <div className="line-list">
            {lines.length ? lines.map((line, index) => (
              <div className={`line-row ${index === activeIndex ? "is-active" : ""} ${line.end !== null ? "is-done" : ""}`} key={line.id} role="button" tabIndex={0} onClick={() => {
                setActiveIndex(index);
                setSelectedLineIndex(line.end !== null ? index : null);
                if (mediaRef.current && line.start !== null) mediaRef.current.currentTime = line.start;
              }} onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.stopPropagation();
                setActiveIndex(index);
                setSelectedLineIndex(line.end !== null ? index : null);
                if (mediaRef.current && line.start !== null) mediaRef.current.currentTime = line.start;
              }}>
                <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="line-content"><strong>{line.text}</strong><small>{formatClock(line.start)} →</small></span>
                <input aria-label={`End time for line ${index + 1}`} value={line.end === null ? "" : line.end.toFixed(3)} placeholder="end" onClick={(event) => event.stopPropagation()} onChange={(event) => updateEnd(index, event.target.value)} />
              </div>
            )) : <div className="empty-list"><span>♪</span><p>Your timed lines will appear here.</p></div>}
          </div> : <CaptionStylePanel value={captionStyle} onChange={updateCaptionStyle} />}

          <div className="export-block">
            <div className="export-label"><span className="eyebrow">03 · EXPORT</span><small>{completedCount === lines.length && lines.length ? "Ready" : `${lines.length - completedCount} left`}</small></div>
            <div className="export-grid">
              <button className="project-export" disabled={!lines.length} onClick={() => downloadText(`${baseName}.lyricstapper.json`, serializeProject(lines, captionStyle, { name: mediaName, duration, width: videoSize.width, height: videoSize.height, size: mediaFile?.size, lastModified: mediaFile?.lastModified }), "application/json")}>PROJECT <span>Save editing</span></button>
              <button onClick={() => downloadText(`${baseName}.ass`, toAss(lines, videoSize.width, videoSize.height, captionStyle), "text/plain")}>ASS <span>Styled karaoke</span></button>
              <button onClick={() => downloadText(`${baseName}.srt`, toSrt(lines), "application/x-subrip")}>SRT <span>Captions</span></button>
              <button onClick={() => downloadText(`${baseName}.json`, toJson(lines, mediaName, duration), "application/json")}>JSON <span>Word times</span></button>
              <button className="mp4-export" onClick={exportMp4} disabled={!mediaFile || !isVideo || renderProgress !== null}>MP4 <span>{renderProgress === null ? "Burned captions" : `${Math.round(renderProgress * 100)}%`}</span></button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
