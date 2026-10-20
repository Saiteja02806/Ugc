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

// Exercise the actual SDK's private V4 signer with the same disposable key.
// Bucket metadata is a local fixture; a network request still fails above.
const storagePackage = await import("@google-cloud/storage");
const httpTransport = (await import("node:http")).default;
const httpsTransport = (await import("node:https")).default;
const oldHttpRequest = httpTransport.request, oldHttpsRequest = httpsTransport.request;
httpTransport.request = httpsTransport.request = () => { throw new Error("Signing test must not contact the network"); };
const previousMetadata = storagePackage.Bucket.prototype.getMetadata;
storagePackage.Bucket.prototype.getMetadata = async () => [{iamConfiguration:{publicAccessPrevention:"enforced"}}];
try {
 process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";
 process.env.GCP_PRIVATE_MEDIA_BUCKET="local-mcp-private-signing-test";
 const {signMcpUpload}=await import("../lib/mcp/upload-storage.ts");
 const privateKey="media/offline/video/00000000-0000-4000-8000-000000000001.mp4";
 const privateUrl=new URL(await signMcpUpload({storage_key:privateKey,
  url:`https://storage.googleapis.com/local-mcp-private-signing-test/${privateKey}`,
  file_size_bytes:1024,mime_type:"video/mp4",metadata:{storageLocation:"private_user_media"}},60));
 assert.equal(privateUrl.pathname,`/local-mcp-private-signing-test/${privateKey}`);
 assert.equal(privateUrl.searchParams.get("X-Goog-Algorithm"),"GOOG4-RSA-SHA256");
 assert.match(privateUrl.searchParams.get("X-Goog-SignedHeaders"),/x-goog-content-length-range/);
 assert.match(privateUrl.searchParams.get("X-Goog-SignedHeaders"),/x-goog-if-generation-match/);
 console.log("Private storage SDK: actual offline V4 signing keeps bucket/key and signed create-only size headers.");
} finally {
 storagePackage.Bucket.prototype.getMetadata=previousMetadata;
 httpTransport.request=oldHttpRequest; httpsTransport.request=oldHttpsRequest;
}
