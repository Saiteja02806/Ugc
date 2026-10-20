import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { promisify } from "node:util";
import ffprobeStatic from "ffprobe-static";
import { maintenanceClients } from "./media-maintenance-runtime.mjs";
import { keysetPages, cleanMediaKey, privateLocation, missingVideoDetails, boundedMediaDownload,
  parseMaintenanceOptions, updateMissingDetails } from "./media-maintenance-core.mjs";

const options = parseMaintenanceOptions(process.argv.slice(2), ["inspect", "backfill"]);
const { db, storage, primary, privateBucket } = maintenanceClients();
const summary = { inspected: 0, wouldUpdate: 0, updated: 0, failed: 0 };
const exec = promisify(execFile);
for await (const asset of keysetPages(async (after, limit) => {
  let query = db.from("media_assets").select("id,updated_at,storage_key,metadata,duration_seconds,width,height,file_size_bytes,file_name")
    .eq("status", "ready").is("deleted_at", null).eq("collection", "video")
    .eq("source_type", "combined_render")
    .or("width.is.null,height.is.null,duration_seconds.is.null,file_name.is.null,file_size_bytes.is.null")
    .order("id", { ascending: true }).limit(limit);
  if (after) query = query.gt("id", after);
  const { data, error } = await query;
  if (error) throw new Error("Could not list incomplete videos.");
  return data;
})) {
  const directory = await mkdtemp(join(tmpdir(), "ugc-render-metadata-"));
  try {
    const key = cleanMediaKey(asset.storage_key);
    const bucket = privateLocation(asset.metadata) ? privateBucket : primary;
    if (!bucket) throw new Error("Private bucket is not configured.");
    const file = storage.bucket(bucket).file(key);
    const [before] = await file.getMetadata();
    const bytes = Number(before.size);
    if (!before.generation || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 250 * 1024 * 1024) {
      throw new Error("Video is missing or exceeds the inspection size limit.");
    }
    let path;
    for (let attempt = 0; attempt < 3; attempt++) {
      // Each attempt is generation-pinned and uses a new exclusive temporary file.
      path = join(directory, `render-${attempt}.mp4`);
      try {
        await boundedMediaDownload(storage.bucket(bucket).file(key, { generation: before.generation }), path, bytes);
        break;
      } catch (error) {
        const transient = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ABORT_ERR", "ERR_STREAM_PREMATURE_CLOSE"].includes(error.code) || error.message === "aborted";
        if (!transient || attempt === 2) throw new Error("Could not inspect the stored video after bounded read attempts.");
      }
    }
    const { stdout } = await exec(process.env.FFPROBE_PATH || ffprobeStatic.path,
      ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", path],
      { windowsHide: true, maxBuffer: 1024 * 1024, timeout: 60000 });
    const probe = JSON.parse(stdout);
    const video = probe.streams?.find(stream => stream.codec_type === "video");
    const patch = missingVideoDetails(asset, { durationSeconds: Number(probe.format?.duration),
      width: Number(video?.width), height: Number(video?.height), fileSizeBytes: bytes });
    const [after] = await file.getMetadata();
    if (after.generation !== before.generation) throw new Error("Video changed during inspection.");
    summary.inspected++;
    if (Object.keys(patch).length) {
      summary.wouldUpdate++;
      if (options.execute && await updateMissingDetails(db, asset, patch)) summary.updated++;
    }
    console.log(JSON.stringify({ assetId: asset.id, mode: options.mode, missingDetails: patch }));
  } catch (error) {
    summary.failed++;
    console.error(JSON.stringify({ assetId: asset.id, error: error.message }));
  } finally {
    const absolute = resolve(directory);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith("ugc-render-metadata-")) {
      throw new Error("Unsafe temporary cleanup path.");
    }
    await rm(absolute, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ ...summary, mode: options.mode, videosRegenerated: 0, filesDeleted: 0 }));
if (summary.failed) process.exitCode = 1;
