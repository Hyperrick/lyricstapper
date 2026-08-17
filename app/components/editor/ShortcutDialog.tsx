import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Kbd } from "@astryxdesign/core/Kbd";

type ShortcutDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const shortcuts = [
  { keys: "space", label: "Hold while the current lyric should be visible" },
  { keys: "backspace", label: "Undo the last timing mark" },
  { keys: "p", label: "Play or pause media while timing" },
  { keys: "left", label: "Nudge playback back by 0.1 seconds" },
  { keys: "right", label: "Nudge playback forward by 0.1 seconds" },
];

export function ShortcutDialog({ isOpen, onOpenChange }: ShortcutDialogProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={480} maxHeight="min(620px, 85dvh)" purpose="info" padding={0}>
      <div className="shortcut-dialog">
        <DialogHeader title="Keyboard shortcuts" subtitle="Speed up lyric timing without leaving the media preview." onOpenChange={onOpenChange} hasDivider />
        <div className="shortcut-list">
          {shortcuts.map((shortcut) => (
            <div className="shortcut-row" key={shortcut.keys}>
              <Kbd keys={shortcut.keys} />
              <span>{shortcut.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
