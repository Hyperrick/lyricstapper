import { AlertDialog } from "@astryxdesign/core/AlertDialog";

type UnsavedChangesDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onContinue: () => void;
};

export function UnsavedChangesDialog({ isOpen, onCancel, onContinue }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="Open another project?"
      description="Unsaved work in the current project will be lost."
      cancelLabel="Cancel"
      actionLabel="Continue"
      actionVariant="primary"
      onAction={onContinue}
      width={440}
    />
  );
}
