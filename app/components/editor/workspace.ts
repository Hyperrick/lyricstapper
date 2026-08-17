export type WorkspaceTask = "source" | "captions" | "style" | "export";

export const WORKSPACE_TASKS: Array<{ value: WorkspaceTask; label: string }> = [
  { value: "source", label: "Source" },
  { value: "captions", label: "Captions" },
  { value: "style", label: "Style" },
  { value: "export", label: "Export" },
];

export const WORKSPACE_TASK_DETAILS: Record<WorkspaceTask, { eyebrow: string; title: string; description: string }> = {
  source: {
    eyebrow: "01 · SOURCE",
    title: "Media & lyrics",
    description: "Choose a track, paste one lyric per line, then prepare your timing session.",
  },
  captions: {
    eyebrow: "02 · CAPTIONS",
    title: "Caption timing",
    description: "Review every line, jump to its start, and fine-tune its end time.",
  },
  style: {
    eyebrow: "03 · STYLE",
    title: "Caption style",
    description: "Shape the on-video caption treatment while the preview stays visible.",
  },
  export: {
    eyebrow: "04 · EXPORT",
    title: "Save & export",
    description: "Save an editable project or create subtitles, timing data, and captioned video.",
  },
};
