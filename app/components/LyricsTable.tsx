"use client";

import { ClipboardEvent, useEffect, useRef, useState } from "react";

type LyricsTableProps = {
  rows: string[];
  onChange: (rows: string[]) => void;
};

export function LyricsTable({ rows, onChange }: LyricsTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (editingIndex !== null) inputRefs.current[editingIndex]?.focus();
  }, [editingIndex]);

  function updateRow(index: number, text: string) {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? text : row));
  }

  function pasteRows(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes("\n")) return;
    event.preventDefault();
    const incoming = pasted.split(/\r?\n/).map((row) => row.trim()).filter((row) => row && !/^\[.+\]$/.test(row));
    if (!incoming.length) return;
    const next = [...rows];
    next.splice(index, 1, ...incoming);
    onChange(next);
    setEditingIndex(null);
  }

  function addRow() {
    onChange([...rows, ""]);
    setEditingIndex(rows.length);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
    setEditingIndex(null);
  }

  return (
    <section className="lyrics-table" aria-label="Lyrics lines">
      <header><span>#</span><strong>LYRIC LINE</strong><span>LOCK</span></header>
      <div className="lyrics-rows">
        {rows.map((row, index) => {
          const isEditing = editingIndex === index;
          return (
            <div className={`lyrics-row ${isEditing ? "is-editing" : ""}`} key={`lyric-row-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <input
                ref={(element) => { inputRefs.current[index] = element; }}
                value={row}
                readOnly={!isEditing}
                onChange={(event) => updateRow(index, event.target.value)}
                onPaste={(event) => pasteRows(index, event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setEditingIndex(null);
                  if (event.key === "Escape") setEditingIndex(null);
                }}
                aria-label={`Lyric line ${index + 1}`}
              />
              <div>
                <button onClick={() => setEditingIndex(isEditing ? null : index)} aria-label={isEditing ? `Lock line ${index + 1}` : `Edit line ${index + 1}`}>{isEditing ? "✓" : "✎"}</button>
                {isEditing && <button onClick={() => removeRow(index)} aria-label={`Delete line ${index + 1}`}>×</button>}
              </div>
            </div>
          );
        })}
      </div>
      <button className="add-lyric-row" onClick={addRow}>＋ Add lyric line</button>
    </section>
  );
}
