import { getSingletonHighlighter } from "shiki";
import type { BundledLanguage, BundledTheme } from "shiki";

export const SHIKI_THEME: BundledTheme = "github-dark";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function highlightCode(
  code: string,
  lang: string | undefined,
): Promise<string> {
  const requestedLang = (lang || "text") as BundledLanguage;

  try {
    const highlighter = await getSingletonHighlighter({
      themes: [SHIKI_THEME],
      langs: [requestedLang],
    });

    return highlighter.codeToHtml(code, {
      lang: requestedLang,
      theme: SHIKI_THEME,
    });
  } catch {
    // Unknown/unsupported language (or a bad fence info string) — fall
    // back to a plain, escaped block instead of breaking the whole render.
    return `<pre class="shiki-fallback"><code>${escapeHtml(code)}</code></pre>`;
  }
}
