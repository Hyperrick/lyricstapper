import { Tab, TabList } from "@astryxdesign/core/TabList";
import { WorkspaceTask, WORKSPACE_TASKS } from "./workspace";

type WorkspaceTabsProps = {
  activeTask: WorkspaceTask;
  completedCount: number;
  lineCount: number;
  onChange: (task: WorkspaceTask) => void;
  className?: string;
  layout?: "hug" | "fill";
};

export function WorkspaceTabs({ activeTask, completedCount, lineCount, onChange, className, layout = "hug" }: WorkspaceTabsProps) {
  return (
    <TabList
      aria-label="Editor tools"
      className={className}
      layout={layout}
      size="md"
      value={activeTask}
      onChange={(value) => onChange(value as WorkspaceTask)}
    >
      {WORKSPACE_TASKS.map((task) => (
        <Tab
          key={task.value}
          value={task.value}
          label={task.label}
          endContent={task.value === "captions" && lineCount ? <span className="tab-count">{completedCount}/{lineCount}</span> : undefined}
        />
      ))}
    </TabList>
  );
}
