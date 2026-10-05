import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AUDIO_MAX_OUTPUT_BYTES, AudioError } from "./audio-contract.ts";

// A protocol whitelist alone still lets playlist demuxers open other local
// files. Admit only self-contained containers before either tool probes input.
const AUDIO_DEMUXERS = "mp3,wav,ogg,mov,matroska,webm";
function run(binary: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let text = ""; let stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new AudioError("Audio validation timed out.")); }, 30000);
    child.stdout.on("data", data => { text += String(data); if (text.length > 100000) child.kill(); });
    child.stderr.on("data", data => { stderr = (stderr + String(data)).slice(-2000); });
    child.on("error", () => { clearTimeout(timer); reject(new AudioError("The worker's audio validation tools are unavailable.", 503)); });
    child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(text); else reject(new AudioError(stderr ? "Choose a complete, playable audio recording." : "Audio validation failed.")); });
  });
}
export async function probeAudio(buffer: Uint8Array) {
  if (buffer.length < 32 || buffer.length > AUDIO_MAX_OUTPUT_BYTES) throw new AudioError("The audio file size is unsupported.");
  const dir = await mkdtemp(join(tmpdir(), "ugc-audio-"));
  try {
    const path = join(dir, "recording"); await writeFile(path, buffer);
    const result = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-format_whitelist", AUDIO_DEMUXERS, "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", path])) as { streams?: Array<{ codec_type: string; disposition?: { attached_pic?: number } }>; format?: { duration?: string } };
    if (!result.streams?.some(s => s.codec_type === "audio") || result.streams.some(s => s.codec_type === "video" && s.disposition?.attached_pic !== 1)) throw new AudioError("Choose an audio recording without video.");
    const duration = Number(result.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 180) throw new AudioError("Audio recordings must be shorter than three minutes.");
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-xerror", "-format_whitelist", AUDIO_DEMUXERS, "-protocol_whitelist", "file,pipe", "-i", path, "-map", "0:a:0", "-f", "null", "-"]);
    return duration;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
