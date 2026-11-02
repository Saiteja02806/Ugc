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
  assert.equal(THEME_BACKGROUND_COLORS.dark, "#121212");
});

test("the app canvas retints inside the shell and the landing button stays white", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/layout/app-shell.tsx", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(shell, /className="app-canvas /);
  assert.match(css, /\.dark \.app-canvas \{[^}]*--background: #101014;/);
  assert.match(css, /\.dark \.app-canvas \{[^}]*--card: #17171c;/);
  assert.match(css, /\.dark:has\(\.app-canvas\)[^{]*\{[^}]*--card: #17171c;/);
  assert.match(css, /\.dark \.app-canvas \.bg-primary \{[^}]*background-color: #0078d4;/);
  assert.match(css, /\.bg-primary \{[^}]*background-color: #0078d4;/);
  assert.doesNotMatch(css, /#8b5cf6|#7c3aed|#c084fc/);
  assert.match(css, /\.landing-mono \.bg-primary \{[^}]*background-color: #ffffff;/);
  assert.match(landing, /redirect\("\/explore"\)/);
  assert.doesNotMatch(landing, /landing-mono|app-canvas/);
});

test("sidebar and workflow chrome stay neutral while the action button stays violet", () => {
  const sidebar = readFileSync(new URL("../components/layout/app-sidebar.tsx", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../components/explore/workflow-creation.module.css", import.meta.url), "utf8");
  const stages = readFileSync(new URL("../components/explore/workflow-section-layout.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(sidebar, /bg-brand/);
  assert.doesNotMatch(sidebar, /text-primary/);
  assert.match(sidebar, /label: "Demo"[\s\S]*icon: "play"/);
  assert.match(workflow, /\.sectionTab\[data-active\]::after \{[^}]*background: var\(--foreground\)/);
  assert.match(stages, /\.stageTab\[data-active\]::after \{[^}]*background: var\(--foreground\)/);
  const references = readFileSync(new URL("../components/explore/talking-head-references.module.css", import.meta.url), "utf8");
  const recreate = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  assert.match(references, /\.tabs button\[aria-pressed="true"\] \{ border-color: var\(--foreground\); color: var\(--foreground-strong\); \}/);
  assert.doesNotMatch(recreate, /data-reference-new className="[^"]*bg-primary/);
  assert.doesNotMatch(recreate, /hover:bg-primary|border-primary bg-primary/);
  assert.match(recreate, /isSelected \? "border-white bg-black\/60 text-white"/);
  const slideshow = readFileSync(new URL("../components/explore/format-workspace.module.css", import.meta.url), "utf8");
  const audio = readFileSync(new URL("../components/audio/audio-generation.css", import.meta.url), "utf8");
  const photos = readFileSync(new URL("../components/explore/talking-head-photo-library.tsx", import.meta.url), "utf8");
  assert.match(workflow, /\.platformButton\[aria-pressed="true"\] \{ border-color: var\(--foreground\)/);
  assert.match(slideshow, /\.slideshowReferenceTile \{[^}]*border: 1px solid var\(--foreground\)/);
  assert.doesNotMatch(photos, /border-primary bg-primary/);
  assert.match(audio, /\.audio-primary \{[^}]*background: #0078d4/);
  assert.doesNotMatch(audio, /border-color: var\(--primary\)/);
  const signIn = readFileSync(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(signIn, /sign-in-screen/);
  assert.doesNotMatch(signIn, /bg-primary|instagram-violet/);
  assert.match(styles, /\.sign-in-screen \.bg-primary \{[^}]*background-image: none;/);
});

test("the product mark is the blue play logo and the shared name uses medium DM Sans", () => {
  const mark = readFileSync(new URL("../components/brand/product-logo.tsx", import.meta.url), "utf8");
  const signIn = readFileSync(new URL("../app/sign-in/page.tsx", import.meta.url), "utf8");
  const sidebar = readFileSync(new URL("../components/layout/app-sidebar.tsx", import.meta.url), "utf8");
  const pricing = readFileSync(new URL("../components/pricing/pricing-page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(mark, /vidmake-mark\.png/);
  assert.match(mark, /fontFamily:.*Vidmake DM Sans/);
  assert.match(mark, /font-medium/);
  assert.doesNotMatch(mark, /font-extrabold|--font-brand-serif/);
  assert.doesNotMatch(mark, /brightness-0|ugc-pilot-icon-/);
  assert.match(layout, /--font-brand-serif/);
  assert.match(layout, /X8wAlsUNDn-IxZoXdj-k5R1WhTKxO8Eb1GEJKzzFyvM/);
  assert.match(signIn, /ProductWordmark/);
  assert.match(sidebar, /ProductWordmark variant="ui"/);
  assert.match(pricing, /ProductWordmark/);
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
    /<Script\s+id="ugc-pilot-theme"\s+strategy="beforeInteractive"\s+dangerouslySetInnerHTML=\{\{ __html: themeInitializationScript \}\}/,
  );
});

test("the landing hero remains fully visible through first paint and hydration", () => {
  const landingSource = readFileSync(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(landingSource, /hero-rise/);
  assert.doesNotMatch(styles, /@keyframes hero-rise|\.hero-rise/);
  assert.match(styles, /@keyframes section-reveal/);
  assert.match(styles, /\.landing-reveal/);
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
