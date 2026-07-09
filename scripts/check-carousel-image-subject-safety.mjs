import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": workspaceRoot } });
const { classifyCarouselImageSubject, isSafeCarouselImageSubject } =
  await jiti.import("../lib/carousel/image-subject-safety.ts");

const clearFace = classifyCarouselImageSubject({
  faces: [
    {
      BoundingBox: { Height: 0.25, Width: 0.2 },
      Confidence: 99,
      FaceOccluded: { Confidence: 99, Value: false },
    },
  ],
  labels: [{ Confidence: 99, Instances: [{}], Name: "Person" }],
});
assert.equal(clearFace.imageSubjectClass, "clear-face");
assert.equal(isSafeCarouselImageSubject(clearFace.imageSubjectClass), false);

const handsOnly = classifyCarouselImageSubject({
  labels: [{ Confidence: 98, Instances: [{}], Name: "Person" }],
});
assert.equal(handsOnly.imageSubjectClass, "faceless-human");
assert.equal(isSafeCarouselImageSubject(handsOnly.imageSubjectClass), false);

const distantFace = classifyCarouselImageSubject({
  faces: [
    {
      BoundingBox: { Height: 0.05, Width: 0.04 },
      Confidence: 98,
      FaceOccluded: { Confidence: 98, Value: false },
    },
  ],
  labels: [{ Confidence: 98, Instances: [{}], Name: "Person" }],
});
assert.equal(distantFace.imageSubjectClass, "faceless-human");
assert.equal(isSafeCarouselImageSubject(distantFace.imageSubjectClass), false);

const objects = classifyCarouselImageSubject({
  labels: [{ Confidence: 99, Instances: [{}], Name: "Laptop" }],
});
assert.equal(objects.imageSubjectClass, "object-only");
assert.equal(objects.hasHuman, false);

const occludedFace = classifyCarouselImageSubject({
  faces: [
    {
      BoundingBox: { Height: 0.3, Width: 0.2 },
      Confidence: 99,
      FaceOccluded: { Confidence: 99, Value: true },
    },
  ],
  labels: [{ Confidence: 99, Instances: [{}], Name: "Person" }],
});
assert.equal(occludedFace.imageSubjectClass, "faceless-human");
assert.equal(isSafeCarouselImageSubject(occludedFace.imageSubjectClass), false);

console.log("Carousel image subject safety checks passed: 5/5.");
