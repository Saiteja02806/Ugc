export const OMNI_EDIT_MAX_VIDEO_SECONDS = 10;
export const OMNI_EDIT_MAX_VIDEO_BYTES = 32 * 1024 ** 2;

/** Bounded, non-redirecting download for explicit generation inputs. */
export async function downloadVideoReference(url: string) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Could not load the reference video. Try again after it is available.");
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0].trim() ?? "";
  if (!mimeType.startsWith("video/")) throw new Error("The reference must be a video file.");
  if (Number(response.headers.get("content-length")) > OMNI_EDIT_MAX_VIDEO_BYTES) {
    await response.body?.cancel();
    throw new Error("Use a reference video up to 32 MB.");
  }
  if (!response.body) throw new Error("The reference video is empty.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > OMNI_EDIT_MAX_VIDEO_BYTES) throw new Error("Use a reference video up to 32 MB.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!size) throw new Error("The reference video is empty.");
  return { buffer: Buffer.concat(chunks), mimeType };
}

/** Read an MP4 movie duration without executing a decoder. */
export function readMp4DurationSeconds(buffer: Buffer): number {
  function scan(start: number, end: number): number | undefined {
    for (let offset = start; offset + 8 <= end;) {
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      let size = buffer.readUInt32BE(offset);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) break;
        size = Number(buffer.readBigUInt64BE(offset + 8)); header = 16;
      } else if (size === 0) size = end - offset;
      if (!Number.isSafeInteger(size) || size < header || offset + size > end) break;
      const payload = offset + header;
      if (type === "moov") {
        const duration = scan(payload, offset + size);
        if (duration !== undefined) return duration;
      }
      if (type === "mvhd") {
        const version = buffer[payload];
        if (version !== 0 && version !== 1) break;
        const required = version === 1 ? 32 : 20;
        if (size - header < required) break;
        const timescale = buffer.readUInt32BE(payload + (version === 1 ? 20 : 12));
        const ticks = version === 1 ? Number(buffer.readBigUInt64BE(payload + 24)) : buffer.readUInt32BE(payload + 16);
        if (timescale > 0 && Number.isSafeInteger(ticks) && ticks > 0) return ticks / timescale;
      }
      offset += size;
    }
    return undefined;
  }
  const duration = scan(0, buffer.length);
  if (!duration || !Number.isFinite(duration)) throw new Error("Could not verify the video's duration.");
  return duration;
}

/** Allow container/frame rounding, but never accept a materially changed timeline. */
export function assertVideoEditDuration(buffer: Buffer, sourceSeconds: number) {
  const actualSeconds = readMp4DurationSeconds(buffer);
  if (!Number.isFinite(sourceSeconds) || sourceSeconds <= 0 || Math.abs(actualSeconds - sourceSeconds) > 0.25) {
    throw new Error(`The generated video is ${actualSeconds.toFixed(2)} seconds, but the reference is ${sourceSeconds.toFixed(2)} seconds. The edit could not preserve the reference duration.`);
  }
  return actualSeconds;
}
