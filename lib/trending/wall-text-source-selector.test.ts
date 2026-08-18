import assert from "node:assert/strict";
import test from "node:test";

import {
  selectWallTextGenerationSources,
  WALL_TEXT_INSTAGRAM_TEMPLATE_SHARE,
} from "./wall-text-source-selector.ts";

test("shared Wall library uses the 30-to-15 source ratio", () => {
  const selected = selectWallTextGenerationSources({
    instagramTemplates: Array.from({ length: 15 }, (_, index) => `ig-${index}`),
    requestedCount: 12,
    ugcpilotCandidates: Array.from({ length: 30 }, (_, index) => `ugc-${index}`),
  });

  assert.equal(WALL_TEXT_INSTAGRAM_TEMPLATE_SHARE, 1 / 3);
  assert.equal(selected.length, 12);
  assert.equal(
    selected.filter((entry) => entry.kind === "instagram_reel").length,
    4,
  );
  assert.deepEqual(
    selected.map((entry) => entry.kind),
    [
      "ugcpilot",
      "ugcpilot",
      "instagram_reel",
      "ugcpilot",
      "ugcpilot",
      "instagram_reel",
      "ugcpilot",
      "ugcpilot",
      "instagram_reel",
      "ugcpilot",
      "ugcpilot",
      "instagram_reel",
    ],
  );
});

test("source selector fills missing Instagram slots from UGCpilot", () => {
  const selected = selectWallTextGenerationSources({
    instagramTemplates: ["ig-1"],
    requestedCount: 10,
    ugcpilotCandidates: Array.from({ length: 12 }, (_, index) => `ugc-${index}`),
  });

  assert.equal(selected.length, 10);
  assert.equal(
    selected.filter((entry) => entry.kind === "instagram_reel").length,
    1,
  );
});

test("source selector fills missing UGCpilot capacity from Instagram templates", () => {
  const selected = selectWallTextGenerationSources({
    instagramTemplates: Array.from({ length: 15 }, (_, index) => `ig-${index}`),
    requestedCount: 10,
    ugcpilotCandidates: ["ugc-1", "ugc-2"],
  });

  assert.equal(selected.length, 10);
  assert.equal(
    selected.filter((entry) => entry.kind === "ugcpilot").length,
    2,
  );
  assert.equal(
    selected.filter((entry) => entry.kind === "instagram_reel").length,
    8,
  );
});

test("source selector returns all available sources without repeating them", () => {
  const selected = selectWallTextGenerationSources({
    instagramTemplates: ["ig-1"],
    requestedCount: 10,
    ugcpilotCandidates: ["ugc-1", "ugc-2"],
  });

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((entry) => entry.value)).size, 3);
});
