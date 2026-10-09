import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(
  readFileSync(new URL("../lib/explore/imported-catalog.json", import.meta.url), "utf8"),
);
const preparer = readFileSync(
  new URL("./prepare-explore-catalog.mjs", import.meta.url),
  "utf8",
);
const importer = readFileSync(
  new URL("./import-explore-recreate-assets.mjs", import.meta.url),
  "utf8",
);
const recreateCatalog = readFileSync(
  new URL("../lib/explore/recreate-catalog.ts", import.meta.url),
  "utf8",
);

test("the imported Explore catalogue preserves the supplied content structure", () => {
  const slideshows = catalog.items.filter((item) => item.format === "slideshow");
  const wallTextVideos = catalog.items.filter((item) => item.format === "wall_text");

  assert.equal(catalog.version, 1);
  assert.equal(catalog.mediaStatus, "published");
  assert.equal(slideshows.length, 58);
  assert.equal(wallTextVideos.length, 28);
  assert.equal(slideshows.reduce((total, item) => total + item.slides.length, 0), 326);
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(slideshows.map((item) => item.category))]
        .sort()
        .map((category) => [
          category,
          slideshows.filter((item) => item.category === category).length,
        ]),
      ),
    {
      "calory-tracking": 6,
      fitness: 14,
      "goal-tracker": 3,
      habit: 2,
      "interior-design": 3,
      "interview-app": 3,
      marketing: 1,
      "note-taking": 1,
      "pet-tracking": 3,
      productivity: 1,
      relationship: 5,
      "screen-blocker": 3,
      skincare: 8,
      study: 5,
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(wallTextVideos.map((item) => item.category))]
        .sort()
        .map((category) => [
          category,
          wallTextVideos.filter((item) => item.category === category).length,
        ]),
      ),
    {
      bible: 7,
      "finance-and-investing": 6,
      fitness: 9,
      marketing: 2,
      mindset: 1,
      study: 3,
    },
  );
});

test("September 30 additions preserve every original item and ordered slide byte-for-byte", () => {
  // Hash of the complete 66-item catalogue before this additive import.
  const originalHash = "c892521201f30b3f2835aba8ab36b9738975ff991ce0515431921b0ec28fb842";
  assert.equal(createHash("sha256").update(JSON.stringify(catalog.items.slice(0, 66))).digest("hex"), originalHash);
  const additions = catalog.items.slice(66, 84);
  assert.equal(additions.filter((item) => item.format === "slideshow").length, 11);
  const hooks = additions.filter((item) => item.format === "hook");
  assert.equal(hooks.length, 7);
  assert.equal(hooks.every((item) => item.category === null && item.categoryLabel === null && item.slides.length === 0 && item.durationSeconds > 0), true);
  assert.equal(new Set(hooks.map((item) => item.videoFile)).size, 7);
});

