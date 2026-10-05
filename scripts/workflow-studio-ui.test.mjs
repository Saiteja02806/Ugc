import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const styles = read("components/explore/workflow-studio.module.css");
const gallery = read("components/explore/recreate-workspace.tsx");
const chat = read("components/explore/recreate-generation-panel.tsx");
const hook = read("components/explore/hook-workflow-preview.tsx");
const composer = read("components/explore/workflow-creation-form.tsx");
const preview = gallery.slice(gallery.indexOf("function ReferencePreviewDialog"), gallery.indexOf("function ReferenceGridSkeleton"));

test("studio presentation is scoped to the two workflows", () => {
  for (const source of [gallery, chat, hook, composer]) assert.match(source, /workflow-studio\.module\.css/);
  for (const file of ["app/globals.css", "components/generation/ai-studio-composer.tsx", "components/ui/dialog.tsx", "components/ui/popover.tsx"]) {
    assert.doesNotMatch(read(file), /workflow-studio/);
  }
  assert.match(styles, /\.chat form\[data-layout\]/);
  assert.match(styles, /border-radius: 28px/);
  assert.match(styles, /:global\(body\):has\(\.studio\) :global\(\[data-slot="popover-content"\]\)/);
  assert.match(styles, /:global\(body\):has\(\.studio\) :global\(\[data-ai-studio-setting-option\]\)/);
});

test("workflow motion is short, explicitly scoped and reduced-motion safe", () => {
  assert.doesNotMatch(styles, /transition:\s*all|transition-property:\s*all/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /animation: none !important/);
  assert.match(styles, /transition: none !important/);
  assert.match(styles, /\.floating\[data-open\]/);
  assert.match(styles, /\.dialog\[data-closed\]/);
  assert.match(styles, /\.drawer\[data-open\]/);
  assert.match(styles, /220ms/);
  const keyframes = styles.slice(styles.indexOf("@keyframes"), styles.indexOf("@media"));
  assert.doesNotMatch(keyframes, /\b(width|height|left|top):/);
});

test("Recreate gallery uses two or three columns based on its available width", () => {
  assert.match(styles, /container: workflow-gallery \/ inline-size/);
  assert.match(styles, /@container workflow-gallery \(min-width: 660px\)/);
  assert.match(styles, /@container workflow-gallery \(min-width: 1000px\)/);
  const recreateLayout = read("components/explore/recreate-layout.module.css");
  assert.match(gallery, /const GALLERY_GRID = layout\.galleryGrid/);
  assert.match(recreateLayout, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(recreateLayout, /@container workflow-gallery \(min-width: 660px\)\s*\{\s*\.galleryGrid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(recreateLayout, /auto-fill|repeat\([45],/);
  assert.match(gallery, /className=\{cn\(studio\.gallery,/);
});

test("gallery covers fill the card without changing the uncropped preview or source", () => {
  const media = gallery.slice(gallery.indexOf("function ReferenceMedia"), gallery.indexOf("function ReferencePreviewDialog"));
  assert.match(media, /src=\{reference\.posterUrl\}/);
  assert.match(media, /src=\{reference\.videoUrl\}/);
  assert.equal((media.match(/size-full object-cover/g) ?? []).length, 2);
  assert.doesNotMatch(media, /object-contain|object-fill/);
  assert.match(preview, /src=\{activeSlideData\.url\}/);
  assert.match(preview, /object-contain/);
});

test("reference changes and mode transitions do not remount the generators", () => {
  assert.match(chat, /<ImagePanel active=\{mode === "images"\}/);
  assert.match(chat, /<VideoPanel active=\{mode === "videos"\}/);
  assert.doesNotMatch(chat, /<(?:ImagePanel|VideoPanel)[^>]*\bkey=/);
  assert.match(chat, /tabIndex=\{mode === value \? 0 : -1\}/);
  assert.match(chat, /event\.key === "Home"/);
  assert.match(chat, /event\.key === "End"/);
  assert.match(chat, /localPreview \? "locked"/);
});

test("preview exit completes before resetting the slide, with full-image sizing and no side bars", () => {
  assert.match(gallery, /onOpenChange=\{setPreviewOpen\}/);
  assert.match(preview, /onOpenChangeComplete=\{\(isOpen\) => \{ if \(!isOpen\) setActiveSlide\(0\)/);
  assert.match(preview, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  const mainImage = preview.match(/<img src=\{activeSlideData\.url\}[^>]+>/)?.[0] ?? "";
  assert.match(mainImage, /width=\{activeSlideData\.width\}/);
  assert.match(mainImage, /height=\{activeSlideData\.height\}/);
  assert.match(mainImage, /h-auto[^\"]*w-auto max-w-full/);
  assert.match(mainImage, /object-contain/);
  assert.doesNotMatch(mainImage, /(?:\s|")(?:w-full|object-cover|bg-black|bg-card)(?:\s|")/);
  assert.match(preview, /View slide \$\{index \+ 1\}/);
});

test("visible reference labels stay format-based and controls stay rounded", () => {
  assert.match(chat, /Slideshow reference/);
  assert.match(chat, /Hook reference/);
  assert.doesNotMatch(chat, />\{reference\.title\}</);
  assert.match(preview, /Slideshow preview/);
  assert.doesNotMatch(preview, /<DialogTitle>\{reference\.title\}|reference\.category\.label/);
  assert.match(preview, /aria-live="polite"/);
  assert.match(preview, /className="rounded-full"/);
  const filter = gallery.slice(gallery.indexOf("function FilterMenu"), gallery.indexOf("function ReferenceCard"));
  assert.doesNotMatch(filter, /\{category\.count\}|>\{count\}</);
});
