import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import savedFixtures from "./starting-frame-legacy-stage-fixtures.json" with { type: "json" };
import { generateOpenRouterGeminiHookKeyframe } from "./openrouter-gemini-image.js";
import type { StartingFrameReferenceOptions } from "./starting-frame-reference-options.js";

test("accepted two/three-role jobs replay all actual historical scene, identity and harmonizer fingerprints", async () => {
  const fixtures = savedFixtures as {
    fixtures: { referenceOptions: StartingFrameReferenceOptions; prompt: string; stages: Record<string, string> }[];
  };
  assert.equal(fixtures.fixtures.length, 12);
  const buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const referenceImages = ["scene", "primary", "support"].map(data => ({ data: Buffer.from(data).toString("base64"), mimeType: "image/png" }));
  for (const fixture of fixtures.fixtures) {
    const seen: string[] = [];
    await generateOpenRouterGeminiHookKeyframe({ prompt: fixture.prompt, aspectRatio: "9:16", referenceImages,
      referenceOptions: fixture.referenceOptions, startingFrameTextCleanup: true, instructions: "Keep the selected expression.",
      fetchImpl: async () => { throw Error("Historical recovery fixture must not submit a provider request"); },
      runStage: async (stage, input) => {
        seen.push(stage);
        assert.equal(createHash("sha256").update(JSON.stringify(input)).digest("hex"), fixture.stages[stage],
          `${JSON.stringify(fixture.referenceOptions)}: saved ${stage} operation must match`);
        return { buffer, model: "fixture" };
      },
    });
    assert.deepEqual(seen, ["scene", "identity", "harmonize"]);
  }
});
