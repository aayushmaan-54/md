import { getSetting, putSetting } from "../storage/settings-db";

export type Theme = "system" | "light" | "dark";
export type Font = "sans" | "serif" | "mono";

const THEME_KEY = "theme";
const FONT_KEY = "font";

const DEFAULT_THEME: Theme = "system";
const DEFAULT_FONT: Font = "sans";

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const isFont = (value: unknown): value is Font =>
  value === "sans" || value === "serif" || value === "mono";

// Applies immediately (synchronous DOM update — no flash while the write
// below settles) and persists in the background; callers don't need to
// await this to see the effect take place.
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  void putSetting(THEME_KEY, theme);
}

export function applyFont(font: Font): void {
  document.documentElement.dataset.font = font;
  void putSetting(FONT_KEY, font);
}

// Call once at startup, awaited before the app renders, so there's no
// flash of the defaults before the persisted theme/font (IndexedDB) loads.
export async function initAppearance(): Promise<void> {
  const [storedTheme, storedFont] = await Promise.all([
    getSetting(THEME_KEY),
    getSetting(FONT_KEY),
  ]);

  applyTheme(isTheme(storedTheme) ? storedTheme : DEFAULT_THEME);
  applyFont(isFont(storedFont) ? storedFont : DEFAULT_FONT);
}
