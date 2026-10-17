import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { prepareInstagramCarouselImages, prepareTikTokCarouselImages } from "./social-carousel-media.js";

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

test("prepares mixed PNG/JPEG/WebP TikTok slides in order without modifying originals", async () => {
  const sources = await Promise.all(["png", "jpeg", "webp"].map(format => sharp({
    create: { background: { r: 30, g: 80, b: 140, alpha: 0.5 }, channels: 4, width: 24, height: 32 },
  }).toFormat(format as "png" | "jpeg" | "webp").toBuffer()));
  const originals = sources.map(source => Buffer.from(source));
  const uploads: Array<{ buffer: Buffer; contentType: string; key: string }> = [];
  const params = { imageUrls: ["https://cdn.example/1.png", "https://cdn.example/2.jpg", "https://cdn.example/3.webp"], libraryItemId: "saved-slideshow" };
  const dependencies = {
    fetchImpl: (async (url: string | URL | Request) => new Response(Uint8Array.from(sources[params.imageUrls.indexOf(String(url))]!).buffer)) as typeof fetch,
    upload: async (upload: typeof uploads[number]) => {
      uploads.push(upload);
      return { key: upload.key, url: `https://cdn.example/${upload.key}` };
    },
  };
  const urls = await prepareTikTokCarouselImages(params, dependencies);
  const repeat = await prepareTikTokCarouselImages(params, dependencies);
  assert.deepEqual(repeat, urls);
  assert.deepEqual(sources, originals);
  assert.deepEqual(params.imageUrls, ["https://cdn.example/1.png", "https://cdn.example/2.jpg", "https://cdn.example/3.webp"]);
  for (let i = 0; i < 3; i++) {
    const upload = uploads[i]!;
    assert.equal(upload.contentType, "image/jpeg");
    assert.match(upload.key, new RegExp(`^social-publish/tiktok/carousels/saved-slideshow/slide-0${i + 1}-[a-f0-9]{16}\\.jpg$`));
    const meta = await sharp(upload.buffer).metadata();
    assert.equal(meta.format, "jpeg"); assert.equal(meta.hasAlpha, false);
    assert.equal(meta.width, 24); assert.equal(meta.height, 32);
  }
});

test("TikTok preparation flattens transparency and fits large images without cropping", async () => {
  const source = await sharp({ create: { width: 2160, height: 2880, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  let output: Buffer | undefined;
  await prepareTikTokCarouselImages({ imageUrls: ["https://cdn.example/source.png"], libraryItemId: "item" }, {
    fetchImpl: async () => new Response(Uint8Array.from(source).buffer),
    upload: async params => { output = params.buffer; return { key: params.key, url: "https://cdn.example/copy.jpg" }; },
  });
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1080); assert.equal(info.height, 1440);
  assert.ok(data[0]! > 250 && data[1]! > 250 && data[2]! > 250);
});

test("failed downloads and invalid image bytes do not upload a TikTok publishing copy", async () => {
  for (const response of [new Response("missing", { status: 404 }), new Response("not an image"), new Response("large", { headers: { "content-length": String(26 * 1024 * 1024) } })]) {
    let uploads = 0;
    await assert.rejects(prepareTikTokCarouselImages({ imageUrls: ["https://cdn.example/bad.png"], libraryItemId: "item" }, {
      fetchImpl: async () => response,
      upload: async params => { uploads++; return { key: params.key, url: "unexpected" }; },
    }));
    assert.equal(uploads, 0);
  }
});
