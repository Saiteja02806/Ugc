import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";

// Generate a throwaway key in memory. Signing must not contact Google or
// depend on an operator's account, and the signature/key must not be logged.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_CLOUD_CREDENTIALS_JSON = JSON.stringify({
  client_email: "local-mcp-test@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});
process.env.GCP_STORAGE_BUCKET = "local-mcp-signing-test";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://storage.googleapis.com/local-mcp-signing-test";
globalThis.fetch = async () => { throw new Error("Signing must not use the network"); };

const { gcsStorageProvider } = await import("../lib/storage/gcs.ts");
const url = new URL(await gcsStorageProvider.createSignedPutUrl({
  key: "audit/reference.png", contentType: "image/png", maxBytes: 68,
  createOnly: true, expiresInSeconds: 60,
}));
assert.equal(url.protocol, "https:");
assert.equal(url.hostname, "storage.googleapis.com");
assert.equal(url.pathname, "/local-mcp-signing-test/audit/reference.png");
assert.equal(url.searchParams.get("X-Goog-Algorithm"), "GOOG4-RSA-SHA256");
assert.match(url.searchParams.get("X-Goog-SignedHeaders"), /x-goog-content-length-range/);
assert.match(url.searchParams.get("X-Goog-SignedHeaders"), /x-goog-if-generation-match/);

// Gaxios 6 uses only the stable CJS v4 API of uuid. Exercise the scoped
// security override through that consumer's actual resolution path.
const storageRequire = createRequire(import.meta.resolve("@google-cloud/storage"));
const gaxiosRequire = createRequire(storageRequire.resolve("gaxios"));
assert.match(gaxiosRequire("uuid").v4(), /^[a-f0-9-]{36}$/);
console.log("Storage SDK: offline V4 upload signing, size/create-only signed headers, and Gaxios UUID compatibility passed.");
