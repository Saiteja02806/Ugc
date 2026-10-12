import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { MediaAssetRow } from "@/lib/media/media-storage";
import { getStorageObject } from "@/lib/storage/storage";
import { getMaxUploadBytes } from "@/lib/media/media-upload";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";
import { privateMediaObject, assertPrivateMediaIdentity } from "@/lib/media/private-media-storage";
import { ToolFailure } from "./read-tools";

const run = promisify(execFile);
const formats: Record<string, string> = { "image/png": "png_pipe", "image/jpeg": "jpeg_pipe", "image/webp": "webp_pipe",
  "video/mp4": "mov", "video/quicktime": "mov", "video/webm": "matroska" };
function containerMatches(bytes: Buffer, mime: string) {
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp") return bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
  if (mime === "video/mp4" || mime === "video/quicktime") return bytes.toString("ascii",4,8) === "ftyp" &&
    (mime === "video/quicktime" ? bytes.toString("ascii",8,12) === "qt  " : bytes.toString("ascii",8,12) !== "qt  ");
  return mime === "video/webm" && bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])) && bytes.includes(Buffer.from("webm"));
}

export async function probeStoredMcpUpload(asset: MediaAssetRow) {
  // Storage keys come only from an already owner-checked reservation. No URL,
  // shell command, executable path or local source path comes from the caller.
  const directory = await mkdtemp(join(tmpdir(), "ugc-upload-probe-"));
  const filePath = join(directory, "source");
  try {
    // The persisted location, not the current rollout flag or a caller URL,
    // chooses the source. Private reads pin the checked object generation.
    const object = isPrivateUserMedia(asset)
      ? await privateProbeObject(asset)
      : await getStorageObject({ key: asset.storage_key });
    const stream = object.Body?.transformToWebStream();
    if (!stream || object.ContentLength !== asset.file_size_bytes || !asset.file_size_bytes ||
      asset.file_size_bytes > getMaxUploadBytes(asset.collection) ||
      (object.ContentType && object.ContentType.split(";", 1)[0].trim().toLowerCase() !== asset.mime_type)) {
      if (stream) await stream.cancel().catch(() => {});
      throw new ToolFailure("UPLOAD_MISMATCH", "The stored file differs from the reservation.");
    }
    const reader = stream.getReader();
    const file = await open(filePath, "wx", 0o600);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let byteCount = 0;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new ToolFailure("UPLOAD_PROBE_UNAVAILABLE", "Upload validation timed out. Confirm this same ID again.", true)); }, 60_000);
    });
    try {
      while (true) {
        const chunk = await Promise.race([reader.read(), expired]);
        if (chunk.done) break;
        byteCount += chunk.value.byteLength;
        if (byteCount > asset.file_size_bytes) throw new ToolFailure("UPLOAD_MISMATCH", "The stored file exceeds its reserved size.");
        // FileHandle.writeFile appends using the descriptor's current offset.
        await file.writeFile(chunk.value);
      }
      if (byteCount !== asset.file_size_bytes) throw new ToolFailure("UPLOAD_MISMATCH", "The stored file is incomplete.");
    } finally { if (timer) clearTimeout(timer); await reader.cancel().catch(() => {}); await file.close(); }
    const headerFile = await open(filePath, "r");
    const header = Buffer.alloc(Math.min(byteCount, 4096));
    try { await headerFile.read(header, 0, header.length, 0); } finally { await headerFile.close(); }
    if (!containerMatches(header, asset.mime_type) || !formats[asset.mime_type])
      throw new ToolFailure("UNSUPPORTED_MEDIA_TYPE", "The actual stored container does not match its declared MIME type.");
    let data;
    try {
      const binary = process.env.FFPROBE_PATH || join(process.cwd(), "node_modules", "ffprobe-static", "bin", process.platform, process.arch, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
      const result = await run(binary, ["-v","error","-protocol_whitelist","file","-format_whitelist",formats[asset.mime_type],
        "-show_entries","stream=codec_type,width,height:stream_disposition=attached_pic:format=duration,format_name","-of","json",filePath],
      { cwd: directory, timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true, shell: false });
      data = JSON.parse(result.stdout);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") throw new ToolFailure("UPLOAD_PROBE_UNAVAILABLE", "The server media validator is unavailable.", true);
      throw new ToolFailure("INVALID_MEDIA", "The uploaded file could not be read as complete visual media.");
    }
    const visual = data.streams?.find((s: { codec_type?: string; disposition?: { attached_pic?: number } }) =>
      s.codec_type === "video" && (asset.collection === "image" || s.disposition?.attached_pic !== 1));
    const duration = Number(data.format?.duration);
    if (!Number.isSafeInteger(visual?.width) || visual.width < 1 || visual.width > 16384 ||
      !Number.isSafeInteger(visual?.height) || visual.height < 1 || visual.height > 16384 ||
      (asset.collection !== "image" && (!Number.isFinite(duration) || duration <= 0)))
      throw new ToolFailure("INVALID_MEDIA", "The uploaded file has no valid visual dimensions or video duration.");
    return { width: visual.width as number, height: visual.height as number,
      durationSeconds: asset.collection === "image" ? null : duration };
  } catch (error) {
    if (error instanceof ToolFailure) throw error;
    throw new ToolFailure("UPLOAD_PROBE_UNAVAILABLE", "Could not validate the stored upload. Confirm this same ID again.", true);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function privateProbeObject(asset: MediaAssetRow) {
  const key=assertPrivateMediaIdentity(asset.storage_key,asset.url);
  const object = await privateMediaObject({ key });
  return { ContentLength: object.size, ContentType: object.contentType,
    Body: { transformToWebStream: () => object.body } };
}

export const uploadProbe = { run: probeStoredMcpUpload };
