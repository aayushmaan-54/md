import { Marked } from "marked";
import type { Tokens } from "marked";
import DOMPurify from "dompurify";
import { parseLocalImageHref } from "../images/model";
import { escapeHtml } from "../lib/html";

export type PendingCodeBlock = { text: string; lang?: string };

type RenderState = { codeBlocks: PendingCodeBlock[]; taskIndex: number };

// Mutable by design: the renderer methods below close over this binding
// (not a snapshot), so reassigning it before each parse() call gives every
// render its own fresh set of code blocks / task-checkbox indices.
let state: RenderState = { codeBlocks: [], taskIndex: 0 };

// Code blocks and task checkboxes can't be rendered synchronously here —
// Shiki highlighting is async, and marked's block parser never awaits a
// renderer's return value. So this pass emits placeholders (with an index
// into `state.codeBlocks`, or a sequential task index) and the hydration
// pass in render.ts fills them in afterwards.
const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const index = state.codeBlocks.push({ text, lang }) - 1;
      return `<pre data-code-index="${index}"><code></code></pre>`;
    },
    checkbox({ checked }: Tokens.Checkbox) {
      const index = state.taskIndex++;
      return `<input type="checkbox" data-task-index="${index}"${checked ? " checked" : ""}>`;
    },
    // A pasted image is written to the doc as ![](local-image:<uuid>) —
    // see images/insert.ts. That id has no meaning outside this browser
    // (it's an IndexedDB key), so it can't be a real <img src>; emit a
    // placeholder and let render.ts's hydration pass resolve it to an
    // object URL for the stored blob. Anything else (an external image
    // URL the user typed by hand) renders normally.
    image({ href, title, text }: Tokens.Image) {
      const localId = parseLocalImageHref(href);
      if (localId !== null) {
        return `<img data-local-image="${escapeHtml(localId)}" alt="${escapeHtml(text)}">`;
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr}>`;
    },
  },
});

export type MarkdownRenderResult = {
  html: string;
  codeBlocks: PendingCodeBlock[];
};

export function renderMarkdownToSafeHtml(source: string): MarkdownRenderResult {
  state = { codeBlocks: [], taskIndex: 0 };

  const rawHtml = marked.parse(source, { async: false }) as string;

  // Sanitizes everything the user typed as raw embedded HTML. The code
  // placeholders' own attributes and the task checkboxes are ours, not
  // user input, so they're just allow-listed alongside the defaults.
  const html = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ["input"],
    ADD_ATTR: [
      "type",
      "checked",
      "data-task-index",
      "data-code-index",
      "data-local-image",
    ],
  });

  return { html, codeBlocks: state.codeBlocks };
}
