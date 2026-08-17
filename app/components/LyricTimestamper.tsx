"use client";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner, BannerStatus } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distributeWords, downloadText, importCaptionFile, parseLyrics, TimedLine, toAss, toJson, toSrt } from "../lib/captions";
import { DEFAULT_CAPTION_STYLE, normalizeCaptionStyle, CaptionStyle } from "../lib/captionStyle";
import { parseProject, ProjectMedia, serializeProject } from "../lib/projectFile";
import { chooseRememberedMedia, recallMedia, rememberMedia } from "../lib/mediaLibrary";
import { downloadBlob, renderCaptionedMp4 } from "../lib/videoExport";
import { CaptionStylePanel } from "./CaptionStylePanel";
import { CaptionPanel } from "./editor/CaptionPanel";
import { EditorHeader } from "./editor/EditorHeader";
import { ExportPanel } from "./editor/ExportPanel";
import { EditorMode, MediaElement, MediaStage } from "./editor/MediaStage";
import { ShortcutDialog } from "./editor/ShortcutDialog";
import { SourcePanel } from "./editor/SourcePanel";
import { WorkspaceTabs } from "./editor/WorkspaceTabs";
import { WorkspaceTask, WORKSPACE_TASK_DETAILS } from "./editor/workspace";

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
  const [mode, setMode] = useState<EditorMode>("tag");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [activeTask, setActiveTask] = useState<WorkspaceTask>("source");
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(380);

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
    if (parsed.length) {
      setActiveTask("captions");
      setIsInspectorOpen(true);
    }
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

  const switchMode = useCallback((nextMode: EditorMode) => {
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
      const savedInspectorWidth = Number(window.localStorage.getItem("lyricstapper-inspector-width") ?? window.localStorage.getItem("lyricstapper-timing-panel-width"));
      if (Number.isFinite(savedInspectorWidth) && savedInspectorWidth >= 320 && savedInspectorWidth <= 460) setInspectorWidth(savedInspectorWidth);
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

  function beginInspectorResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const move = (pointerEvent: PointerEvent) => {
      const width = Math.min(460, Math.max(320, startWidth + startX - pointerEvent.clientX));
      setInspectorWidth(width);
    };
    const end = (pointerEvent: PointerEvent) => {
      const width = Math.min(460, Math.max(320, startWidth + startX - pointerEvent.clientX));
      window.localStorage.setItem("lyricstapper-inspector-width", String(width));
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
    setActiveTask("captions");
    setIsInspectorOpen(true);
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
      setActiveTask("captions");
      setIsInspectorOpen(true);
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
      setNotice("Rendering MP4…");
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

  function updateEnd(index: number, value: number | null) {
    if (value === null) {
      setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? { ...line, end: null, words: undefined } : line));
      return;
    }
    setLines((previous) => previous.map((line, lineIndex) => {
      if (lineIndex === index) return { ...line, end: value };
      return line;
    }));
  }

  const baseName = (mediaName || "captions").replace(/\.[^.]+$/, "");
  const previewFontSize = Math.max(12, ((fittedVideoSize?.height ?? playerSize.height) || 500) * captionStyle.fontSizePercent / 100);
  const activeLineText = activeLine?.text || (lines.length && activeIndex >= lines.length ? "Timing complete" : "Prepare your lyrics");

  function selectTimelineLine(index: number) {
    setSelectedLineIndex(index);
    setActiveIndex(index);
  }

  function selectCaptionLine(index: number) {
    const line = lines[index];
    setActiveIndex(index);
    setSelectedLineIndex(line.end !== null ? index : null);
    if (mediaRef.current && line.start !== null) mediaRef.current.currentTime = line.start;
  }

  function seekMedia(time: number) {
    if (mediaRef.current) mediaRef.current.currentTime = time;
  }

  function updateTimelineLine(index: number, updatedLine: TimedLine) {
    setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? updatedLine : line));
  }

  function exportProject() {
    downloadText(`${baseName}.lyricstapper.json`, serializeProject(lines, captionStyle, {
      name: mediaName,
      duration,
      width: videoSize.width,
      height: videoSize.height,
      size: mediaFile?.size,
      lastModified: mediaFile?.lastModified,
    }), "application/json");
  }

  function exportAss() {
    downloadText(`${baseName}.ass`, toAss(lines, videoSize.width, videoSize.height, captionStyle), "text/plain");
  }

  function exportSrt() {
    downloadText(`${baseName}.srt`, toSrt(lines), "application/x-subrip");
  }

  function exportJson() {
    downloadText(`${baseName}.json`, toJson(lines, mediaName, duration), "application/json");
  }

  function openTask(task: WorkspaceTask) {
    setActiveTask(task);
    setIsInspectorOpen(true);
  }

  const taskDetails = WORKSPACE_TASK_DETAILS[activeTask];
  const noticeStatus: BannerStatus = /failed|could not/i.test(notice)
    ? "error"
    : /differs|check the timing/i.test(notice)
      ? "warning"
      : /saved|connected|imported/i.test(notice)
        ? "success"
        : "info";

  return (
    <AppShell
      className="app-shell"
      contentPadding={0}
      height="fill"
      mobileNav={false}
      variant="section"
      topNav={<EditorHeader activeTask={activeTask} completedCount={completedCount} lineCount={lines.length} onTaskChange={openTask} onShowShortcuts={() => setIsShortcutDialogOpen(true)} />}
    >
      <section className="workspace" data-inspector-open={isInspectorOpen} style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}>
        <MediaStage
          activeTask={activeTask}
          playerRef={playerRef}
          mediaUrl={mediaUrl}
          isVideo={isVideo}
          fittedVideoSize={fittedVideoSize}
          currentTime={currentTime}
          duration={duration}
          mode={mode}
          isPlaying={isPlaying}
          lines={lines}
          activeIndex={activeIndex}
          activeLineText={activeLineText}
          selectedLineIndex={selectedLineIndex}
          previewLine={previewLine}
          previewWordIndex={previewWordIndex}
          captionStyle={captionStyle}
          previewFontSize={previewFontSize}
          onMediaElement={(element) => { mediaRef.current = element; }}
          onModeChange={switchMode}
          onBeginSession={beginSession}
          onBeginHeldLine={beginHeldLine}
          onEndHeldLine={endHeldLine}
          onUndoMarker={undoMarker}
          onTimeChange={setCurrentTime}
          onMetadata={connectLoadedMedia}
          onPlayingChange={setIsPlaying}
          onSelectLine={selectTimelineLine}
          onSeek={seekMedia}
          onLineChange={updateTimelineLine}
          onOpenSource={() => openTask("source")}
        />
        {isInspectorOpen && <button className="inspector-scrim" type="button" aria-label="Close editor tool" onClick={() => setIsInspectorOpen(false)} />}
        <aside className="tool-inspector" aria-label={taskDetails.title} aria-hidden={!isInspectorOpen}>
          <div className="inspector-resizer" onPointerDown={beginInspectorResize} role="separator" aria-orientation="vertical" aria-label="Resize editor tool" />
          <header className="inspector-header">
            <div>
              <span className="eyebrow">{taskDetails.eyebrow}</span>
              <h1>{taskDetails.title}</h1>
              <p>{taskDetails.description}</p>
            </div>
            <Button label="Close editor tool" variant="ghost" isIconOnly icon={<span aria-hidden="true">×</span>} onClick={() => setIsInspectorOpen(false)} />
          </header>
          <div className="inspector-scroll">
            {notice && <div className="editor-notice"><Banner status={noticeStatus} title={notice} isDismissable onDismiss={() => setNotice("")} /></div>}
            {activeTask === "source" && (
              <SourcePanel
                mediaInputRef={mediaInputRef}
                mediaName={mediaName}
                projectMediaReference={projectMediaReference}
                lyricsRows={lyricsRows}
                onChooseMedia={() => { void chooseMedia(); }}
                onLoadMedia={loadMedia}
                onLyricsChange={setLyricsRows}
                onPrepareLyrics={loadLyrics}
                onLoadProject={loadProjectFile}
                onImportCaptions={loadCaptionImport}
              />
            )}
            {activeTask === "captions" && <CaptionPanel lines={lines} activeIndex={activeIndex} duration={duration} onSelectLine={selectCaptionLine} onUpdateEnd={updateEnd} />}
            {activeTask === "style" && <CaptionStylePanel value={captionStyle} onChange={updateCaptionStyle} />}
            {activeTask === "export" && (
              <ExportPanel
                lineCount={lines.length}
                completedCount={completedCount}
                canExportMp4={Boolean(mediaFile && isVideo)}
                renderProgress={renderProgress}
                onExportProject={exportProject}
                onExportAss={exportAss}
                onExportSrt={exportSrt}
                onExportJson={exportJson}
                onExportMp4={() => { void exportMp4(); }}
              />
            )}
          </div>
        </aside>
      </section>
      <nav className="mobile-taskbar" aria-label="Editor tools">
        <WorkspaceTabs activeTask={activeTask} completedCount={completedCount} lineCount={lines.length} onChange={openTask} layout="fill" />
      </nav>
      <ShortcutDialog isOpen={isShortcutDialogOpen} onOpenChange={setIsShortcutDialogOpen} />
    </AppShell>
  );
}
