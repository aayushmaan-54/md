import { renderMarkdownToSafeHtml } from "./markdown";
import { highlightCode } from "./shiki";
import { getImage } from "../storage/images-db";
import { icon } from "../lib/icons";
import { escapeHtml } from "../lib/html";
import { isDarkTheme } from "../lib/appearance";

let renderGeneration = 0;

// theme+lang+text -> highlighted HTML. Avoids re-highlighting an
// unchanged code block on every debounced render; theme is part of the
// key since highlightCode() picks colors per active theme. Capped to
// bound memory across a long session.
const highlightCache = new Map<string, string>();
const HIGHLIGHT_CACHE_LIMIT = 300;

// local-image id -> object URL. A local image's blob is immutable once
// pasted, so the URL is reused across renders instead of recreated.
const imageUrlCache = new Map<string, string>();

// Renders synchronously (fast first paint), then hydrates code
// blocks/images asynchronously. Guards against overlapping calls: a
// stale call's writes are skipped once a newer render has started or
// its target element is disconnected.
export async function renderPreview(
  container: HTMLElement,
  source: string,
): Promise<void> {
  const generation = ++renderGeneration;
  const { html, codeBlocks } = renderMarkdownToSafeHtml(source);

  // Reassigning innerHTML clamps scrollTop to 0 as the old children are
  // removed; restore it immediately so an in-place re-render (typing,
  // a checkbox toggle, a theme change) doesn't jump the view.
  const previousScrollTop = container.scrollTop;
  container.innerHTML = html;
  container.scrollTop = previousScrollTop;

  const placeholders = Array.from(
    container.querySelectorAll<HTMLElement>("[data-code-index]"),
  );

  const imageEls = Array.from(
    container.querySelectorAll<HTMLImageElement>("[data-local-image]"),
  );

  await Promise.all([
    ...placeholders.map(async (el) => {
      const index = Number(el.getAttribute("data-code-index"));
      const block = codeBlocks[index];
      if (!block) return;

      const theme = isDarkTheme(document.documentElement.dataset.theme ?? "") ? "dark" : "light";
      const cacheKey = `${theme}\0${block.lang ?? ""}\0${block.text}`;
      let highlighted = highlightCache.get(cacheKey);
      if (highlighted !== undefined) {
        highlightCache.delete(cacheKey);
        highlightCache.set(cacheKey, highlighted);
      } else {
        highlighted = await highlightCode(block.text, block.lang);
        if (highlightCache.size >= HIGHLIGHT_CACHE_LIMIT) {
          const oldest = highlightCache.keys().next().value;
          if (oldest !== undefined) highlightCache.delete(oldest);
        }
        highlightCache.set(cacheKey, highlighted);
      }

      if (generation !== renderGeneration || !el.isConnected) return;
      el.outerHTML = wrapCodeBlock(highlighted, block.text);
    }),
    ...imageEls.map((img) => hydrateLocalImage(img, generation)),
  ]);
}

// The raw (pre-highlight) code is stashed in a data attribute — HTML
// attribute decoding hands it back verbatim on click, which is simpler
// and safer than trying to recover it from Shiki's span-wrapped markup.
function wrapCodeBlock(highlightedHtml: string, rawText: string): string {
  return (
    `<div class="code-block">` +
    `<button type="button" class="code-copy" data-copy-code="${escapeHtml(rawText)}" title="Copy code">` +
    `${icon("copy")}<span>Copy</span></button>` +
    highlightedHtml +
    `</div>`
  );
}

async function hydrateLocalImage(
  img: HTMLImageElement,
  generation: number,
): Promise<void> {
  const id = img.dataset.localImage;
  if (!id) return;

  const cached = imageUrlCache.get(id);
  if (cached !== undefined) {
    img.src = cached;
    return;
  }

  const record = await getImage(id);
  if (generation !== renderGeneration || !img.isConnected) return;

  if (!record) {
    img.alt = `${img.alt} (image not found)`;
    return;
  }

  const url = URL.createObjectURL(record.blob);
  imageUrlCache.set(id, url);
  img.src = url;
}

export function releaseLocalImageUrl(id: string): void {
  const url = imageUrlCache.get(id);
  if (url === undefined) return;
  imageUrlCache.delete(id);
  URL.revokeObjectURL(url);
}
