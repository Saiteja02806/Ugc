export const THEME_STORAGE_KEY = "ugc-pilot-theme";

export type ThemePreference = "dark" | "light";

export const THEME_BACKGROUND_COLORS = {
  dark: "#121212",
  light: "#f8fafc",
} satisfies Record<ThemePreference, string>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function isProductionThemeLocked(_value?: unknown) {
  void _value;
  return false;
}

export function resolveInitialTheme(
  value: unknown,
  forceDark = false,
): ThemePreference {
  if (forceDark) return "dark";

  return isThemePreference(value) ? value : "dark";
}
