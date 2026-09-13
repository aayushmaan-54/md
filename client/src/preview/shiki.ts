import type { BundledLanguage, BundledTheme } from "shiki";
import { isDarkTheme } from "../lib/appearance";

// Same GitHub family as the editor's syntax theme (editor/highlight.ts),
// picked per active app theme so light mode doesn't get a dark code block.
const LIGHT_SHIKI_THEME: BundledTheme = "github-light";
const DARK_SHIKI_THEME: BundledTheme = "github-dark";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Loaded lazily, on first code block hydrated, and cached — a note with
// no code fences never fetches Shiki's core/engine at all. Importing
// from "shiki" directly would also pull in its default WASM oniguruma
// engine unconditionally (~600KB+); these subpaths avoid it.
let shikiModules: ReturnType<typeof loadShikiModules> | undefined;

async function loadShikiModules() {
  const [
    { getSingletonHighlighterCore },
    { createJavaScriptRegexEngine },
    { bundledLanguages },
    { bundledThemes },
  ] = await Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/langs"),
    import("shiki/themes"),
  ]);

  return {
    getSingletonHighlighterCore,
    jsRegexEngine: createJavaScriptRegexEngine(),
    bundledLanguages,
    bundledThemes,
  };
}

function getShikiModules() {
  if (!shikiModules) {
    shikiModules = loadShikiModules().catch((err) => {
      shikiModules = undefined;
      throw err;
    });
  }
  return shikiModules;
}

// Fire-and-forget: warms the module cache ahead of the first code block,
// without making first paint wait on it. Call once, at idle, after boot.
export function preloadShiki(): void {
  void getShikiModules();
}

export async function highlightCode(
  code: string,
  lang: string | undefined,
): Promise<string> {
  const requestedLang = (lang || "text") as BundledLanguage;
  const theme = isDarkTheme(document.documentElement.dataset.theme ?? "")
    ? DARK_SHIKI_THEME
    : LIGHT_SHIKI_THEME;

  try {
    const { getSingletonHighlighterCore, jsRegexEngine, bundledLanguages, bundledThemes } =
      await getShikiModules();

    const highlighter = await getSingletonHighlighterCore({
      engine: jsRegexEngine,
      themes: [bundledThemes[LIGHT_SHIKI_THEME], bundledThemes[DARK_SHIKI_THEME]],
      langs: [bundledLanguages[requestedLang]],
    });

    return highlighter.codeToHtml(code, {
      lang: requestedLang,
      theme,
    });
  } catch {
    // Unknown/unsupported language (or a bad fence info string), or the
    // lazy Shiki modules failed to load — fall back to a plain, escaped
    // block instead of breaking the whole render.
    return `<pre class="shiki-fallback"><code>${escapeHtml(code)}</code></pre>`;
  }
}
