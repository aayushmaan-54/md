import { getSetting, putSetting } from "../storage/settings-db";

export type Theme = "sage" | "iris" | "frost" | "paper" | "sepia" | "pine" | "carbon" | "plum" | "oled";
export type Font = "jbmono" | "plex" | "inter" | "system" | "serif" | "dyslexic";

const THEME_KEY = "theme";
const FONT_KEY = "font";

// Order matters here: this is also the Alt+T cycle order (light themes,
// then dark themes), and the set used to validate a stored value.
export const THEMES: Theme[] = [
  "sage", "iris", "frost", "paper", "sepia",
  "pine", "carbon", "plum", "oled",
];
export const FONTS: Font[] = ["jbmono", "plex", "inter", "system", "serif", "dyslexic"];

const DEFAULT_LIGHT_THEME: Theme = "sage";
const DEFAULT_DARK_THEME: Theme = "pine";
const DEFAULT_FONT: Font = "jbmono";

const DARK_THEMES = new Set<Theme>(["pine", "carbon", "plum", "oled"]);

export const isDarkTheme = (theme: string): boolean => DARK_THEMES.has(theme as Theme);

const isTheme = (value: unknown): value is Theme =>
  THEMES.includes(value as Theme);

const isFont = (value: unknown): value is Font =>
  FONTS.includes(value as Font);

const FAVICON_LINK_ID = "app-favicon";

// Reads --bg/--accent back from the just-applied theme so theme.css
// stays the only place these colors are defined.
function updateFavicon(): void {
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue("--bg").trim();
  const accent = styles.getPropertyValue("--accent").trim();
  if (!bg || !accent) return;

  // Explicit width/height plus a half-pixel inset on the rect avoid a
  // rasterizer seam some browsers show along a shape's viewBox edge.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill="${bg}"/>` +
    `<text x="24" y="30" text-anchor="middle" font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="24" font-weight="700" fill="${accent}">md</text>` +
    `</svg>`;

  let link = document.getElementById(FAVICON_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
      document.createElement("link");
    link.id = FAVICON_LINK_ID;
    link.rel = "icon";
    if (!link.isConnected) document.head.appendChild(link);
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  updateFavicon();
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  void putSetting(THEME_KEY, theme);
}

// "system" needs no network request; only one family loads at a time.
// Most are Google Fonts; OpenDyslexic isn't on Google Fonts, so it's
// loaded from its Fontsource build on jsdelivr instead.
const FONT_STYLESHEET_HREF: Partial<Record<Font, string>> = {
  jbmono: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
  plex: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap",
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  serif: "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600;700&display=swap",
  dyslexic: "https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.3.0/index.css",
};

const FONT_LINK_ID = "app-font-stylesheet";

function loadFontStylesheet(font: Font): void {
  const href = FONT_STYLESHEET_HREF[font];
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;

  if (!href) {
    existing?.remove();
    return;
  }
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }

  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function applyFont(font: Font): void {
  document.documentElement.dataset.font = font;
  loadFontStylesheet(font);
  try {
    localStorage.setItem(FONT_KEY, font);
  } catch {}
  void putSetting(FONT_KEY, font);
}

// Awaited before the app renders, so there's no flash of the defaults.
export async function initAppearance(): Promise<void> {
  const [storedTheme, storedFont] = await Promise.all([
    getSetting(THEME_KEY),
    getSetting(FONT_KEY),
  ]);

  const theme = isTheme(storedTheme)
    ? storedTheme
    : window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? DEFAULT_DARK_THEME
      : DEFAULT_LIGHT_THEME;

  applyTheme(theme);
  applyFont(isFont(storedFont) ? storedFont : DEFAULT_FONT);
}
