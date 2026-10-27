import "server-only";
import { Storage } from "@google-cloud/storage";
import { getGoogleServiceAccountCredentials } from "../gcp/credentials.ts";
import { withReadDeadline } from "../http/read-deadline.ts";
import manifest from "./hook-video-bundle-manifest.json" with { type: "json" };
import { HOOK_BUNDLE_STATE_KEY, validateBundleItems, type BundleStateStore } from "./hook-video-bundle.ts";
import { createHookBundleHandlers } from "./hook-video-bundle-api.ts";

const bundleHash = validateBundleItems(manifest.items);
function bucket() {
  const name = process.env.GCP_STORAGE_BUCKET?.trim() || process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim();
  if (!name) throw new Error("Bundle storage is not configured.");
  const credentials = getGoogleServiceAccountCredentials();
  return new Storage({ ...(credentials ? { credentials } : {}), retryOptions: { autoRetry: false },
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT }).bucket(name);
}

// Server-owned object preconditions are the authority across parallel instances.
// No account details, emails or IP addresses are stored in the counter.
export function createHookBundleStore(stateKey = HOOK_BUNDLE_STATE_KEY): BundleStateStore {
  if (stateKey !== HOOK_BUNDLE_STATE_KEY && !/^resources\/hook-video-bundle\/tests\/[a-f0-9-]{36}\/downloads\.json$/.test(stateKey)) throw new Error("Invalid bundle counter key.");
  return {
    read: () => withReadDeadline(async signal => {
      const file = bucket().file(stateKey);
      const stream = file.createReadStream();
      let generation = "", length = 0;
      const chunks: Buffer[] = [];
      stream.once("response", (response: { headers: Record<string, unknown> }) => { generation = String(response.headers["x-goog-generation"] ?? ""); });
      const abort = () => stream.destroy(new Error("Counter read timed out."));
      signal.addEventListener("abort", abort, { once: true });
      try {
        for await (const chunk of stream) {
          const bytes = Buffer.from(chunk); length += bytes.length;
          if (length > 20_000) throw new Error("Invalid bundle counter size.");
          chunks.push(bytes);
        }
        // Read data and generation from one GET: a competing writer cannot make
        // a metadata-then-download pair observe different object versions.
        if (!/^[1-9][0-9]*$/.test(generation)) throw new Error("Invalid bundle counter generation.");
        return { generation, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
      } catch (error) { if (Number((error as { code?: unknown }).code) === 404) return null; throw error; }
      finally { signal.removeEventListener("abort", abort); stream.destroy(); }
    }, undefined, 20_000),
    replace: (generation, value) => withReadDeadline(async () => {
      try {
        await bucket().file(stateKey).save(Buffer.from(JSON.stringify(value)), {
          resumable: false, preconditionOpts: { ifGenerationMatch: generation },
          contentType: "application/json", metadata: { cacheControl: "no-store" },
        });
        return true;
      } catch (error) { if (Number((error as { code?: unknown }).code) === 412) return false; throw error; }
    }, undefined, 20_000),
  };
}
export const hookBundleStore = createHookBundleStore();

async function prepare(signal: AbortSignal) {
  const storage = bucket();
  const entries = new Array<import("./hook-video-bundle-zip.ts").BundleZipEntry>(manifest.items.length);
  let cursor = 0;
  await withReadDeadline(async () => {
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (cursor < manifest.items.length) {
        signal.throwIfAborted();
        const index = cursor++, item = manifest.items[index];
        const [metadata] = await storage.file(item.key).getMetadata();
        if (!metadata.generation || !Number.isSafeInteger(Number(metadata.size)) || Number(metadata.size) <= 0 || Number(metadata.size) > 64 * 1024 ** 2) throw new Error("A bundle video is unavailable.");
        entries[index] = { ...item, size: Number(metadata.size), open() {
          const stream = storage.file(item.key, { generation: metadata.generation }).createReadStream();
          const abort = () => stream.destroy(new Error("Bundle download canceled."));
          const timeout = setTimeout(abort, 30_000);
          signal.addEventListener("abort", abort, { once: true });
          stream.once("close", () => { clearTimeout(timeout); signal.removeEventListener("abort", abort); });
          if (signal.aborted) abort();
          return stream;
        } };
      }
    }));
  }, signal, 30_000);
  return entries;
}

export const hookBundleHandlers = createHookBundleHandlers({ store: hookBundleStore, bundleHash, videoCount: manifest.items.length, prepare });
