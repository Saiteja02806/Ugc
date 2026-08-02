import assert from "node:assert/strict";
import test from "node:test";

import { isThemePreference, resolveInitialTheme } from "./theme.ts";

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
