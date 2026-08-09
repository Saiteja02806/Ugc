import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);
const carouselLibrary = readProjectFile(
  "components/library/library-workspace.tsx",
);
const editLibrary = readProjectFile("lib/edit/video-library.ts");
const editE2ESeed = readProjectFile(
  "components/e2e/edit-render-e2e-seed.tsx",
);
const queryProvider = readProjectFile(
  "components/providers/job-query-provider.tsx",
);
const rootLayout = readProjectFile("app/layout.tsx");

test("owner-created content has no global browser-storage fallback", () => {
  assert.doesNotMatch(carouselLibrary, /local-library|localStorage|storageSource/);
  assert.doesNotMatch(editLibrary, /localStorage|editable-videos/);
  assert.doesNotMatch(editE2ESeed, /editable-videos/);
  assert.equal(existsSync(new URL("lib/carousel/local-library.ts", projectRoot)), false);
  assert.equal(
    existsSync(new URL("lib/scheduling/local-storage.ts", projectRoot)),
    false,
  );
});

test("retired global content is deleted without being imported into an account", () => {
  assert.match(rootLayout, /ugc-studio\.carousel-library\.v1/);
  assert.match(rootLayout, /ugc-studio\.schedule-drafts\.v1/);
  assert.match(rootLayout, /ugc-studio\.editable-videos\.v1/);
  assert.match(rootLayout, /window\.localStorage\.removeItem\(key\)/);
  assert.doesNotMatch(rootLayout, /window\.localStorage\.getItem\(key\)/);
  assert.match(rootLayout, /strategy="beforeInteractive"/);
});

test("changing Firebase users creates a fresh application cache and subtree", () => {
  assert.match(queryProvider, /const \{ user \} = useAuth\(\)/);
  assert.match(
    queryProvider,
    /<AccountQueryClientProvider key=\{user\?\.uid \?\? "signed-out"\}>/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(relativePath, projectRoot), "utf8");
}
