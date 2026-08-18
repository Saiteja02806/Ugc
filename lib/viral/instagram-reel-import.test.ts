import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstagramOEmbedUrl,
  fetchInstagramOEmbed,
  normalizeInstagramReelUrl,
  parseInstagramReelInput,
  prepareInstagramReelImports,
  sanitizeInstagramEmbedHtml,
  ViralImportInputError,
} from "./instagram-reel-import.ts";

const SAFE_EMBED =
  '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/ABC_123/"><a href="https://www.instagram.com/reel/ABC_123/">View</a></blockquote><script async src="//www.instagram.com/embed.js"></script>';

test("normalizes direct Instagram Reel URLs and removes tracking parameters", () => {
  assert.deepEqual(
    normalizeInstagramReelUrl(
      "http://instagram.com/reel/ABC_123/?utm_source=test#fragment",
    ),
    {
      shortcode: "ABC_123",
      sourceUrl: "https://www.instagram.com/reel/ABC_123/",
    },
  );

  assert.deepEqual(normalizeInstagramReelUrl("instagram.com/reel/xyz-9/"), {
    shortcode: "xyz-9",
    sourceUrl: "https://www.instagram.com/reel/xyz-9/",
  });
});

test("rejects non-Reel, lookalike, credentialed, and malformed URLs", () => {
  const invalidUrls = [
    "https://www.instagram.com/p/ABC/",
    "https://www.instagram.com/tv/ABC/",
    "https://instagram.example/reel/ABC/",
    "https://instagram.com@example.com/reel/ABC/",
    "javascript:alert(1)",
    "https://www.instagram.com/reel/ABC/extra",
    "https://www.instagram.com/reel/%2e%2e/",
  ];

  for (const value of invalidUrls) {
    assert.throws(() => normalizeInstagramReelUrl(value), ViralImportInputError);
  }
});

test("parses comments, tracks duplicates, and preserves per-line rejections", () => {
  const result = parseInstagramReelInput(`
# Hook reference candidates
https://instagram.com/reel/AAA/?utm_source=share
https://www.instagram.com/reel/AAA/
https://example.com/reel/BBB/
https://www.instagram.com/reel/CCC/
`);

  assert.deepEqual(
    result.reels.map((reel) => reel.sourceUrl),
    [
      "https://www.instagram.com/reel/AAA/",
      "https://www.instagram.com/reel/CCC/",
    ],
  );
  assert.equal(result.duplicateInputs.length, 1);
  assert.equal(result.duplicateInputs[0].lineNumber, 4);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].lineNumber, 5);
});

test("enforces a bounded number of input URLs", () => {
  assert.throws(
    () =>
      parseInstagramReelInput(
        ["https://instagram.com/reel/A/", "https://instagram.com/reel/B/"].join(
          "\n",
        ),
        { maxItems: 1 },
      ),
    /safe limit is 1/,
  );
});

test("builds the official Meta oEmbed URL", () => {
  const endpoint = new URL(
    buildInstagramOEmbedUrl("https://www.instagram.com/reel/ABC/"),
  );
  assert.equal(endpoint.origin, "https://graph.facebook.com");
  assert.equal(endpoint.pathname, "/v25.0/instagram_oembed");
  assert.equal(
    endpoint.searchParams.get("url"),
    "https://www.instagram.com/reel/ABC/",
  );
});

test("removes Meta's SDK script and rejects dangerous embed markup", () => {
  assert.equal(
    sanitizeInstagramEmbedHtml(SAFE_EMBED),
    '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/ABC_123/"><a href="https://www.instagram.com/reel/ABC_123/">View</a></blockquote>',
  );

  assert.throws(
    () =>
      sanitizeInstagramEmbedHtml(
        '<blockquote class="instagram-media" onclick="steal()"></blockquote>',
      ),
    /forbidden markup/,
  );
  assert.throws(
    () => sanitizeInstagramEmbedHtml('<iframe class="instagram-media"></iframe>'),
    /blockquote embed/,
  );
});

test("accepts a valid Instagram response from Meta", async () => {
  const html = await fetchInstagramOEmbed(
    "https://www.instagram.com/reel/ABC_123/",
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            html: SAFE_EMBED,
            provider_name: "Instagram",
            provider_url: "https://www.instagram.com/",
            type: "rich",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
    },
  );

  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /instagram-media/);
});

test("rejects untrusted or unavailable Meta responses", async () => {
  await assert.rejects(
    fetchInstagramOEmbed("https://www.instagram.com/reel/ABC/", {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            html: SAFE_EMBED,
            provider_name: "Unexpected",
          }),
          { status: 200 },
        ),
    }),
    /unexpected provider/,
  );

  await assert.rejects(
    fetchInstagramOEmbed("https://www.instagram.com/reel/ABC/", {
      fetchImpl: async () => new Response(null, { status: 404 }),
    }),
    /public, embeddable Reel/,
  );
});

test("checks database duplicates before calling Meta and prepares pending rows", async () => {
  const parsed = parseInstagramReelInput(`
https://www.instagram.com/reel/EXISTING/
https://www.instagram.com/reel/NEW/
`);
  const calls: Array<string> = [];

  const result = await prepareInstagramReelImports(parsed.reels, {
    existingSourceUrls: new Set([
      "https://www.instagram.com/reel/EXISTING/",
    ]),
    fetchOEmbed: async (sourceUrl) => {
      calls.push(sourceUrl);
      return sanitizeInstagramEmbedHtml(SAFE_EMBED);
    },
    verifiedAt: "2026-08-12T10:00:00.000Z",
  });

  assert.deepEqual(calls, ["https://www.instagram.com/reel/NEW/"]);
  assert.deepEqual(result.duplicateDatabaseUrls, [
    "https://www.instagram.com/reel/EXISTING/",
  ]);
  assert.equal(result.prepared.length, 1);
  assert.deepEqual(result.prepared[0], {
    embed_html:
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/ABC_123/"><a href="https://www.instagram.com/reel/ABC_123/">View</a></blockquote>',
    embed_status: "active",
    last_verified_at: "2026-08-12T10:00:00.000Z",
    platform: "instagram",
    publish_status: "pending_review",
    section: "hook_video",
    source_url: "https://www.instagram.com/reel/NEW/",
  });
});
