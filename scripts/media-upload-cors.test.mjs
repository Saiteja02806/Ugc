import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { prepareMediaUploadCors } from "./prepare-media-upload-cors.mjs";

test("Vidmake upload policy is additive, preserves other rules and is idempotent", () => {
  const original = [{ origin: ["https://getugcpilot.com", "http://localhost:3000"], method: ["GET", "HEAD", "PUT"], responseHeader: ["Content-Type", "x-goog-if-generation-match"], maxAgeSeconds: 3600 },
    { origin: ["https://reader.test"], method: ["GET"], responseHeader: ["ETag"] }];
  const snapshot = structuredClone(original);
  const result = prepareMediaUploadCors({ cors_config: original });
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result[0].origin, [...original[0].origin, "https://vidmake.io", "https://www.vidmake.io"]);
  assert.deepEqual({ ...result[0], origin: original[0].origin }, original[0]);
  assert.deepEqual(result[1], original[1]);
  assert.deepEqual(prepareMediaUploadCors(result), result);
  assert.ok(!result[0].origin.includes("*"));
});

test("missing upload rules cannot create an unreviewed replacement policy", () => {
  for (const config of [null, [], { cors_config: [] }, [{ origin: ["https://reader.test"], method: ["GET"] }]]) {
    assert.throws(() => prepareMediaUploadCors(config));
  }
});

test("foundation CORS defaults include both exact Vidmake origins without removing legacy origins", () => {
  const source = readFileSync(new URL("../infra/gcp/foundation/variables.tf", import.meta.url), "utf8");
  const block = source.slice(source.indexOf('variable "media_cors_origins"'), source.indexOf('variable "cdn_domain_names"'));
  for (const origin of ["https://vidmake.io", "https://www.vidmake.io", "https://getugcpilot.com", "https://www.getugcpilot.com", "http://localhost:3000"]) assert.ok(block.includes(`"${origin}"`));
  assert.ok(!block.includes('"*"'));
});
