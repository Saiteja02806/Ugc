import { createHash } from "node:crypto";

import sharp from "sharp";

import { uploadBufferToStorage } from "./storage.js";

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const SOURCE_IMAGE_TIMEOUT_MS = 30_000;

type PrepareCarouselImagesDependencies = {
  fetchImpl?: typeof fetch;
  upload?: typeof uploadBufferToStorage;
};

export async function prepareInstagramCarouselImages(
  params: {
    imageUrls: string[];
    libraryItemId: string;
  },
  dependencies: PrepareCarouselImagesDependencies = {},
) {
  return prepareCarouselImages({ ...params, platform: "instagram" }, dependencies);
}

export async function prepareTikTokCarouselImages(
  params: { imageUrls: string[]; libraryItemId: string },
  dependencies: PrepareCarouselImagesDependencies = {},
) {
  return prepareCarouselImages({ ...params, platform: "tiktok" }, dependencies);
}

async function prepareCarouselImages(
  params: {
    imageUrls: string[];
    libraryItemId: string;
    platform: "instagram" | "tiktok";
  },
  dependencies: PrepareCarouselImagesDependencies,
) {
  const platformName = params.platform === "tiktok" ? "TikTok" : "Instagram";
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const upload = dependencies.upload ?? uploadBufferToStorage;
  const preparedUrls: string[] = [];

  for (const [index, imageUrl] of params.imageUrls.entries()) {
    const response = await fetchImpl(imageUrl, {
      signal: AbortSignal.timeout(SOURCE_IMAGE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Could not download carousel slide ${index + 1} for ${platformName} (${response.status}).`,
      );
    }

    const declaredLength = Number(response.headers.get("content-length"));

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_SOURCE_IMAGE_BYTES
    ) {
      throw new Error(
        `Carousel slide ${index + 1} is too large to prepare for ${platformName}.`,
      );
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());

    if (sourceBuffer.byteLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error(
        `Carousel slide ${index + 1} is too large to prepare for ${platformName}.`,
      );
    }

    const image = sharp(sourceBuffer, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .flatten({ background: "#ffffff" });

    if (params.platform === "tiktok") {
      const metadata = await image.metadata();
      const sideways = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
      const width = sideways ? metadata.height : metadata.width;
      const height = sideways ? metadata.width : metadata.height;
      const landscape = (width ?? 0) > (height ?? 0);
      image.resize({
        width: landscape ? 1920 : 1080,
        height: landscape ? 1080 : 1920,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Publish derivatives only. Never replace the owner's source or saved slides.
    const jpegBuffer = await image
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
        params.platform,
        "carousels",
        params.libraryItemId,
        `slide-${String(index + 1).padStart(2, "0")}-${sourceHash}.jpg`,
      ].join("/"),
    });

    preparedUrls.push(uploaded.url);
  }

  return preparedUrls;
}
