export type Note = {
  id: string;
  title: string;
  // Once true, title derivation from the first heading stops overriding
  // it — set by an explicit rename (README: "manual rename overrides the
  // derived title permanently").
  titleIsManual: boolean;
  content: string;
  createdAt: number;
  updatedAt: number;
  // Server-assigned sync version. 0 means "never successfully pushed".
  version: number;
};

const TITLE_FROM_HEADING = /^#\s+(.+?)\s*$/m;

// A note's title is derived from its first H1 until the content has one;
// `fallback` (e.g. an imported file's name) covers the gap before that.
export function deriveTitle(content: string, fallback = "Untitled"): string {
  const heading = TITLE_FROM_HEADING.exec(content)?.[1]?.trim();
  return heading && heading.length > 0 ? heading : fallback;
}

// PDF export shows the title as its own heading already — strip a first
// heading from the body when it's the exact one the title came from, so
// it isn't printed twice. Leaves the content alone if title was manually
// overridden to something the body doesn't actually start with.
export function stripDerivedTitleHeading(content: string, title: string): string {
  const match = TITLE_FROM_HEADING.exec(content);
  if (!match || match[1].trim() !== title.trim()) return content;
  return content.slice(0, match.index) + content.slice(match.index + match[0].length);
}

export function createNote(content = "", fallbackTitle = "Untitled"): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: deriveTitle(content, fallbackTitle),
    titleIsManual: false,
    content,
    createdAt: now,
    updatedAt: now,
    version: 0,
  };
}
