import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";
import { escapeAssText, type MeasureText, type SubtitleLayout } from "./captions.js";
import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_MS, SubtitleError, record } from "./contracts.js";

export type SubtitleTools = { ffmpeg: string; ffprobe: string; fontsDir: string };
export type VideoInfo = { width: number; height: number; durationMs: number; videoIndex: number; audioIndex: number; audioCodec: string };

/** No shell, no remote media protocols, bounded output, timeout, and cancellation. */
export async function runMediaCommand(binary: string, args: string[], options: { cwd?: string; signal?: AbortSignal; timeoutMs?: number } = {}) {
  options.signal?.throwIfAborted();
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, args, { cwd: options.cwd, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", failure: SubtitleError | undefined;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const stop = (error: SubtitleError) => {
      failure ??= error;
      child.kill("SIGTERM");
      forceKill ??= setTimeout(() => child.kill("SIGKILL"), 1_000);
    };
    const timer = setTimeout(() => stop(new SubtitleError("MEDIA_TIMEOUT", "Video processing exceeded its time limit.")), options.timeoutMs ?? 180_000);
    const cancel = () => stop(new SubtitleError("CANCELLED", "Subtitle generation was cancelled."));
    options.signal?.addEventListener("abort", cancel, { once: true });
    // Cover an abort racing with listener registration.
    if (options.signal?.aborted) cancel();
    const cleanup = () => { clearTimeout(timer); if (forceKill) clearTimeout(forceKill); options.signal?.removeEventListener("abort", cancel); };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 1_000_000) stop(new SubtitleError("MEDIA_OUTPUT_TOO_LARGE", "Media probe output exceeded its limit."));
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-100_000); });
    child.on("error", () => { cleanup(); reject(new SubtitleError("MEDIA_TOOL_UNAVAILABLE", `Could not start ${basename(binary)}.`)); });
    child.on("close", (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0) reject(new SubtitleError("MEDIA_PROCESSING_FAILED", `${basename(binary)} failed to process the video.`));
      else resolve({ stdout, stderr });
    });
  });
}

