import { maintenanceClients } from "./media-maintenance-runtime.mjs";
import { keysetPages, cleanMediaKey, privateLocation, parseMaintenanceOptions,
  copyMediaObject } from "./media-maintenance-core.mjs";

// No switch/delete mode exists. Source files, URLs and database rows remain unchanged.
const options = parseMaintenanceOptions(process.argv.slice(2), ["inspect", "copy"]);
const { db, storage, primary, privateBucket } = maintenanceClients();
if (!privateBucket) throw new Error("GCP_PRIVATE_MEDIA_BUCKET must be explicitly configured.");
const summary = { inspected: 0, copied: 0, wouldCopy: 0, alreadyPrivate: 0, failed: 0 };
for await (const asset of keysetPages(async (after, limit) => {
  let query = db.from("media_assets").select("id,metadata,storage_key,thumbnail_url,url")
    .eq("status", "ready").is("deleted_at", null).neq("source_type", "catalog_influencer")
    .order("id", { ascending: true }).limit(limit);
  if (after) query = query.gt("id", after);
  const { data, error } = await query;
  if (error) throw new Error("Could not list private-storage candidates.");
  return data;
}, 100)) {
  try {
    const key = cleanMediaKey(asset.storage_key);
    if (privateLocation(asset.metadata)) {
      // Resumed/private rows must have a real private object; never silently skip absence.
      const [metadata] = await storage.bucket(privateBucket).file(key).getMetadata();
      if (!metadata.generation || Number(metadata.size) <= 0) throw new Error("Private object is missing.");
      summary.alreadyPrivate++;
      continue;
    }
    const base = process.env.GCP_STORAGE_PUBLIC_BASE_URL || process.env.GCS_PUBLIC_BASE_URL;
    const recognized = [
      `https://storage.googleapis.com/${primary}/${key}`,
      `https://${primary}.storage.googleapis.com/${key}`,
      ...(base ? [`${base.replace(/\/$/, "")}/${key}`] : []),
    ];
    if (!recognized.includes(asset.url)) throw new Error("Asset is not in the configured public bucket; left unchanged.");
    const result = await copyMediaObject(storage.bucket(primary), storage.bucket(privateBucket), key, options.execute);
    summary.inspected++;
    if (result.state === "copied") summary.copied++;
    if (result.state === "would_copy") summary.wouldCopy++;
    // Separate thumbnails/references must be inventoried before any future URL switch.
    console.log(JSON.stringify({ assetId: asset.id, ...result, separateThumbnailNeedsReview:
      Boolean(asset.thumbnail_url && asset.thumbnail_url !== asset.url) }));
  } catch (error) {
    summary.failed++;
    console.error(JSON.stringify({ assetId: asset.id, error: error.message }));
  }
}
console.log(JSON.stringify({ ...summary, mode: options.mode, databaseUpdated: 0, sourceDeleted: 0 }));
if (summary.failed) process.exitCode = 1;
