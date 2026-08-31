import type { Command } from "@codemirror/view";

// Matches a list-item line carrying a task marker: leading indent + bullet
// or ordinal, then "[ ]" / "[x]" / "[X]".
const TASK_MARKER = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](?=\s|$)/;

// Toggles the checkbox on the current line(s) in place. Only `changes` are
// dispatched (no explicit `selection`), so CodeMirror maps the existing
// cursor/selection through the edit instead of moving it.
export const toggleTaskLine: Command = (view) => {
  const { state } = view;
  const seenLines = new Set<number>();
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    if (seenLines.has(line.number)) continue;
    seenLines.add(line.number);

    const match = TASK_MARKER.exec(line.text);
    if (!match) continue;

    const checked = match[2] !== " ";
    const from = line.from + match[1].length + 1;
    changes.push({ from, to: from + 1, insert: checked ? " " : "x" });
  }

  if (changes.length === 0) return false;

  view.dispatch({ changes });
  return true;
};
