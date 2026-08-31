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
