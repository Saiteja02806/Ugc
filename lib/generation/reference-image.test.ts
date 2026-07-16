import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REFERENCE_IMAGE_BYTES,
  formatReferenceImageBytes,
  getReferenceImageDimensionsError,
  getReferenceImageFileError,
} from "./reference-image.ts";

test("accepts supported reference image formats", () => {
  assert.equal(
    getReferenceImageFileError({
      name: "reference.JPEG",
      size: 1_024,
      type: "image/jpeg",
    }),
    null,
  );
  assert.equal(
    getReferenceImageFileError({
      name: "reference.webp",
      size: 2_048,
      type: "",
    }),
    null,
  );
});

test("rejects empty, oversized, and unsupported reference images", () => {
  assert.equal(
    getReferenceImageFileError({ name: "empty.png", size: 0, type: "image/png" }),
    "Choose a non-empty image file.",
  );
  assert.equal(
    getReferenceImageFileError({
      name: "large.png",
      size: MAX_REFERENCE_IMAGE_BYTES + 1,
      type: "image/png",
    }),
    "Choose an image smaller than 25 MB.",
  );
  assert.equal(
    getReferenceImageFileError({ name: "clip.gif", size: 50, type: "image/gif" }),
    "Choose a JPG, PNG, or WebP image.",
  );
  assert.equal(
    getReferenceImageFileError({ name: "vector.svg", size: 50, type: "image/png" }),
    "Choose a JPG, PNG, or WebP image.",
  );
});

test("rejects invalid or excessively large decoded dimensions", () => {
  assert.equal(
    getReferenceImageDimensionsError(0, 1_080),
    "This image has invalid dimensions.",
  );
  assert.equal(
    getReferenceImageDimensionsError(10_000, 10_000),
    "Choose an image no larger than 16,384 px per side or 64 megapixels.",
  );
  assert.equal(
    getReferenceImageDimensionsError(16_385, 1),
    "Choose an image no larger than 16,384 px per side or 64 megapixels.",
  );
  assert.equal(getReferenceImageDimensionsError(4_000, 3_000), null);
});

test("formats attachment sizes for compact metadata", () => {
  assert.equal(formatReferenceImageBytes(512), "512 B");
  assert.equal(formatReferenceImageBytes(2_048), "2 KB");
  assert.equal(formatReferenceImageBytes(1_572_864), "1.5 MB");
});
