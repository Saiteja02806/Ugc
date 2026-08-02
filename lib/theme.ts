export const THEME_STORAGE_KEY = "ugc-pilot-theme";

export type ThemePreference = "dark" | "light";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function resolveInitialTheme(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "light";
}
