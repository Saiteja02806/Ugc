import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  CAROUSEL_HYPER_HOOK_ASSETS,
  getCarouselHyperHookAssetById,
  getCarouselHyperHookAssetUrl,
} from "./hyper-hook-library.ts";

const route = readProjectFile("app/api/trending/carousel-hyper-hooks/route.ts");
const editor = readProjectFile(
  "components/trending/trending-creative-editor.tsx",
);
const editService = readProjectFile("lib/trending/creative-edit-service.ts");
const appGenerator = readProjectFile("lib/carousel/generate-carousel.ts");
const workerGenerator = readProjectFile(
  "worker/src/lib/carousel-generate.ts",
);
const structure2Generator = readProjectFile(
  "worker/src/lib/carousel-structure-2-generate.ts",
);

test("ships the complete reviewed Hyper Hook collection with stable identities", () => {
  assert.equal(CAROUSEL_HYPER_HOOK_ASSETS.length, 15);
  assert.equal(
    new Set(CAROUSEL_HYPER_HOOK_ASSETS.map((asset) => asset.id)).size,
    CAROUSEL_HYPER_HOOK_ASSETS.length,
  );
  assert.equal(
    new Set(CAROUSEL_HYPER_HOOK_ASSETS.map((asset) => asset.publicPath)).size,
    CAROUSEL_HYPER_HOOK_ASSETS.length,
  );

  for (const asset of CAROUSEL_HYPER_HOOK_ASSETS) {
    assert.match(
      asset.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    const filePath = path.join(process.cwd(), "public", asset.publicPath);
    assert.equal(existsSync(filePath), true, `Missing ${asset.publicPath}`);
    assert.equal(
      createHash("sha256").update(readFileSync(filePath)).digest("hex"),
      asset.sha256,
      `Changed source bytes for ${asset.publicPath}`,
    );
    assert.equal(getCarouselHyperHookAssetById(asset.id)?.id, asset.id);
  }
});

test("resolves Hyper Hook URLs against the authenticated app origin", () => {
  assert.equal(
    getCarouselHyperHookAssetUrl(
      CAROUSEL_HYPER_HOOK_ASSETS[0]!,
      "https://preview.example.com",
    ),
    "https://preview.example.com/carousel/hyper-hooks/hyper-hook-01.jpg",
  );
});

test("keeps the global folder authenticated and read-only", () => {
  assert.match(route, /export async function GET[\s\S]*requireFirebaseUser/);
  assert.match(route, /Cache-Control[\s\S]*private, no-store/);
  assert.doesNotMatch(route, /export async function (?:POST|PATCH|DELETE)/);
});

test("shows a folder picker and applies its selection to Slide 1 only", () => {
  assert.match(editor, /function HyperHookLibrarySection/);
  assert.match(editor, /Hook library/);
  assert.match(editor, /Slide 1 only/);
  assert.match(editor, /setActiveSlideIndex\(0\)/);
  assert.match(
    editor,
    /index === 0[\s\S]*backgroundAssetId: asset\.id[\s\S]*visualRole: "hook"/,
  );
});

test("server ignores client URLs and authorizes Hyper Hooks only on Slide 1", () => {
  assert.match(editService, /getCarouselHyperHookAssetById/);
  assert.match(editService, /getCarouselHyperHookAssetUrl\(hyperHookAsset\)/);
  assert.match(editService, /slide\.slideNumber !== 1/);
  assert.match(
    editService,
    /Hyper Hooks can replace only the Slide 1 background/,
  );
});

test("does not add the editor-only folder to automatic Carousel rotation", () => {
  for (const generator of [
    appGenerator,
    workerGenerator,
    structure2Generator,
  ]) {
    assert.doesNotMatch(generator, /hyper[-_ ]hook/iu);
  }
});

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}
