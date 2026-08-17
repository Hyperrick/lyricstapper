"use client";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { useToast } from "@astryxdesign/core/Toast";
import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captionSourceText, distributeWords, downloadText, importCaptionFile, parseLyrics, replaceTimedLineText, TimedLine, toAss, toJson, toSrt } from "../lib/captions";
import { DEFAULT_CAPTION_STYLE, normalizeCaptionStyle, CaptionStyle } from "../lib/captionStyle";
import { parseProject, projectFingerprint, ProjectMedia, serializeProject } from "../lib/projectFile";
import { chooseProjectFile, findProjectMedia, LocalProjectFileHandle, overwriteProjectFile, saveProjectInDirectory } from "../lib/projectDirectory";
import { chooseRememberedMedia, recallMedia, rememberMedia, supportsRememberedMedia } from "../lib/mediaLibrary";
import { downloadBlob, renderCaptionedMp4 } from "../lib/videoExport";
import { CaptionStylePanel } from "./CaptionStylePanel";
import { CaptionPanel } from "./editor/CaptionPanel";
import { EditorHeader } from "./editor/EditorHeader";
import { ExportPanel } from "./editor/ExportPanel";
import { EditorMode, MediaElement, MediaStage } from "./editor/MediaStage";
import { ShortcutDialog } from "./editor/ShortcutDialog";
import { SourcePanel } from "./editor/SourcePanel";
import { UnsavedChangesDialog } from "./editor/UnsavedChangesDialog";
import { WorkspaceTabs } from "./editor/WorkspaceTabs";
import { WorkspaceTask, WORKSPACE_TASK_DETAILS } from "./editor/workspace";

type TimingSnapshot = { lines: TimedLine[]; activeIndex: number; time: number };

