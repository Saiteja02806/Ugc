import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isProductionThemeLocked,
  isThemePreference,
  resolveInitialTheme,
  THEME_BACKGROUND_COLORS,
} from "./theme.ts";

test("theme defaults to dark without a saved preference", () => {
  assert.equal(resolveInitialTheme(null), "dark");
  assert.equal(resolveInitialTheme(undefined), "dark");
  assert.equal(resolveInitialTheme("system"), "dark");
});

test("theme honors an explicit saved light or dark preference", () => {
  assert.equal(resolveInitialTheme("light"), "light");
  assert.equal(resolveInitialTheme("dark"), "dark");
  assert.equal(isThemePreference("light"), true);
  assert.equal(isThemePreference("dark"), true);
});

test("theme backgrounds match the global light and dark canvas colors", () => {
  assert.equal(THEME_BACKGROUND_COLORS.light, "#f8fafc");
  assert.equal(THEME_BACKGROUND_COLORS.dark, "#1f1f1f");
});

test("production allows theme selection and defaults to dark", () => {
  assert.equal(isProductionThemeLocked("production"), false);
  assert.equal(isProductionThemeLocked("preview"), false);
  assert.equal(isProductionThemeLocked(undefined), false);
  assert.equal(resolveInitialTheme("light", false), "light");
  assert.equal(resolveInitialTheme("dark", false), "dark");
  assert.equal(resolveInitialTheme(null, false), "dark");
});

test("the root layout renders dark before the saved choice is read", () => {
  const layoutSource = readFileSync(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layoutSource, /savedTheme === "light" \? "light" : "dark"/);
  assert.match(layoutSource, /h-full dark/);
  assert.match(layoutSource, /data-theme="dark"/);
  assert.match(
    layoutSource,
    /backgroundColor: THEME_BACKGROUND_COLORS\.dark/,
  );
  assert.match(
    layoutSource,
    /root\.style\.backgroundColor = themeBackgroundColors\[theme\]/,
  );
  assert.match(
    layoutSource,
    /<head>[\s\S]*id="ugc-pilot-theme"[\s\S]*themeInitializationScript[\s\S]*<\/head>/,
  );
});

test("dialog footers and destructive actions use semantic colors in both themes", () => {
  const dialogSource = readFileSync(
    new URL("../components/ui/dialog.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(dialogSource, /border-border bg-popover/);
  assert.doesNotMatch(dialogSource, /bg-muted\/50/);
  assert.match(
    styles,
    /:root,[\s\S]*?--error-foreground: #ffffff;[\s\S]*?--popover: var\(--card\);/,
  );
  assert.match(
    styles,
    /\.dark,[\s\S]*?--error-foreground: #2a1010;[\s\S]*?--popover: var\(--card\);/,
  );
});
