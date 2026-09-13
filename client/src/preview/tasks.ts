const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](?=\s|$)/;

export type TaskToggleChange = { from: number; to: number; insert: string };

// Task checkboxes are matched to source lines purely by their sequential
// order top-to-bottom (index N here = the Nth checkbox marked renders =
// data-task-index="N" in the preview) — no positional/offset tracking
// needed, since both walks visit lines in the same order. Returns a
// single-character change rather than a whole new document string, so
// dispatching it doesn't touch (or scroll-reset) anything else.
export function toggleTaskInSource(
  source: string,
  taskIndex: number,
): TaskToggleChange | null {
  const lines = source.split("\n");
  let seen = 0;
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = TASK_LINE.exec(line);
    if (match) {
      if (seen === taskIndex) {
        const checked = match[2] !== " ";
        const from = offset + match[1].length + 1; // through the "[" inclusive
        return { from, to: from + 1, insert: checked ? " " : "x" };
      }
      seen++;
    }
    offset += line.length + 1; // +1 for the "\n" split() consumed
  }

  return null;
}
