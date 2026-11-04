import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import viewsRegistry from "../lib/explore/hook-reference-views.json" with { type: "json" };
import { getHookReferenceViews } from "../lib/explore/hook-reference-views.ts";

test("views registry contains only live-verified hook references with legitimate platform metrics", () => {
  assert.equal(viewsRegistry.items.length, 74);
  for (const item of viewsRegistry.items) {
    assert.ok(typeof item.id === "string" && item.id.startsWith("explore-paired-hook-"));
    assert.ok(typeof item.title === "string" && item.title.length > 0);
    assert.ok(typeof item.sourceUrl === "string" && item.sourceUrl.length > 0);
    assert.equal(item.status, "verified_live");
    assert.ok(typeof item.viewCount === "number" && item.viewCount > 0);
    assert.match(item.formattedViews, /^[0-9]+(?:\.[0-9]+)?[KM]?$/);
  }
});

test("references with NO link do not have view counts (zero hallucinated views)", () => {
  // Hook 46 has no external link
  const hook46 = getHookReferenceViews("explore-paired-hook-4aa27111a23b04a6dd27717b");
  assert.equal(hook46, undefined);

  // Hook 47 has no external link
  const hook47 = getHookReferenceViews("explore-paired-hook-892b0f65083c8cf03270a7c9");
  assert.equal(hook47, undefined);

  // Hook 56 has no external link
  const hook56 = getHookReferenceViews("explore-paired-hook-725d926d66f44993f3556ee1");
  assert.equal(hook56, undefined);
});

test("getHookReferenceViews retrieves exact live real-time views for verified videos", () => {
  // Hook 100 (Instagram Reel DeacvdqpkvR)
  const hook100 = getHookReferenceViews("explore-paired-hook-fc44f6214b6e17413600ec13");
  assert.ok(hook100);
  assert.equal(hook100.verifiedLive, true);
  assert.equal(hook100.formattedViews, "65K");

  // Hook 101 (Instagram Reel DeQwSJTxiza)
  const hook101 = getHookReferenceViews("explore-paired-hook-ddcfb2950d40f37771058b73");
  assert.ok(hook101);
  assert.equal(hook101.verifiedLive, true);
  assert.equal(hook101.formattedViews, "20K");

  // Hook 103 (TikTok video 7695178280676134175)
  const hook103 = getHookReferenceViews("explore-paired-hook-20d3e0c0a3051477008bd86b");
  assert.ok(hook103);
  assert.equal(hook103.verifiedLive, true);
  assert.equal(hook103.formattedViews, "3M");
});

test("ReferenceCard component renders data-reference-views badge and EyeIcon ONLY when formattedViews exists", () => {
  const workspaceSource = fs.readFileSync(path.resolve("components/explore/recreate-workspace.tsx"), "utf8");
  assert.match(workspaceSource, /reference\.formattedViews\s*\?\s*<span data-reference-views/);
  assert.match(workspaceSource, /studio\.referenceViewsBadge/);
  assert.match(workspaceSource, /EyeIcon/);
  assert.match(workspaceSource, /reference\.formattedViews/);

  const cssSource = fs.readFileSync(path.resolve("components/explore/workflow-studio.module.css"), "utf8");
  assert.match(cssSource, /\.referenceViewsBadge\s*\{/);
  assert.match(cssSource, /top:\s*12px/);
  assert.match(cssSource, /right:\s*12px/);
});
