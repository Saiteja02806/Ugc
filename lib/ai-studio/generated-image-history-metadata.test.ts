import assert from "node:assert/strict";
import { test } from "node:test";
import { getGeneratedImageHistoryMetadata } from "./generated-image-history-metadata.ts";
import { getAIStudioImageResults } from "./media-results.ts";
import type { MediaAsset } from "../media/types.ts";
test("legacy metadata with no prompt recovers the exact saved job prompt and model", () => {
  const prompt = 'Keep the laptop.\nPlace the actual uploaded screenshot. "Do not redesign".';
  const metadata = getGeneratedImageHistoryMetadata({ prompt, model: "gpt_image_2_5_flare" });
  const asset: MediaAsset = { id: "asset", collection: "image", sourceType: "generated_image", status: "ready", url: "https://example.test/image.png", metadata: { backgroundJobId: "job", ...metadata }, createdAt: "", updatedAt: "", title: "Image", sourceRecordId: "job", parentAssetId: null, projectId: null, fileName: null, fileSizeBytes: null, mimeType: "image/png", thumbnailUrl: null, durationSeconds: null, width: 1024, height: 1280, ratio: "4:5" };
  assert.equal(getAIStudioImageResults([asset])[0].prompt, prompt);
  assert.equal(metadata.model, "gpt_image_2_5_flare");
  assert.deepEqual(getGeneratedImageHistoryMetadata(null), {});
  assert.deepEqual(getGeneratedImageHistoryMetadata({ prompt: " ", model: 55 }), {});
});
