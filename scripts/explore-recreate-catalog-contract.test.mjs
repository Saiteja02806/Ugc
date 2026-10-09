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
  assert.equal(catalog.mediaStatus, "staged");
  assert.equal(slideshows.length, 49);
  assert.equal(wallTextVideos.length, 28);
  assert.equal(slideshows.reduce((total, item) => total + item.slides.length, 0), 272);
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
      fitness: 14,
      "goal-tracker": 3,
      habit: 2,
      "interior-design": 3,
      "interview-app": 3,
      marketing: 1,
      "note-taking": 1,
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
  assert.equal(catalog.items.length, 84);
  const additions = catalog.items.slice(66);
  assert.equal(additions.filter((item) => item.format === "slideshow").length, 11);
  const hooks = additions.filter((item) => item.format === "hook");
  assert.equal(hooks.length, 7);
  assert.equal(hooks.every((item) => item.category === null && item.categoryLabel === null && item.slides.length === 0 && item.durationSeconds > 0), true);
  assert.equal(new Set(hooks.map((item) => item.videoFile)).size, 7);
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

test("Explore has three separate format workflows with distinct supplied covers", () => {
  const workflows = readFileSync(new URL("../lib/explore/workflows.ts", import.meta.url), "utf8");
  const liveCatalogue = workflows.slice(workflows.indexOf("export const EXPLORE_WORKFLOWS"), workflows.indexOf("export const LOCAL_PREVIEW_WORKFLOWS"));
  for (const format of ["hook-video", "wall-of-text", "slideshows"]) {
    assert.ok(liveCatalogue.includes(`destination: "/explore/${format}"`));
    assert.ok(liveCatalogue.includes(`/explore/covers/${format}-v1.mp4`));
    assert.ok(liveCatalogue.includes(`/explore/covers/${format}-v1.webp`));
  }
  assert.doesNotMatch(liveCatalogue, /create-hook|creator-phone|\/explore\/recreate/);
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
  assert.doesNotMatch(card, /<p\b|categoryLabel|slides\.length/);
  assert.match(card, /aria-label=\{`Recreate \$\{reference\.title\}`\}/);
  const media = workspace.slice(workspace.indexOf("function ReferenceMedia("), workspace.indexOf("function ReferencePreviewDialog("));
  assert.equal((media.match(/reference\.slides\.length/g) ?? []).length, 1);
});

test("compact composer keeps settings available without stacking them above Generate", () => {
  const composer = readFileSync(new URL("../components/generation/ai-studio-composer.tsx", import.meta.url), "utf8");
  assert.match(composer, /compact = false/);
  assert.match(composer, /aria-label="Generation settings"/);
  assert.match(composer, /<PopoverContent side="top"[\s\S]*?\{settings\}/);
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
  assert.match(workspace, /queryKey: \["recreate-references", 2,/);
});

test("the slideshow-first gallery mixes filtered cards without changing video order or selection", () => {
  const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /useState<RecreateFormat>\("slideshow"\)/);
  assert.match(workspace, /useState<"images" \| "videos">\("images"\)/);
  assert.match(workspace, /filterReferences\(references, format, selectedCategories\)/);
  assert.match(workspace, /format === "slideshow" \? interleaveReferenceCategories\(matching\) : matching/);
  assert.match(workspace, /key=\{reference\.id\}/);
  assert.doesNotMatch(workspace, /Math\.random\(\)|\.sort\(\(\) =>/);
});
