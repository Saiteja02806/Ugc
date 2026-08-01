import { createHash } from "node:crypto";

import sharp from "sharp";

import { uploadBufferToStorage } from "./storage.js";

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const SOURCE_IMAGE_TIMEOUT_MS = 30_000;

type PrepareInstagramCarouselImagesDependencies = {
  fetchImpl?: typeof fetch;
  upload?: typeof uploadBufferToStorage;
};

export async function prepareInstagramCarouselImages(
  params: {
    imageUrls: string[];
    libraryItemId: string;
  },
  dependencies: PrepareInstagramCarouselImagesDependencies = {},
) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const upload = dependencies.upload ?? uploadBufferToStorage;
  const preparedUrls: string[] = [];

  for (const [index, imageUrl] of params.imageUrls.entries()) {
    const response = await fetchImpl(imageUrl, {
      signal: AbortSignal.timeout(SOURCE_IMAGE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Could not download carousel slide ${index + 1} for Instagram (${response.status}).`,
      );
    }

    const declaredLength = Number(response.headers.get("content-length"));

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_SOURCE_IMAGE_BYTES
    ) {
      throw new Error(
        `Carousel slide ${index + 1} is too large to prepare for Instagram.`,
      );
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());

    if (sourceBuffer.byteLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error(
        `Carousel slide ${index + 1} is too large to prepare for Instagram.`,
      );
    }

    const jpegBuffer = await sharp(sourceBuffer, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .flatten({ background: "#ffffff" })
      .jpeg({ chromaSubsampling: "4:4:4", quality: 92 })
      .toBuffer();
    const sourceHash = createHash("sha256")
      .update(jpegBuffer)
      .digest("hex")
      .slice(0, 16);
    const uploaded = await upload({
      buffer: jpegBuffer,
      contentType: "image/jpeg",
      key: [
        "social-publish",
        "instagram",
        "carousels",
        params.libraryItemId,
        `slide-${String(index + 1).padStart(2, "0")}-${sourceHash}.jpg`,
      ].join("/"),
    });

    preparedUrls.push(uploaded.url);
  }

  return preparedUrls;
}
