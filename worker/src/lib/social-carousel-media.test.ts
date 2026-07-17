import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { prepareInstagramCarouselImages } from "./social-carousel-media.js";

test("normalizes Instagram carousel slides to deterministic JPEG assets", async () => {
  const source = await sharp({
    create: {
      background: { alpha: 0.5, b: 200, g: 100, r: 20 },
      channels: 4,
      height: 8,
      width: 8,
    },
  })
    .webp()
    .toBuffer();
  const uploads: Array<{
    buffer: Buffer;
    contentType: string;
    key: string;
  }> = [];

  const urls = await prepareInstagramCarouselImages(
    {
      imageUrls: ["https://cdn.example.com/slide-01.webp"],
      libraryItemId: "library-item-1",
    },
    {
      fetchImpl: async () =>
        new Response(Uint8Array.from(source).buffer, {
          headers: { "content-type": "image/webp" },
          status: 200,
        }),
      upload: async (params) => {
        uploads.push(params);
        return {
          key: params.key,
          url: `https://cdn.example.com/${params.key}`,
        };
      },
    },
  );

  assert.equal(uploads.length, 1);
  assert.equal(uploads[0]?.contentType, "image/jpeg");
  assert.match(
    uploads[0]?.key ?? "",
    /^social-publish\/instagram\/carousels\/library-item-1\/slide-01-[a-f0-9]{16}\.jpg$/,
  );
  assert.deepEqual(urls, [`https://cdn.example.com/${uploads[0]?.key}`]);

  const metadata = await sharp(uploads[0]?.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.hasAlpha, false);
});
