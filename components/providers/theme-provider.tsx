"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  resolveInitialTheme,
  THEME_BACKGROUND_COLORS,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  locked: boolean;
  setTheme: (theme: ThemePreference) => void;
  theme: ThemePreference;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_CHANGE_EVENT = "ugc-pilot-theme-change";

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.backgroundColor = THEME_BACKGROUND_COLORS[theme];
}

function getThemeSnapshot(forceDark: boolean): ThemePreference {
  return resolveInitialTheme(
    document.documentElement.dataset.theme,
    forceDark,
  );
}

function getServerThemeSnapshot(forceDark: boolean): ThemePreference {
  return resolveInitialTheme(undefined, forceDark);
}

function subscribeToTheme(onStoreChange: () => void, forceDark: boolean) {
  const handleThemeChange = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;

    applyTheme(resolveInitialTheme(event.newValue, forceDark));
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function ThemeProvider({
  children,
  forceDark = false,
}: {
  children: ReactNode;
  forceDark?: boolean;
}) {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeToTheme(onStoreChange, forceDark),
    [forceDark],
  );
  const getSnapshot = useCallback(
    () => getThemeSnapshot(forceDark),
    [forceDark],
  );
  const getServerSnapshot = useCallback(
    () => getServerThemeSnapshot(forceDark),
    [forceDark],
  );
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    const resolvedTheme = resolveInitialTheme(nextTheme, forceDark);

    applyTheme(resolvedTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    } catch {
      // The visual preference still applies for this session when storage is blocked.
    }

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, [forceDark]);

  const value = useMemo(
    () => ({ locked: forceDark, setTheme, theme }),
    [forceDark, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