export async function probeVideo(inputPath: string, tools: SubtitleTools, signal?: AbortSignal): Promise<VideoInfo> {
  const file = await stat(inputPath);
  if (!file.isFile() || file.size <= 0 || file.size > MAX_VIDEO_BYTES) throw new SubtitleError("VIDEO_SIZE_INVALID", "Select a video file smaller than 250 MiB.");
  const result = await runMediaCommand(tools.ffprobe, ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", inputPath], { signal });
  let data: Record<string, unknown>;
  try { data = record(JSON.parse(result.stdout)); } catch { throw new SubtitleError("VIDEO_INVALID", "Could not read video metadata."); }
  const streams = Array.isArray(data.streams) ? data.streams.map(record) : [];
  const video = streams.find((s) => s.codec_type === "video" && (!s.disposition || record(s.disposition).attached_pic !== 1));
  const audio = streams.find((s) => s.codec_type === "audio");
  if (!video) throw new SubtitleError("VIDEO_INVALID", "The file has no playable video stream.");
  if (!audio) throw new SubtitleError("NO_AUDIO", "The video has no audio track to transcribe.");
  const durationMs = Math.round(Number(video.duration ?? record(data.format).duration) * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_VIDEO_DURATION_MS) throw new SubtitleError("VIDEO_DURATION_INVALID", "Videos must be between 0 and 120 seconds.");
  const [sarN, sarD] = String(video.sample_aspect_ratio ?? "1:1").split(":").map(Number);
  const sar = sarN > 0 && sarD > 0 ? sarN / sarD : 1;
  let width = Math.round(Number(video.width) * sar), height = Number(video.height);
  const rotationData = Array.isArray(video.side_data_list) ? video.side_data_list.map(record).find((s) => typeof s.rotation === "number") : undefined;
  const rotation = Number(rotationData?.rotation ?? 0);
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  width = Math.ceil(width / 2) * 2;
  height = Math.ceil(height / 2) * 2;
  if (![width, height].every((n) => Number.isFinite(n) && n >= 64 && n <= 4096) ||
      !Number.isInteger(video.index) || !Number.isInteger(audio.index)) throw new SubtitleError("VIDEO_DIMENSIONS_INVALID", "Unsupported video dimensions or streams.");
  return { width, height, durationMs, videoIndex: video.index as number, audioIndex: audio.index as number, audioCodec: String(audio.codec_name) };
}

export async function prepareSubtitleFonts(tools: SubtitleTools, workDir: string) {
  await mkdir(join(workDir, "fonts"));
  for (const font of ["arial-regular.ttf", "arial-bold.ttf"]) {
    await copyFile(join(tools.fontsDir, font), join(workDir, "fonts", font));
  }
}

export function createTextMeasurer(layout: SubtitleLayout, tools: SubtitleTools): MeasureText {
  const cache = new Map<string, Promise<number>>();
  return (text) => {
    let measured = cache.get(text);
    if (!measured) {
      const markup = escapeAssText(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      measured = sharp({ text: { text: markup, font: `Arial ${layout.bold ? "Bold " : ""}${layout.fontSize}`,
        fontfile: join(tools.fontsDir, layout.bold ? "arial-bold.ttf" : "arial-regular.ttf"), dpi: 72, rgba: true, wrap: "none" } }).metadata().then((m) => m.width ?? 0);
      cache.set(text, measured);
    }
    return measured;
  };
}

export async function extractSubtitleAudio(inputPath: string, outputPath: string, video: VideoInfo, tools: SubtitleTools, signal?: AbortSignal) {
  await runMediaCommand(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,pipe", "-i", inputPath,
    "-map", `0:${video.audioIndex}`, "-vn", "-t", String(video.durationMs / 1000), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outputPath], { signal });
  const audio = await readFile(outputPath);
  if (audio.length > 24 * 1024 * 1024) throw new SubtitleError("AUDIO_TOO_LARGE", "Extracted audio exceeds the transcription limit.");
  // FFmpeg volumedetect reports a finite floor for silent PCM16. Check the PCM
  // samples themselves instead; this does not classify quiet speech as silence.
  if (audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
    throw new SubtitleError("AUDIO_INVALID", "Audio extraction did not produce a PCM WAV file.");
  }
  let foundData = false;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const size = audio.readUInt32LE(offset + 4), start = offset + 8;
    if (audio.toString("ascii", offset, offset + 4) === "data") {
      const data = audio.subarray(start, Math.min(audio.length, start + size));
      if (!data.length || data.every((sampleByte) => sampleByte === 0)) throw new SubtitleError("NO_SPEECH", "The video audio is silent.");
      foundData = true;
      break;
    }
    offset = start + size + (size % 2);
  }
  if (!foundData) throw new SubtitleError("AUDIO_INVALID", "Extracted audio has no PCM samples.");
}

export async function renderSubtitleVideo(workDir: string, video: VideoInfo, tools: SubtitleTools, signal?: AbortSignal) {
  const result = await runMediaCommand(tools.ffmpeg, ["-hide_banner", "-n", "-protocol_whitelist", "file,pipe", "-i", "source-video",
    "-vf", `scale=${video.width}:${video.height},setsar=1,ass=captions.ass:fontsdir=fonts`, "-map", `0:${video.videoIndex}`, "-map", `0:${video.audioIndex}`,
    "-t", String(video.durationMs / 1000), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", video.audioCodec === "aac" ? "copy" : "aac", "-movflags", "+faststart", "captioned.mp4"], { cwd: workDir, signal });
  if (/Glyph.*not found|failed to find.*glyph|fontselect: failed/iu.test(result.stderr)) throw new SubtitleError("FONT_UNAVAILABLE", "The selected fonts cannot render this transcript language.");
  const output = await probeVideo(join(workDir, "captioned.mp4"), tools, signal);
  if (Math.abs(output.durationMs - video.durationMs) > 150 || output.width !== video.width || output.height !== video.height || output.audioCodec !== "aac") {
    throw new SubtitleError("OUTPUT_INVALID", "Captioned output did not preserve the video dimensions, duration, and audio.");
  }
}
