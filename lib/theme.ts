export const THEME_STORAGE_KEY = "ugc-pilot-theme";

export type ThemePreference = "dark" | "light";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function isProductionThemeLocked(value?: unknown) {
  void value;
  return false;
}

export function resolveInitialTheme(
  value: unknown,
  forceDark = false,
): ThemePreference {
  if (forceDark) return "dark";

  return isThemePreference(value) ? value : "light";
}
