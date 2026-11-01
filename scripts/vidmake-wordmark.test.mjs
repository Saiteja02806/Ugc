import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../components/brand/vidmake-wordmark.module.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../components/brand/vidmake-wordmark.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../components/layout/app-sidebar.tsx", import.meta.url), "utf8");
const landingHeader = readFileSync(new URL("../components/marketing/landing-header.tsx", import.meta.url), "utf8");

test("the icon and the letter stay separate layers and the squeeze is horizontal only", () => {
  assert.match(source, /polygon points="1,1 9,6 1,11"/);
  assert.match(source, /<span className=\{styles\.letter\}>v<\/span>/);
  assert.match(source, /idmake\{variant === "full" \? "\.io" : null\}/);
  assert.match(css, /scale: 0\.15 1/);
  assert.doesNotMatch(css, /scale: 0\.15 0\.15/);
  assert.match(css, /rotate: -90deg/);
  assert.match(css, /scale: 0\.85/);
  assert.match(css, /scale: 1\.05/);
});

test("the reveal keeps the brief's beat boundaries and the loop fades only at the seam", () => {
  assert.match(css, /18%,\s*58%/);
  assert.match(css, /0%,\s*28%/);
  assert.match(css, /36%,\s*100%/);
  assert.match(css, /74%,\s*100%/);
  assert.match(css, /0%,\s*90%/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("the app sidebar plays the header lockup once and the landing header is untouched", () => {
  assert.match(sidebar, /<VidmakeWordmark[\s\S]*play="once"[\s\S]*variant="header"/);
  assert.match(landingHeader, /<LandingLogo/);
  assert.match(landingHeader, /Vidmake/);
  assert.doesNotMatch(landingHeader, /VidmakeWordmark/);
});
