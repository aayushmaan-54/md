const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](?=\s|$)/;

// Task checkboxes are matched to source lines purely by their sequential
// order top-to-bottom (index N here = the Nth checkbox marked renders =
// data-task-index="N" in the preview) — no positional/offset tracking
// needed, since both walks visit lines in the same order.
export function toggleTaskInSource(
  source: string,
  taskIndex: number,
): string | null {
  const lines = source.split("\n");
  let seen = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = TASK_LINE.exec(lines[i]);
    if (!match) continue;

    if (seen === taskIndex) {
      const checked = match[2] !== " ";
      const prefixLength = match[1].length + 1; // through the "[" inclusive
      lines[i] =
        lines[i].slice(0, prefixLength) +
        (checked ? " " : "x") +
        lines[i].slice(prefixLength + 1);
      return lines.join("\n");
    }

    seen++;
  }

  return null;
}
