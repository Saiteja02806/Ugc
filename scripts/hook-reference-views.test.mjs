import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import viewsRegistry from "../lib/explore/hook-reference-views.json" with { type: "json" };
import { getHookReferenceViews, getAllHookReferenceViews } from "../lib/explore/hook-reference-views.ts";

test("views registry contains all 106 hook references with valid counts and formats", () => {
  assert.equal(viewsRegistry.items.length, 106);
  for (const item of viewsRegistry.items) {
    assert.ok(typeof item.id === "string" && item.id.startsWith("explore-paired-hook-"));
    assert.ok(typeof item.title === "string" && item.title.length > 0);
    assert.ok(typeof item.viewCount === "number" && item.viewCount >= 100000);
    assert.match(item.formattedViews, /^[0-9]+(?:\.[0-9]+)?[KM]$/);
  }
});

test("getHookReferenceViews retrieves exact tagged views for top videos", () => {
  const hook100 = getHookReferenceViews("explore-paired-hook-fc44f6214b6e17413600ec13");
  assert.ok(hook100);
  assert.equal(hook100.formattedViews, "350K");

  const hook103 = getHookReferenceViews("explore-paired-hook-20d3e0c0a3051477008bd86b");
  assert.ok(hook103);
  assert.equal(hook103.formattedViews, "410K");

  const hook46 = getHookReferenceViews("explore-paired-hook-4aa27111a23b04a6dd27717b");
  assert.ok(hook46);
  assert.equal(hook46.formattedViews, "1.6M");

  const hook101 = getHookReferenceViews("explore-paired-hook-ddcfb2950d40f37771058b73");
  assert.ok(hook101);
  assert.equal(hook101.formattedViews, "340K");
});

test("ReferenceCard component renders data-reference-views badge and EyeIcon", () => {
  const workspaceSource = fs.readFileSync(path.resolve("components/explore/recreate-workspace.tsx"), "utf8");
  assert.match(workspaceSource, /data-reference-views/);
  assert.match(workspaceSource, /studio\.referenceViewsBadge/);
  assert.match(workspaceSource, /EyeIcon/);
  assert.match(workspaceSource, /reference\.formattedViews/);

  const cssSource = fs.readFileSync(path.resolve("components/explore/workflow-studio.module.css"), "utf8");
  assert.match(cssSource, /\.referenceViewsBadge\s*\{/);
  assert.match(cssSource, /top:\s*12px/);
  assert.match(cssSource, /right:\s*12px/);
});
