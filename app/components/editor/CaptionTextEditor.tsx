import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useState } from "react";
import { TimedLine } from "../../lib/captions";

type CaptionTextEditorProps = {
  line: TimedLine;
  lineNumber: number;
  onSave: (text: string) => void;
};

export function CaptionTextEditor({ line, lineNumber, onSave }: CaptionTextEditorProps) {
  const [draft, setDraft] = useState(line.text);
  const canSave = Boolean(draft.trim()) && draft !== line.text;

  function save() {
    if (canSave) onSave(draft);
  }

  return (
    <section className="caption-text-editor" aria-label={`Edit caption line ${lineNumber}`}>
      <div className="section-copy">
        <strong>Edit selected caption</strong>
        <small>Enter adds a visual line break. Changing the word count redistributes timing.</small>
      </div>
      <div className="caption-text-editor-controls">
        <TextArea
          label={`Caption text for line ${lineNumber}`}
          isLabelHidden
          value={draft}
          rows={3}
          width="100%"
          onChange={setDraft}
        />
        <Button label={`Save caption line ${lineNumber}`} variant="primary" isDisabled={!canSave} onClick={save}>Save text</Button>
      </div>
    </section>
  );
}
