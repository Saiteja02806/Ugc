import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Maintenance is explicit, non-destructive and safe to import in offline tests. */
export async function boundedMediaDownload(file, path, expectedBytes, timeoutMs = 60000) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > 250 * 1024 * 1024) {
    throw new Error("Video exceeds the inspection size limit.");
  }
  let received = 0;
  const bounded = new Transform({ transform(chunk, _encoding, callback) {
    received += chunk.length;
    callback(received > expectedBytes ? new Error("Video exceeded its recorded size.") : null, chunk);
  } });
  await pipeline(file.createReadStream(), bounded, createWriteStream(path, { flags: "wx" }),
    { signal: AbortSignal.timeout(timeoutMs) });
  if (received !== expectedBytes) throw new Error("Video download was incomplete.");
}

export async function* keysetPages(loadPage, pageSize = 50) {
  let after = null;
  for (;;) {
    const rows = await loadPage(after, pageSize);
    if (!Array.isArray(rows)) throw new Error("Invalid maintenance page.");
    if (!rows.length) return;
    for (const row of rows) {
      if (typeof row.id !== "string" || (after !== null && row.id <= after)) {
        throw new Error("Maintenance cursor did not advance.");
      }
      after = row.id;
      yield row;
    }
    if (rows.length < pageSize) return;
  }
}

export function parseMaintenanceOptions(args, allowedModes) {
  if (args.includes("--delete-source")) throw new Error("Source deletion is not supported.");
  const modeArgs = args.filter(value => value.startsWith("--mode="));
  if (modeArgs.length > 1 || (args.includes("--inspect") && modeArgs.some(value => value !== "--mode=inspect"))) {
    throw new Error("Choose exactly one maintenance mode.");
  }
  const modeArg = modeArgs[0];
  const mode = modeArg?.slice(7) ?? "inspect";
  const allowed = new Set(["--yes", "--execute", "--inspect", ...allowedModes.map(value => `--mode=${value}`)]);
  if (args.some(value => !allowed.has(value))) throw new Error("Unknown maintenance option.");
  if (!allowedModes.includes(mode)) throw new Error("Unsupported maintenance mode.");
  if (args.includes("--execute") && mode === "inspect") throw new Error("Select an explicit write mode.");
  if (mode !== "inspect" && (!args.includes("--execute") || !args.includes("--yes"))) {
    throw new Error("Writes require an explicit mode and --execute --yes.");
  }
  return { mode, execute: mode !== "inspect" };
}

export function cleanMediaKey(value) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.startsWith("/") ||
      value.split("/").some(part => !part || part === "." || part === "..") || /[:\\\u0000-\u001f]/.test(value)) {
    throw new Error("Invalid stored media key.");
  }
  return value;
}

export function privateLocation(metadata) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
    metadata.storageLocation === "private_user_media");
}

export function missingVideoDetails(asset, details) {
  if (!Number.isFinite(details.durationSeconds) || details.durationSeconds <= 0 ||
      !Number.isSafeInteger(details.width) || details.width <= 0 ||
      !Number.isSafeInteger(details.height) || details.height <= 0 ||
      !Number.isSafeInteger(details.fileSizeBytes) || details.fileSizeBytes <= 0) {
    throw new Error("Invalid probed video details.");
  }
  const patch = {};
  for (const [column, value] of Object.entries({
    duration_seconds: details.durationSeconds, width: details.width, height: details.height,
    file_size_bytes: details.fileSizeBytes, file_name: cleanMediaKey(asset.storage_key).split("/").at(-1),
  })) if (asset[column] === null) patch[column] = value;
  return patch;
}

export function verifyCopy(source, target) {
  if (!source.generation || !target.generation || !source.crc32c || !target.crc32c ||
      source.crc32c !== target.crc32c || String(source.size) !== String(target.size) ||
      !Number.isSafeInteger(Number(source.size)) || Number(source.size) <= 0 ||
      source.contentType !== target.contentType) throw new Error("Copied object verification failed.");
}

/** Copy-only: never repoint database rows or remove/overwrite a source/destination. */
export async function copyMediaObject(sourceBucket, privateBucket, key, execute) {
  const source = sourceBucket.file(cleanMediaKey(key));
  const target = privateBucket.file(key);
  const [before] = await source.getMetadata();
  // Reject incomplete metadata before making a copy, not after writing it.
  verifyCopy(before, before);
  const [exists] = await target.exists();
  if (!exists && !execute) return { state: "would_copy", generation: before.generation };
  if (!exists) {
    await sourceBucket.file(key, { generation: before.generation }).copy(target, {
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  }
  const [copied] = await target.getMetadata();
  verifyCopy(before, copied);
  const [after] = await source.getMetadata();
  if (after.generation !== before.generation) throw new Error("Source changed during verification.");
  return { state: exists ? "verified_existing" : "copied", generation: before.generation };
}

export async function updateMissingDetails(db, asset, patch) {
  if (!Object.keys(patch).length) return false;
  // Version/key guards prevent clobbering concurrent edits, migration or deletion.
  let query = db.from("media_assets").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", asset.id).eq("updated_at", asset.updated_at).eq("storage_key", asset.storage_key)
    .eq("status", "ready").is("deleted_at", null);
  for (const column of Object.keys(patch)) query = query.is(column, null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error("Could not conditionally update video metadata.");
  if (!data) throw new Error("Asset changed; inspect again before updating.");
  return true;
}
