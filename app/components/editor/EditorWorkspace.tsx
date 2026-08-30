import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import type { ChangeEventHandler, ComponentProps, CSSProperties, PointerEventHandler, RefObject } from "react";
import { CaptionStylePanel } from "../CaptionStylePanel";
import { CaptionPanel } from "./CaptionPanel";
import { EditorHeader } from "./EditorHeader";
import { ExportPanel } from "./ExportPanel";
import { MediaStage } from "./MediaStage";
import { ShortcutDialog } from "./ShortcutDialog";
import { SourcePanel } from "./SourcePanel";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { WORKSPACE_TASK_DETAILS } from "./workspace";

type EditorWorkspaceProps = {
  header: ComponentProps<typeof EditorHeader>;
  projectInputRef: RefObject<HTMLInputElement | null>;
  onProjectInputChange: ChangeEventHandler<HTMLInputElement>;
  inspector: {
    isOpen: boolean;
    width: number;
    onClose: () => void;
    onResize: PointerEventHandler<HTMLDivElement>;
  };
  stage: ComponentProps<typeof MediaStage>;
  source: ComponentProps<typeof SourcePanel>;
  captions: ComponentProps<typeof CaptionPanel>;
  style: ComponentProps<typeof CaptionStylePanel>;
  exportPanel: ComponentProps<typeof ExportPanel>;
  shortcutsDialog: ComponentProps<typeof ShortcutDialog>;
  unsavedDialog: ComponentProps<typeof UnsavedChangesDialog>;
};

export function EditorWorkspace({
  header,
  projectInputRef,
  onProjectInputChange,
  inspector,
  stage,
  source,
  captions,
  style,
  exportPanel,
  shortcutsDialog,
  unsavedDialog,
}: EditorWorkspaceProps) {
  const taskDetails = WORKSPACE_TASK_DETAILS[header.activeTask];
  return (
    <AppShell
      className="app-shell"
      contentPadding={0}
      height="fill"
      mobileNav={false}
      variant="section"
      topNav={<EditorHeader {...header} />}
    >
      <input
        className="visually-hidden-input"
        ref={projectInputRef}
        type="file"
        accept=".json,.srt,.ass"
        onChange={onProjectInputChange}
      />
      <section
        className="workspace"
        data-inspector-open={inspector.isOpen}
        style={{ "--inspector-width": `${inspector.width}px` } as CSSProperties}
      >
        <MediaStage {...stage} />
        {inspector.isOpen && (
          <button className="inspector-scrim" type="button" aria-label="Close editor tool" onClick={inspector.onClose} />
        )}
        <aside className="tool-inspector" aria-label={taskDetails.title} aria-hidden={!inspector.isOpen}>
          <div
            className="inspector-resizer"
            onPointerDown={inspector.onResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor tool"
          />
          <header className="inspector-header">
            <div>
              <span className="eyebrow">{taskDetails.eyebrow}</span>
              <h1>{taskDetails.title}</h1>
              <p>{taskDetails.description}</p>
            </div>
            <Button
              label="Close editor tool"
              variant="ghost"
              isIconOnly
              icon={<span aria-hidden="true">×</span>}
              onClick={inspector.onClose}
            />
          </header>
          <div className="inspector-scroll">
            {header.activeTask === "source" && <SourcePanel {...source} />}
            {header.activeTask === "captions" && <CaptionPanel {...captions} />}
            {header.activeTask === "style" && <CaptionStylePanel {...style} />}
            {header.activeTask === "export" && <ExportPanel {...exportPanel} />}
          </div>
        </aside>
      </section>
      <nav className="mobile-taskbar" aria-label="Editor tools">
        <WorkspaceTabs
          activeTask={header.activeTask}
          completedCount={header.completedCount}
          lineCount={header.lineCount}
          onChange={header.onTaskChange}
          layout="fill"
        />
      </nav>
      <ShortcutDialog {...shortcutsDialog} />
      <UnsavedChangesDialog {...unsavedDialog} />
    </AppShell>
  );
}
