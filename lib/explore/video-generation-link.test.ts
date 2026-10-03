import assert from "node:assert/strict";
import test from "node:test";
import { getExploreVideoGenerationLink } from "./video-generation-link.ts";

test("Hook and Wall of Text recreation retain the chosen model and reference context", () => {
  for (const type of ["hook", "wall_text"] as const) {
    const url = new URL(getExploreVideoGenerationLink({
      id: "reference-123", type, model: "seedance_2_5", sourceUrl: "https://storage.example.com/source.mp4?signature=a&token=b",
    }), "https://getugcpilot.com");
    assert.equal(url.pathname, "/ai-studio");
    assert.equal(url.searchParams.get("mode"), "videos");
    assert.equal(url.searchParams.get("model"), "seedance_2_5");
    assert.equal(url.searchParams.get("refId"), "reference-123");
    assert.equal(url.searchParams.get("refType"), type);
    assert.equal(url.searchParams.get("exploreRecreate"), "1");
    assert.equal(url.searchParams.get("sourceUrl"), "https://storage.example.com/source.mp4?signature=a&token=b");
  }
});
