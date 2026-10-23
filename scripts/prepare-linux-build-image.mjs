import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// Public official Node image, downloaded as verified OCI layers for an isolated
// WSL chroot. This does not start Docker or deploy/push anything.
const output = path.resolve(".tmp/sibling-linux-check/linux-image");
await mkdir(output, { recursive: true });
const response = await fetch("https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/node:pull", { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Image token request: ${response.status}`);
const { token } = await response.json();
const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json" };
async function manifest(reference) {
  const result = await fetch(`https://registry-1.docker.io/v2/library/node/manifests/${reference}`, { headers, signal: AbortSignal.timeout(30000) });
  if (!result.ok) throw new Error(`Image manifest: ${result.status}`);
  return { data: await result.json(), digest: result.headers.get("docker-content-digest") };
}
const index = await manifest("24-bookworm-slim");
const descriptor = index.data.manifests.find(item => item.platform.os === "linux" && item.platform.architecture === "amd64");
if (!descriptor) throw new Error("Official image has no linux/amd64 manifest");
const image = await manifest(descriptor.digest);
const layers = [];
for (const [number, layer] of image.data.layers.entries()) {
  const file = path.join(output, `${number}-${layer.digest.slice(7)}.tar.gz`);
  let bytes;
  try { bytes = await readFile(file); } catch { /* Download only missing layer. */ }
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== layer.digest.slice(7)) {
    const result = await fetch(`https://registry-1.docker.io/v2/library/node/blobs/${layer.digest}`, { headers, signal: AbortSignal.timeout(180000) });
    if (!result.ok) throw new Error(`Image layer: ${result.status}`);
    bytes = Buffer.from(await result.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== layer.digest.slice(7)) throw new Error("Image layer digest mismatch");
    await writeFile(file, bytes);
  }
  layers.push({ file: path.basename(file), digest: layer.digest, bytes: bytes.length });
  console.log(`Verified layer ${number + 1}/${image.data.layers.length}: ${bytes.length} bytes`);
}
await writeFile(path.join(output, "receipt.json"), JSON.stringify({ source: "docker.io/library/node:24-bookworm-slim", indexDigest: index.digest, imageDigest: descriptor.digest, platform: "linux/amd64", layers }, null, 2) + "\n");
console.log(`Official Linux image verified: ${descriptor.digest}`);
