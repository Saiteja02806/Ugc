import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  classifyCarouselRoleSourcePath,
  selectExactDuplicateWinners,
  summarizeCarouselRoleAssets,
} from "./carousel-role-library.mjs";

const sourceRoot = path.resolve("C:/carousel-source");

test("top-level role bucket is authoritative over nested folder names", () => {
  const classified = classifyCarouselRoleSourcePath(
    sourceRoot,
    path.join(sourceRoot, "travel_hook", "human_1", "asset.jpg"),
  );

  assert.equal(classified.status, "included");
  assert.equal(classified.category, "travel");
  assert.equal(classified.role, "hook");
});

test("not been is treated as a staging wrapper and numbered folders normalize", () => {
  const classified = classifyCarouselRoleSourcePath(
    sourceRoot,
    path.join(sourceRoot, "not been", "travel_static (3)", "asset.png"),
  );

  assert.equal(classified.status, "included");
  assert.equal(classified.category, "travel");
  assert.equal(classified.role, "static");
  assert.equal(classified.sourceBatch, "not been");
});

test("part folders preserve their batch while role-bucket version suffixes normalize", () => {
  for (const [folder, category, role] of [
    ["dating_human_2", "dating", "human"],
    ["food_static_2.1", "food", "static"],
    ["food_static_2.2", "food", "static"],
    ["productivity_static_2", "productivity", "static"],
  ]) {
    const classified = classifyCarouselRoleSourcePath(
      sourceRoot,
      path.join(sourceRoot, "part-2", folder, "asset.jpg"),
    );

    assert.equal(classified.status, "included");
    assert.equal(classified.category, category);
    assert.equal(classified.role, role);
    assert.equal(classified.sourceBatch, "part-2");
  }
});

test("folder aliases normalize and marketing_static is excluded", () => {
  assert.equal(
    classifyCarouselRoleSourcePath(
      sourceRoot,
      path.join(sourceRoot, "productivity-human", "asset.jpg"),
    ).role,
    "human",
  );
  assert.equal(
    classifyCarouselRoleSourcePath(
      sourceRoot,
      path.join(sourceRoot, "skin__hook", "asset.jpg"),
    ).role,
    "hook",
  );
  assert.equal(
    classifyCarouselRoleSourcePath(
      sourceRoot,
      path.join(sourceRoot, "not been", "marketing_static", "asset.jpg"),
    ).reason,
    "marketing-static-excluded-v1",
  );
});

test("global exact duplicates keep hook before human before static", () => {
  const sharedHash = "a".repeat(64);
  const selected = selectExactDuplicateWinners([
    {
      category: "gym",
      relativePath: "gym_static/a.jpg",
      role: "static",
      sourceBatch: "power",
      sourceFileSha256: sharedHash,
    },
    {
      category: "gym",
      relativePath: "gym_human/a.jpg",
      role: "human",
      sourceBatch: "power",
      sourceFileSha256: sharedHash,
    },
    {
      category: "gym",
      relativePath: "gym_hook/human/a.jpg",
      role: "hook",
      sourceBatch: "power",
      sourceFileSha256: sharedHash,
    },
  ]);

  assert.equal(selected.winners.length, 1);
  assert.equal(selected.winners[0].role, "hook");
  assert.equal(selected.duplicateGroups[0].dropped.length, 2);
});

test("summary keeps independent category and role counts", () => {
  const summary = summarizeCarouselRoleAssets([
    { category: "gym", role: "hook" },
    { category: "gym", role: "human" },
    { category: "gym", role: "human" },
    { category: "gym", role: "static" },
    { category: "gym", role: "static" },
  ]);

  assert.deepEqual(summary.byCategoryRole.gym, {
    hook: 1,
    human: 2,
    static: 2,
  });
});

test("migration reserves exactly one hook, two human, and two non-human slots", () => {
  const migration = readFileSync(
    path.resolve(
      "supabase/migrations/20260817123000_add_carousel_role_image_library_v1.sql",
    ),
    "utf8",
  );

  assert.match(
    migration,
    /array\['hook', 'human', 'static', 'human', 'static'\]::text\[\]/,
  );
  assert.match(
    migration,
    /array\['hook', 'static', 'human', 'static', 'human'\]::text\[\]/,
  );
  assert.match(migration, /carousel_image_rotation_pools/);
  assert.match(migration, /for update/);
  assert.match(migration, /usage_type = 'assigned'/);
});