test("October 5 category additions preserve all 84 previously published references", () => {
  const originalHash = "694b3e0db7a22f17a978be8042da262298b2e8de8f23bdc5c94dcd1d8d4ed13c";
  assert.equal(createHash("sha256").update(JSON.stringify(catalog.items.slice(0, 84))).digest("hex"), originalHash);
  assert.equal(catalog.items.length, 93);
  const additions = catalog.items.slice(84);
  assert.equal(additions.length, 9);
  assert.equal(additions.every((item) => item.format === "slideshow" && ["calory-tracking", "pet-tracking"].includes(item.category)), true);
  assert.deepEqual(additions.map((item) => item.slides.length), [6, 5, 6, 6, 6, 7, 6, 6, 6]);
  assert.deepEqual(additions.map((item) => item.title), [
    ...Array.from({ length: 6 }, (_, index) => `Calory Tracking ${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 3 }, (_, index) => `Pet Tracking ${String(index + 1).padStart(2, "0")}`),
  ]);
  for (const item of additions) {
    assert.equal(item.posterFile, item.slides[0].file);
    assert.deepEqual(item.slides.map((slide) => slide.id.split("-")[1]), item.slides.map((_, index) => String(index + 1)));
    assert.equal(item.slides.every((slide) => slide.width > 0 && slide.height > 0 && /^[a-f0-9]{64}\.jpg$/.test(slide.file)), true);
  }
  assert.equal(catalog.release, createHash("sha256").update(JSON.stringify(catalog.items)).digest("hex").slice(0, 20));
});

test("every slideshow keeps its own ordered collection rather than flattening slides", () => {
  const slideshows = catalog.items.filter((item) => item.format === "slideshow");
  assert.equal(slideshows.every((item) => item.slides.length >= 2), true);
  assert.equal(
    slideshows.every((item) => item.posterFile === item.slides[0].file),
    true,
  );
  assert.equal(
    new Set(catalog.items.map((item) => item.id)).size,
    catalog.items.length,
  );
});

test("catalog preparation is local by default and does not contain a remote uploader", () => {
  assert.match(preparer, /--stage-local/);
  assert.match(preparer, /remoteWrites: 0/);
  assert.doesNotMatch(preparer, /uploadBufferToStorage|@google-cloud\/storage/);
});

test("the media importer cannot write until an explicit, confirmed execution", () => {
  assert.match(importer, /--execute --yes/);
  assert.match(importer, /if \(!execute\) \{/);
  assert.match(importer, /No cloud object or catalogue metadata was changed/);
  assert.match(importer, /writePublishedManifest\(manifestPath, manifest\)/);
});

test("staged media cannot reach a signed-in user before its cloud objects are verified", () => {
  assert.match(recreateCatalog, /importedCatalog\.mediaStatus === "published"/);
  assert.match(importer, /writePublishedManifest\(manifestPath, manifest\)/);
});

test("local preview media is development-only and restricted to the manifest", () => {
  const route = readFileSync(new URL("../app/api/explore/local-media/[file]/route.ts", import.meta.url), "utf8");
  assert.match(route, /process\.env\.NODE_ENV !== "development"/);
  assert.match(route, /!allowedFiles\.has\(file\)/);
  assert.match(route, /status: 404/);
  assert.match(route, /status: 206/);
  assert.match(recreateCatalog, /process\.env\.NODE_ENV !== "development"/);
});

test("all three approved workflows stay visible with their supplied covers", () => {
  const workflows = readFileSync(new URL("../lib/explore/workflows.ts", import.meta.url), "utf8");
  const liveCatalogue = workflows.slice(workflows.indexOf("export const EXPLORE_WORKFLOWS"), workflows.indexOf("export const LOCAL_PREVIEW_WORKFLOWS"));
  for (const id of ["hook-video", "wall-of-text", "slideshows"]) {
    assert.match(liveCatalogue, new RegExp(`id: "${id}"`));
    assert.match(liveCatalogue, new RegExp(`destination: "/explore/${id}"`));
    assert.match(liveCatalogue, new RegExp(`coverVideo: "/explore/covers/${id}-v[0-9]+\\.mp4"`));
    assert.match(liveCatalogue, new RegExp(`coverPoster: "/explore/covers/${id}-v[0-9]+\\.webp"`));
  }
  assert.doesNotMatch(liveCatalogue, /coming_soon|coverVideo: null/);
});

test("Recreate uses embedded generation controls and locks paid actions in preview", () => {
  const panel = readFileSync(new URL("../components/explore/recreate-generation-panel.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  assert.match(panel, /localPreview \? "locked" : accountAccessState/);
  assert.match(panel, /<ImagePanel/);
  assert.match(panel, /<VideoPanel/);
  assert.match(panel, /aria-label="Creation chat"/);
  assert.doesNotMatch(workspace, /Creation handoff|Using as reference/);
});

test("gallery cards are visual-only with one slideshow count on the media", () => {
  const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  const card = workspace.slice(workspace.indexOf("function ReferenceCard("), workspace.indexOf("function ReferenceMedia("));
  assert.doesNotMatch(card, /categoryLabel|slides\.length|Use reference/);
  assert.match(card, /compact \?/);
  assert.match(card, /aria-label=\{`Recreate \$\{reference\.title\}`\}/);
  const media = workspace.slice(workspace.indexOf("function ReferenceMedia("), workspace.indexOf("export function ReferencePreviewDialog("));
  assert.equal((media.match(/reference\.slides\.length/g) ?? []).length, 1);
});

test("compact composer exposes settings in a scrollable rail without a Settings launcher", () => {
  const composer = readFileSync(new URL("../components/generation/ai-studio-composer.tsx", import.meta.url), "utf8");
  assert.match(composer, /compact = false/);
  assert.match(composer, /<ComposerSettingsRail>\{settings\}<\/ComposerSettingsRail>/);
  assert.doesNotMatch(composer, /composer-settings-label|>Settings<\/span>/);
  assert.match(composer, /compact \? "Generate" : generateLabel/);
  assert.match(composer, /aria-label=\{generateLabel\}/);
});

test("filter options and trigger do not display numeric counts", () => {
  const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  const filter = workspace.slice(workspace.indexOf("function FilterMenu("), workspace.indexOf("function ReferenceCard("));
  assert.doesNotMatch(filter, /\{category\.count\}|\$\{count\}/);
  assert.match(filter, /\{category\.label\}/);
  assert.match(filter, /activeCategories\.includes\(category\.id\)/);
});

test("the gallery does not show available video or slideshow totals", () => {
  const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /<span>\{filtered\.length\}/);
  assert.doesNotMatch(workspace, /format === "slideshow" \? "slideshows" : "videos"/);
  assert.match(workspace, /selectedCategories\.length > 0 \? <div/);
  assert.match(workspace, /queryKey: \["recreate-references", 3,/);
});

test("the slideshow-first gallery mixes filtered cards without changing video order or selection", () => {
  const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /useState<RecreateFormat>\("slideshow"\)/);
  assert.match(workspace, /initialGenerationMode = "images"/);
  assert.match(workspace, /useState<"images" \| "videos">\(initialGenerationMode\)/);
  assert.match(workspace, /filterReferences\(references, format, selectedCategories\)/);
  assert.match(workspace, /format === "slideshow" \? interleaveReferenceCategories\(matching\) : matching/);
  assert.match(workspace, /key=\{reference\.id\}/);
  assert.doesNotMatch(workspace, /Math\.random\(\)|\.sort\(\(\) =>/);
});
