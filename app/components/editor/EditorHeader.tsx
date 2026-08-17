import { Button } from "@astryxdesign/core/Button";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { ThemeMode } from "@astryxdesign/core/theme";
import { useThemeMode } from "../AppThemeProvider";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { WorkspaceTask } from "./workspace";

type EditorHeaderProps = {
  activeTask: WorkspaceTask;
  completedCount: number;
  lineCount: number;
  onTaskChange: (task: WorkspaceTask) => void;
  onShowShortcuts: () => void;
};

export function EditorHeader({ activeTask, completedCount, lineCount, onTaskChange, onShowShortcuts }: EditorHeaderProps) {
  const { mode, setMode } = useThemeMode();

  function cycleTheme() {
    const nextMode: ThemeMode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(nextMode);
  }

  return (
    <Toolbar
      className="topbar"
      label="Lyricstapper workspace"
      size="md"
      startContent={<div className="brand-mark"><span aria-hidden="true">♪</span><strong>lyricstapper</strong></div>}
      centerContent={<WorkspaceTabs activeTask={activeTask} completedCount={completedCount} lineCount={lineCount} onChange={onTaskChange} className="desktop-task-tabs" />}
      endContent={(
        <div className="header-actions">
          <div className="progress-chip"><strong>{completedCount}</strong><span>/ {lineCount} lines</span></div>
          <Button label="Keyboard shortcuts" variant="ghost" onClick={onShowShortcuts}>Shortcuts</Button>
          <Button label={`${mode[0].toUpperCase()}${mode.slice(1)} theme. Change theme.`} variant="ghost" onClick={cycleTheme}>{mode === "system" ? "System" : mode === "light" ? "Light" : "Dark"}</Button>
        </div>
      )}
    />
  );
}
