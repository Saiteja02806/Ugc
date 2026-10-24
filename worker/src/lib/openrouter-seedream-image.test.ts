import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenRouterSeedreamImageRequest, generateOpenRouterSeedreamImage, OPENROUTER_SEEDREAM_IMAGE_MODEL } from "./openrouter-seedream-image.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";

const apiKey = "private-image-test-key";
const input = { prompt: "A candid adult creator in natural window light.", aspectRatio: "9:16" as const };
const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", ...headers },
});
const success = () => json({ data: [{ b64_json: image.toString("base64"), media_type: "image/png" }], usage: { cost: 0.045 } }, 200, { "x-request-id": "image-receipt" });

test("Seedream uses the image API contract, exact model and ordered references at 1K", () => {
  const refs = Array.from({ length: 10 }, (_, i) => `https://media.example.test/${i}.png`);
  for (const ratio of ["1:1", "4:5", "9:16", "16:9"] as const) {
    const request = buildOpenRouterSeedreamImageRequest({ ...input, prompt: ` ${"x".repeat(4_000)} `, aspectRatio: ratio, referenceImageUrls: refs });
    assert.equal(request.model, OPENROUTER_SEEDREAM_IMAGE_MODEL);
    assert.equal(request.prompt, "x".repeat(4_000));
    assert.equal(request.aspect_ratio, ratio);
    assert.equal(request.resolution, "1K");
    assert.equal(request.n, 1);
    assert.deepEqual(request.input_references, refs.map(url => ({ type: "image_url", image_url: { url } })));
  }
  assert.equal("input_references" in buildOpenRouterSeedreamImageRequest(input), false);
});

test("invalid references, prompt and ratio fail before network access", async () => {
  for (const patch of [{ prompt: " " }, { prompt: "x".repeat(4_001) }, { aspectRatio: "3:1" as "9:16" },
    { referenceImageUrl: "http://media.example.test/a.png" }, { referenceImageUrl: "https://user:secret@media.example.test/a.png" },
    { referenceImageUrls: ["https://media.example.test/a.png", "https://media.example.test/a.png"] },
    { referenceImageUrls: Array.from({ length: 11 }, (_, i) => `https://media.example.test/${i}.png`) },
    { referenceImageUrl: "https://media.example.test/a.png", referenceImageUrls: ["https://media.example.test/b.png"] }]) {
    await assert.rejects(generateOpenRouterSeedreamImage({ ...input, ...patch }, {
      apiKey, fetchImpl: async () => assert.fail("Must validate before network"),
    }), ProviderRequestNotSubmittedError);
  }
});

test("one paid request returns image bytes, receipt and cost without sending credentials to image URLs", async () => {
  const urls: string[] = [];
  const refs = ["https://media.example.test/person.png", "https://media.example.test/room.png"];
  const result = await generateOpenRouterSeedreamImage({ ...input, referenceImageUrls: refs }, { apiKey,
    fetchImpl: async (url, init) => {
      urls.push(String(url));
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
      if (String(url).endsWith("/key")) return json({ data: { is_management_key: false, limit_remaining: 1 } });
      assert.equal(String(url), "https://openrouter.ai/api/v1/images");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), buildOpenRouterSeedreamImageRequest({ ...input, referenceImageUrls: refs }));
      return success();
    },
  });
  assert.deepEqual(result, { buffer: image, model: OPENROUTER_SEEDREAM_IMAGE_MODEL, requestId: "image-receipt", costUsd: 0.045 });
  assert.equal(urls.length, 2);
});

test("read-only key failures are retryable but invalid keys or insufficient allowance cannot submit", async () => {
  for (const [body, status, retryable] of [
    [{ error: { message: "temporary" } }, 500, true],
    [{ error: { message: "limited" } }, 429, true],
    [{ error: { message: "invalid" } }, 401, false],
    [{ data: { is_management_key: true } }, 200, false],
    [{ data: { limit_remaining: 0.001 } }, 200, false],
  ] as const) {
    let calls = 0;
    await assert.rejects(generateOpenRouterSeedreamImage(input, { apiKey, fetchImpl: async (_url, init) => {
      calls++; assert.notEqual(init?.method, "POST"); return json(body, status);
    } }), (error: unknown) => error instanceof ProviderRequestNotSubmittedError && error.retryable === retryable);
    assert.equal(calls, 1);
  }
});

test("timeouts, upstream errors and malformed paid responses never repeat an image submission", async () => {
  for (const outcome of ["lost", "server", "rate", "invalid-json", "empty", "remote-url", "invalid-bytes", "svg", "extra-images", "oversized"] as const) {
    let posts = 0;
    await assert.rejects(generateOpenRouterSeedreamImage(input, { apiKey, fetchImpl: async (url) => {
      if (String(url).endsWith("/key")) return json({ data: {} });
      posts++;
      if (outcome === "lost") throw new Error(`Network error ${apiKey}`);
      if (outcome === "server" || outcome === "rate") return json({ error: { message: `Upstream error ${apiKey}` } }, outcome === "server" ? 502 : 429);
      if (outcome === "invalid-json") return new Response("broken");
      if (outcome === "remote-url") return json({ data: [{ url: "https://outside.example/image.png" }] });
      if (outcome === "invalid-bytes") return json({ data: [{ b64_json: Buffer.from("not an image").toString("base64") }] });
      if (outcome === "svg") return json({ data: [{ b64_json: image.toString("base64"), media_type: "image/svg+xml" }] });
      if (outcome === "extra-images") return json({ data: [{ b64_json: image.toString("base64") }, { b64_json: image.toString("base64") }] });
      if (outcome === "oversized") return new Response("{}", { headers: { "content-length": String(49 * 1024 * 1024) } });
      return json({ data: [] });
    } }), (error: unknown) => error instanceof Error && !error.message.includes(apiKey));
    assert.equal(posts, 1);
  }
});

test("missing MIME and usage are optional; valid JPEG and WebP also pass to output normalization", async () => {
  for (const bytes of [image, Buffer.from([255, 216, 255, 224]), Buffer.from("RIFF0000WEBP")]) {
    const result = await generateOpenRouterSeedreamImage(input, { apiKey, fetchImpl: async url =>
      String(url).endsWith("/key") ? json({ data: {} }) : json({ data: [{ b64_json: bytes.toString("base64") }] }) });
    assert.deepEqual(result.buffer, bytes);
    assert.equal(result.costUsd, undefined);
  }
});
