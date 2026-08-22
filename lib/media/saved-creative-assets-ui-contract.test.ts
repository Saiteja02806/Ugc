import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const avatarsPage = readProjectFile("app/avatars/page.tsx");
const libraryPage = readProjectFile("app/library/page.tsx");
const workspace = readProjectFile(
  "components/avatars/avatars-workspace.tsx",
);
const savedTab = readProjectFile(
  "components/avatars/saved-creative-assets-tab.tsx",
);
const carouselLibrary = readProjectFile(
  "components/library/library-workspace.tsx",
);
const demosWorkspace = readProjectFile(
  "components/demos/demos-workspace.tsx",
);
const hookLibrary = readProjectFile(
  "components/library/hook-video-library-tab.tsx",
);
const wallLibrary = readProjectFile(
  "components/library/wall-text-library-tab.tsx",
);
const trendingWorkspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const hookComposer = readProjectFile(
  "components/trending/hook-video-composer.tsx",
);

test("Creative Assets exposes a durable Saved route and tab", () => {
  assert.match(avatarsPage, /tab === "saved"/);
  assert.match(workspace, /"videos" \| "images" \| "saved"/);
  assert.match(workspace, /id: "saved", label: "Saved"/);
  assert.match(workspace, /<SavedCreativeAssetsTab \/>/);
});

test("Saved includes every reviewed Trending format", () => {
  assert.match(savedTab, /<HookVideoLibraryTab embedded \/>/);
  assert.match(savedTab, /<WallTextLibraryTab embedded \/>/);
  assert.match(savedTab, /<CarouselLibraryTab embedded \/>/);
  assert.match(savedTab, /Hook videos/);
  assert.match(savedTab, /Wall-of-Text/);
  assert.match(savedTab, /Carousels/);
});

test("Saved content renders through a flat embedded presentation", () => {
  assert.doesNotMatch(savedTab, /Every reviewed creative you save/);
  assert.match(savedTab, /id="saved-creative-assets-heading" className="sr-only"/);
  assert.match(hookLibrary, /embedded = false/);
  assert.match(wallLibrary, /embedded = false/);
  assert.match(carouselLibrary, /embedded = false/);
  assert.match(hookLibrary, /!embedded && "overflow-hidden rounded-panel/);
  assert.match(wallLibrary, /!embedded && "overflow-hidden rounded-panel/);
  assert.match(carouselLibrary, /!embedded && "overflow-hidden rounded-panel/);
});

test("Saved category controls stay readable on narrow screens", () => {
  assert.match(savedTab, /grid-cols-2/);
  assert.match(savedTab, /sm:flex/);
  assert.match(savedTab, /w-full justify-start/);
});

test("saved carousel cards use a compact grid without thumbnail letterboxing", () => {
  const cardSource = carouselLibrary.slice(
    carouselLibrary.indexOf("function LibraryCarouselCard"),
    carouselLibrary.indexOf("function LibraryCarouselViewer"),
  );

  assert.match(
    carouselLibrary,
    /grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5/,
  );
  assert.doesNotMatch(cardSource, /max-h-\[440px\]/);
  assert.match(cardSource, /size-full object-cover/);
  assert.doesNotMatch(cardSource, /object-contain/);
  assert.match(cardSource, /onClick=\{onView\}/);
  assert.match(cardSource, /onClick=\{onSchedule\}/);
  assert.match(cardSource, />\s*Preview\s*</);
  assert.match(cardSource, />\s*Schedule\s*</);
});

test("Content Library is dedicated to compact demo footage", () => {
  assert.match(carouselLibrary, /<UploadedPostsTab embeddedInLibrary \/>/);
  assert.doesNotMatch(carouselLibrary, /aria-label="Library sections"/);
  assert.doesNotMatch(libraryPage, /tab === "content"/);
  assert.match(
    demosWorkspace,
    /"grid min-h-\[220px\] items-center gap-5 rounded-panel border border-dashed px-4 py-5/,
  );
  assert.doesNotMatch(demosWorkspace, /min-h-\[330px\]/);
});

test("the Saved tab reuses owner-scoped existing stores", () => {
  assert.match(carouselLibrary, /\/api\/library\?type=carousel/);
  assert.match(hookLibrary, /\/api\/trending\/hook-videos\/drafts/);
  assert.match(wallLibrary, /\/api\/trending\/wall-text\/drafts/);
});

test("saved content waits for Firebase to restore the signed-in user", () => {
  const authSource = readProjectFile("lib/firebase/auth.ts");

  assert.match(
    authSource,
    /export async function getCurrentUserIdToken\(\)[\s\S]*await auth\.authStateReady\(\)/,
  );
});

test("Trending save confirmations point to Creative Assets", () => {
  assert.equal(
    countMatches(trendingWorkspace, /actionHref: "\/avatars\?tab=saved"/g),
    2,
  );
  assert.match(hookComposer, /href="\/avatars\?tab=saved"/);
  assert.doesNotMatch(trendingWorkspace, /actionHref: "\/library\?tab=/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}

function countMatches(source: string, pattern: RegExp) {
  return Array.from(source.matchAll(pattern)).length;
}