export function LyricTimestamper() {
  const mediaRef = useRef<MediaElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const projectFileHandleRef = useRef<LocalProjectFileHandle | null>(null);
  const projectDirectoryIdRef = useRef<string | undefined>(undefined);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<TimingSnapshot[]>([]);
  const holdingLineRef = useRef<number | null>(null);
  const toast = useToast();
  const showNotice = useCallback((message: string) => {
    if (!message) return;
    toast({
      body: message,
      type: /failed|could not|error/i.test(message) ? "error" : "info",
      isAutoHide: true,
      autoHideDuration: 4000,
      uniqueID: "lyricstapper-notice",
    });
  }, [toast]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [projectMediaReference, setProjectMediaReference] = useState<ProjectMedia | null>(null);
  const [isVideo, setIsVideo] = useState(true);
  const [lyricsRows, setLyricsRows] = useState<string[]>([]);
  const [lines, setLines] = useState<TimedLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [markingLineIndex, setMarkingLineIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 720, height: 1280 });
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>("tag");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [activeTask, setActiveTask] = useState<WorkspaceTask>("source");
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false);
  const [savedProjectFingerprint, setSavedProjectFingerprint] = useState("");
  const [inspectorWidth, setInspectorWidth] = useState(380);

  const currentProjectMedia = useMemo<ProjectMedia>(() => ({
    name: mediaName,
    duration,
    width: videoSize.width,
    height: videoSize.height,
    size: mediaFile?.size ?? projectMediaReference?.size,
    lastModified: mediaFile?.lastModified ?? projectMediaReference?.lastModified,
  }), [duration, mediaFile, mediaName, projectMediaReference, videoSize]);
  const currentProjectFingerprint = useMemo(
    () => projectFingerprint(lines, captionStyle, currentProjectMedia),
    [captionStyle, currentProjectMedia, lines],
  );
  const hasUnpreparedLyrics = useMemo(() => {
    const sourceLines = lyricsRows.map((row) => row.trim()).filter((row) => row && !/^\[.+\]$/.test(row));
    return sourceLines.length !== lines.length || sourceLines.some((row, index) => row !== captionSourceText(lines[index]?.text ?? ""));
  }, [lines, lyricsRows]);
  const hasUnsavedChanges = hasUnpreparedLyrics
    || (lines.length > 0 && currentProjectFingerprint !== savedProjectFingerprint);

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
    setLyricsRows(parsed.map((line) => line.text));
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
      showNotice(error instanceof Error ? error.message : "Playback could not be started.");
    });
  }, [showNotice]);

  const beginHeldLine = useCallback(() => {
    const media = mediaRef.current;
    if (!media || holdingLineRef.current !== null || activeIndex < 0 || activeIndex >= lines.length) return;
    const time = Math.max(0, media.currentTime);
    historyRef.current.push({ lines, activeIndex, time });
    holdingLineRef.current = activeIndex;
    setActiveTask("captions");
    setIsInspectorOpen(true);
    setMarkingLineIndex(activeIndex);
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
    setMarkingLineIndex(null);
    setLines((previous) => previous.map((line, index) => index === lineIndex && line.start !== null
      ? { ...line, end: Math.max(time, line.start + 0.05), words: undefined }
      : line));
    setActiveIndex(lineIndex + 1);
  }, []);

  const undoMarker = useCallback(() => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    holdingLineRef.current = null;
    setMarkingLineIndex(null);
    setLines(snapshot.lines);
    setActiveIndex(snapshot.activeIndex);
    if (mediaRef.current) mediaRef.current.currentTime = snapshot.time;
  }, []);

  const switchMode = useCallback((nextMode: EditorMode) => {
    if (nextMode === "edit") {
      if (holdingLineRef.current !== null) endHeldLine();
      mediaRef.current?.pause();
      const firstCompleted = lines.findIndex((line) => line.start !== null && line.end !== null);
      setActiveTask("captions");
      setIsInspectorOpen(true);
      if (firstCompleted !== -1) setActiveIndex(firstCompleted);
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
        mediaRef.current.currentTime += event.code === "ArrowLeft" ? -0.5 : 0.5;
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
    window.addEventListener("blur", endHeldLine);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", endHeldLine);
    };
  }, [beginHeldLine, endHeldLine, mode, playMedia, undoMarker]);

  useEffect(() => () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

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
      showNotice(error instanceof Error ? error.message : "The media file could not be opened.");
    }
  }

  function openMediaPicker() {
    if (supportsRememberedMedia()) void chooseMedia();
    else mediaInputRef.current?.click();
  }

  function connectLoadedMedia(actualDuration: number, width?: number, height?: number) {
    setDuration(actualDuration);
    if (width && height) setVideoSize({ width, height });
    if (!projectMediaReference) return;
    const nameMatches = mediaName === projectMediaReference.name;
    const durationMatches = Math.abs(actualDuration - projectMediaReference.duration) < 0.25;
    showNotice(nameMatches && durationMatches
      ? "Project and media connected."
      : `Media connected, but ${!nameMatches ? "the filename" : "the duration"} differs from the saved project. Check the timing before export.`);
    setProjectMediaReference(null);
  }

  async function applyProject(content: string) {
    const project = parseProject(content);
    projectDirectoryIdRef.current = project.sourceDirectoryId;
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
    setLyricsRows((project.lyrics.length ? project.lyrics : project.captions.map((line) => line.text)).map(captionSourceText));
    setCaptionStyle(project.captionStyle);
    window.localStorage.setItem("lyricstapper-caption-style", JSON.stringify(project.captionStyle));
    setActiveIndex(project.captions.length ? 0 : -1);
    setSelectedLineIndex(null);
    setMode("edit");
    setActiveTask("captions");
    setIsInspectorOpen(true);
    historyRef.current = [];
    setSavedProjectFingerprint(projectFingerprint(project.captions, project.captionStyle, project.media));
    const rememberedMedia = await recallMedia(project.media).catch(() => null);
    if (rememberedMedia) {
      loadMediaFile(rememberedMedia);
      return;
    }
    const directoryMedia = project.sourceDirectoryId
      ? await findProjectMedia(project.sourceDirectoryId, project.media).catch(() => null)
      : null;
    if (directoryMedia && window.confirm(`Found ${project.media.name} in the saved project folder. Connect it now?`)) {
      loadMediaFile(directoryMedia);
      return;
    }
  }

  async function loadCaptionImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    projectFileHandleRef.current = null;
    await importFile(file);
    event.target.value = "";
  }

  async function importFile(file: File): Promise<boolean> {
    try {
      const content = await file.text();
      if (/\.(?:lyricstapper|beatmark)\.json$/i.test(file.name) || /"format"\s*:\s*"(?:lyricstapper|beatmark)-project"/.test(content)) {
        await applyProject(content);
        return true;
      }
      const imported = importCaptionFile(file.name, content);
      if (!imported.length) throw new Error("The file contains no usable captions.");
      setLines(imported);
      setSavedProjectFingerprint("");
      projectDirectoryIdRef.current = undefined;
      setLyricsRows(imported.map((line) => line.text));
      setActiveIndex(0);
      setSelectedLineIndex(null);
      historyRef.current = [];
      setActiveTask("captions");
      setIsInspectorOpen(true);
      showNotice(`${imported.length} lines imported from ${file.name}`);
      return false;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Import failed.");
      return false;
    }
  }

  async function openProjectPicker() {
    try {
      const result = await chooseProjectFile();
      if (result.status === "unsupported") {
        projectInputRef.current?.click();
        return;
      }
      if (result.status !== "selected") return;
      const isProject = await importFile(result.file);
      projectFileHandleRef.current = isProject ? result.handle : null;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "The project could not be opened.");
    }
  }

  function requestOpenProject() {
    if (hasUnsavedChanges) {
      setIsUnsavedDialogOpen(true);
      return;
    }
    void openProjectPicker();
  }

  async function exportMp4() {
    if (!mediaFile || !isVideo) return;
    try {
      showNotice("Rendering MP4…");
      setRenderProgress(0);
      const blob = await renderCaptionedMp4(mediaFile, lines, captionStyle, setRenderProgress);
      downloadBlob(`${baseName}-captioned.mp4`, blob);
      showNotice("MP4 saved.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "MP4 export failed.");
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
    syncTimelineTime(time);
  }

  function syncTimelineTime(time: number) {
    setCurrentTime(time);
    if (mode !== "edit") return;
    const lineIndex = lines.findIndex((line) => line.start !== null && line.end !== null && time >= line.start && time < line.end);
    if (lineIndex === -1) return;
    setActiveIndex(lineIndex);
    setSelectedLineIndex(lineIndex);
  }

  function updateTimelineLine(index: number, updatedLine: TimedLine) {
    setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? updatedLine : line));
  }

  function updateCaptionText(index: number, text: string) {
    const line = lines[index];
    if (!line || !text.trim()) return;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const preservesWordTiming = distributeWords(line).length === wordCount;
    setLines((previous) => previous.map((currentLine, lineIndex) => lineIndex === index ? replaceTimedLineText(currentLine, text) : currentLine));
    setLyricsRows((previous) => previous.map((row, rowIndex) => rowIndex === index ? captionSourceText(text) : row));
    showNotice(preservesWordTiming
      ? "Caption text saved. Word timing was preserved."
      : "Caption text saved. Word timing for this line was redistributed.");
  }

  function updatePreviewCaptionText(lineId: string, text: string) {
    const index = lines.findIndex((line) => line.id === lineId);
    if (index !== -1) updateCaptionText(index, text);
  }

  async function exportProject() {
    const filename = `${baseName}.lyricstapper.json`;
    const media = currentProjectMedia;
    try {
      if (projectFileHandleRef.current) {
        await overwriteProjectFile(projectFileHandleRef.current, serializeProject(lines, captionStyle, media, projectDirectoryIdRef.current));
        setSavedProjectFingerprint(currentProjectFingerprint);
        showNotice("Project saved.");
        return;
      }
      const result = await saveProjectInDirectory(filename, (directoryId) => serializeProject(lines, captionStyle, media, directoryId));
      if (result.status === "saved") {
        projectFileHandleRef.current = result.fileHandle;
        projectDirectoryIdRef.current = result.directoryId;
        setSavedProjectFingerprint(currentProjectFingerprint);
        showNotice("Project saved. Its folder will be checked for the source media when reopened.");
        return;
      }
      if (result.status === "cancelled") return;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "The project folder could not be saved.");
      return;
    }
    downloadText(filename, serializeProject(lines, captionStyle, media), "application/json");
    setSavedProjectFingerprint(currentProjectFingerprint);
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
  return (
    <AppShell
      className="app-shell"
      contentPadding={0}
      height="fill"
      mobileNav={false}
      variant="section"
      topNav={<EditorHeader activeTask={activeTask} completedCount={completedCount} lineCount={lines.length} onTaskChange={openTask} onOpenProject={requestOpenProject} onSaveProject={() => { void exportProject(); }} onShowShortcuts={() => setIsShortcutDialogOpen(true)} />}
    >
      <input className="visually-hidden-input" ref={projectInputRef} type="file" accept=".json,.srt,.ass" onChange={loadCaptionImport} />
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
          onUndoMarker={undoMarker}
          onTimeChange={syncTimelineTime}
          onMetadata={connectLoadedMedia}
          onPlayingChange={setIsPlaying}
          onSelectLine={selectTimelineLine}
          onSeek={seekMedia}
          onLineChange={updateTimelineLine}
          onCaptionTextChange={updatePreviewCaptionText}
          onCaptionStyleChange={updateCaptionStyle}
          sourceActionLabel={projectMediaReference ? `Reconnect ${projectMediaReference.name}` : "Open Source"}
          onOpenSource={projectMediaReference ? openMediaPicker : () => openTask("source")}
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
            {activeTask === "source" && (
              <SourcePanel
                mediaInputRef={mediaInputRef}
                mediaName={mediaName}
                projectMediaReference={projectMediaReference}
                lyricsRows={lyricsRows}
                preparedLyrics={lines.map((line) => captionSourceText(line.text))}
                onChooseMedia={openMediaPicker}
                onLoadMedia={loadMedia}
                onLyricsChange={setLyricsRows}
                onPrepareLyrics={loadLyrics}
              />
            )}
            {activeTask === "captions" && <CaptionPanel lines={lines} activeIndex={activeIndex} markingLineIndex={markingLineIndex} duration={duration} onSelectLine={selectCaptionLine} onUpdateText={updateCaptionText} onUpdateEnd={updateEnd} />}
            {activeTask === "style" && <CaptionStylePanel value={captionStyle} onChange={updateCaptionStyle} />}
            {activeTask === "export" && (
              <ExportPanel
                lineCount={lines.length}
                completedCount={completedCount}
                canExportMp4={Boolean(mediaFile && isVideo)}
                renderProgress={renderProgress}
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
      <UnsavedChangesDialog
        isOpen={isUnsavedDialogOpen}
        onCancel={() => setIsUnsavedDialogOpen(false)}
        onContinue={() => {
          setIsUnsavedDialogOpen(false);
          void openProjectPicker();
        }}
      />
    </AppShell>
  );
}
