import { renderMarkdownToSafeHtml } from "./markdown";
import { highlightCode } from "./shiki";
import { getImage } from "../storage/images-db";

let renderGeneration = 0;

// Renders markdown -> sanitized HTML synchronously (fast path, first
// paint), then hydrates fenced code blocks with Shiki asynchronously.
// Guarded against overlapping calls (e.g. the user typing again before a
// slow highlight resolves): a stale call's writes are skipped once a newer
// render has started, and once its target element is no longer connected
// (its container's innerHTML was already replaced by a newer call, which
// would otherwise throw when setting outerHTML on a detached node).
export async function renderPreview(
  container: HTMLElement,
  source: string,
): Promise<void> {
  const generation = ++renderGeneration;
  const { html, codeBlocks } = renderMarkdownToSafeHtml(source);

  container.innerHTML = html;

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

      const highlighted = await highlightCode(block.text, block.lang);

      if (generation !== renderGeneration || !el.isConnected) return;
      el.outerHTML = highlighted;
    }),
    ...imageEls.map((img) => hydrateLocalImage(img, generation)),
  ]);
}

// A local-image id is an IndexedDB key, not a URL — this looks it up and
// swaps in a fresh object URL for the stored blob. Revoked as soon as the
// image has actually loaded so a fast-typing session (a re-render every
// ~200ms while an image is on screen) doesn't pile up blob URLs that are
// never freed.
async function hydrateLocalImage(
  img: HTMLImageElement,
  generation: number,
): Promise<void> {
  const id = img.dataset.localImage;
  if (!id) return;

  const record = await getImage(id);
  if (generation !== renderGeneration || !img.isConnected) return;

  if (!record) {
    img.alt = `${img.alt} (image not found)`;
    return;
  }

  const url = URL.createObjectURL(record.blob);
  img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  img.src = url;
}
