import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import dates from "./public-page-dates.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "../..");
const pagePaths = JSON.parse(fs.readFileSync(path.join(root, "lib/marketing/public-page-paths.json"), "utf8"));

test("every public URL has a committed calendar date", () => {
  const values = new Set();
  for (const pagePath of pagePaths) {
    assert.match(dates[pagePath] ?? "", /^\d{4}-\d{2}-\d{2}$/);
    values.add(dates[pagePath]);
  }
  assert.equal(Object.keys(dates).length, pagePaths.length);
  assert.ok(values.size > 1);
});

test("sitemap lastmod is read from those dates", () => {
  const source = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  assert.equal(source.includes("new Date()"), false);
  assert.match(source, /publicPageLastModified/);
  assert.equal(dates["/blog/clipugc-alternative"], "2026-11-24");
  assert.equal(dates["/blog/hook-video-maker"], "2026-11-23");
  assert.equal(dates["/tools/hook-generator"], "2026-11-24");
});
