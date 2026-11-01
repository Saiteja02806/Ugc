import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const button = readFileSync("components/ui/button.tsx", "utf8");
const composer = readFileSync("components/generation/ai-studio-composer.tsx", "utf8");
const recreate = readFileSync("components/explore/recreate-workspace.tsx", "utf8");

test("shared action buttons use a 10px corner", () => {
  assert.match(button, /justify-center rounded-\[10px\]/);
  assert.doesNotMatch(button, /rounded-\[min\(var\(--radius-md\)/);
  assert.match(button, /auth: "h-12 gap-3 rounded-full/);
});

test("AI Studio model and generate controls use the same 10px corner", () => {
  assert.match(composer, /Nano Banana|rounded-\[10px\] bg-card-muted\/80/);
  assert.equal(composer.includes("rounded-full bg-card-muted/80"), false);
  assert.match(composer, /h-10 rounded-\[10px\] px-5/);
});

test("Demo, Creative Assets, and Library actions use the 10px corner", () => {
  const demos = readFileSync("components/demos/demos-workspace.tsx", "utf8");
  const saved = readFileSync("components/avatars/saved-creative-assets-tab.tsx", "utf8");
  const library = readFileSync("components/library/library-workspace.tsx", "utf8");
  assert.match(demos, /demoPrimaryActionClassName =[\s\S]{0,80}rounded-\[10px\]/);
  assert.match(saved, /rounded-\[10px\] border border-border\/80 bg-card-muted\/80 p-1/);
  assert.match(library, /inline-flex h-9 items-center justify-center gap-2 rounded-\[10px\] bg-primary/);
});

test("Slideshow Recreate stays a labeled pill", () => {
  assert.match(recreate, /reference\.format === "slideshow" && "rounded-full"/);
});
