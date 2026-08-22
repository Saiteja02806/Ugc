import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isProductionThemeLocked,
  isThemePreference,
  resolveInitialTheme,
} from "./theme.ts";

test("theme defaults to light without a saved preference", () => {
  assert.equal(resolveInitialTheme(null), "light");
  assert.equal(resolveInitialTheme(undefined), "light");
  assert.equal(resolveInitialTheme("system"), "light");
});

test("theme honors an explicit saved light or dark preference", () => {
  assert.equal(resolveInitialTheme("light"), "light");
  assert.equal(resolveInitialTheme("dark"), "dark");
  assert.equal(isThemePreference("light"), true);
  assert.equal(isThemePreference("dark"), true);
});

test("production allows theme selection and defaults to light", () => {
  assert.equal(isProductionThemeLocked("production"), false);
  assert.equal(isProductionThemeLocked("preview"), false);
  assert.equal(isProductionThemeLocked(undefined), false);
  assert.equal(resolveInitialTheme("light", false), "light");
  assert.equal(resolveInitialTheme("dark", false), "dark");
  assert.equal(resolveInitialTheme(null, false), "light");
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
