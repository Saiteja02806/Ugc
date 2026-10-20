import "server-only";
import { createHash } from "node:crypto";
import { getStorageObject, uploadBufferToStorage } from "@/lib/storage/storage";
import { getWallTextOverlayIdentity, prepareWallTextOverlayAsset, type WallTextOverlayInput } from "@/worker/src/lib/wall-text-overlay-renderer";
import { validateWallTextOverlayAsset, wallTextOverlayContentHash, type WallTextOverlayReference } from "@/worker/src/lib/wall-text-overlay-asset";

export type StoredWallTextOverlay = WallTextOverlayReference;
const pending = new Map<string, Promise<{ asset: StoredWallTextOverlay; png: Buffer }>>();

async function readObject(key: string) {
  const object = await getStorageObject({ key });
  if (!object.Body) throw new Error("Text image could not be loaded.");
  return Buffer.from(await new Response(object.Body.transformToWebStream()).arrayBuffer());
}

export async function ensureStoredWallTextOverlay(userId: string, input: WallTextOverlayInput) {
  const { inputHash } = await getWallTextOverlayIdentity(input);
  const owner = createHash("sha256").update(userId).digest("hex");
  const prefix = `wall-text-overlays/${owner}/${inputHash}`;
  const existing = pending.get(prefix);
  if (existing) return existing;
  const work = (async () => {
    try {
      const asset = JSON.parse((await readObject(`${prefix}/manifest.json`)).toString()) as StoredWallTextOverlay;
      if (asset.key !== `${prefix}/${asset.sha256}.png` || asset.contentHash !== wallTextOverlayContentHash(input)) throw new Error("Invalid text image key or content.");
      const png = await readObject(asset.key);
      await validateWallTextOverlayAsset({ ...asset, png }, inputHash);
      return { asset, png };
    } catch (error) {
      // Only a missing object permits creation. Outages and corrupt data remain errors.
      const missing = error as { code?: number | string; name?: string; statusCode?: number };
      if (missing.code !== 404 && missing.statusCode !== 404 && missing.name !== "NoSuchKey" && missing.name !== "NotFound") throw error;
    }
    const generated = await prepareWallTextOverlayAsset(input);
    const asset: StoredWallTextOverlay = {
      version: generated.version, inputHash: generated.inputHash, sha256: generated.sha256, contentHash: wallTextOverlayContentHash(input),
      width: generated.width, height: generated.height, key: `${prefix}/${generated.sha256}.png`,
    };
    await uploadBufferToStorage({ key: asset.key, buffer: generated.png, contentType: "image/png",
      cacheControl: "private, max-age=31536000, immutable" });
    await uploadBufferToStorage({ key: `${prefix}/manifest.json`, buffer: Buffer.from(JSON.stringify(asset)),
      contentType: "application/json", cacheControl: "private, no-cache" });
    return { asset, png: generated.png };
  })();
  pending.set(prefix, work);
  try { return await work; } finally { pending.delete(prefix); }
}
