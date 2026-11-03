import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

/** Remove all audio without re-encoding the generated picture. */
export async function silenceGeneratedVideo(buffer: Buffer) {
  const dir = await mkdtemp(join(tmpdir(), "ugc-silent-"));
  try {
    const source = join(dir, "source.mp4"), output = join(dir, "silent.mp4");
    await writeFile(source, buffer);
    await promisify(execFile)(process.env.FFMPEG_PATH || "ffmpeg", ["-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", source, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", output], { timeout: 60000, windowsHide: true });
    return await readFile(output);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
