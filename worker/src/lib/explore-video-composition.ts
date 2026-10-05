import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { assertExploreSubtitleScope } from "../subtitles/explore-policy.js";
import { record, SubtitleError } from "../subtitles/contracts.js";
import { runMediaCommand } from "../subtitles/media.js";
import { EXPLORE_BACKGROUND_AUDIO_MAX_BYTES, EXPLORE_BACKGROUND_AUDIO_MAX_DURATION_MS, planExploreBackgroundAudio, type ExploreBackgroundPlayback } from "./explore-background-audio.js";

type CompositionTools = { ffmpeg: string; ffprobe: string };
type VideoInput = { width: number; height: number; durationMs: number; videoIndex: number; audioIndex: number | null };
const MAX_INPUT_BYTES = 250 * 1024 * 1024;
const MAX_INPUT_DURATION_MS = 120_000;

async function hashFile(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** Local files only. Ownership/downloads and durable publication belong to the job handler. */
async function probeLocal(path: string, tools: CompositionTools, signal?: AbortSignal, audioOnly = false) {
  if (!path || /^[a-z][a-z\d+.-]*:\/\//i.test(path)) throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Composition requires a downloaded local file.");
  const file = await stat(path);
  const maximumBytes = audioOnly ? EXPLORE_BACKGROUND_AUDIO_MAX_BYTES : MAX_INPUT_BYTES;
  if (!file.isFile() || file.size <= 0 || file.size > maximumBytes) throw new SubtitleError("COMPOSITION_INPUT_INVALID", audioOnly ? "Choose background audio up to 50 MiB." : "Choose a media file up to 250 MiB.");
  const result = await runMediaCommand(tools.ffprobe, ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", resolve(path)], { signal });
  let data: Record<string, unknown>;
  try { data = record(JSON.parse(result.stdout)); } catch { throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Could not read this media file."); }
  const streams = Array.isArray(data.streams) ? data.streams.map(record) : [];
  const format = record(data.format);
  // Do not silently shift an offset soundtrack relative to its pictures.
  for (const stream of streams.filter((stream) => stream.codec_type === "video" || stream.codec_type === "audio")) {
    const start = Number(stream.start_time ?? 0);
    // Standalone MP3/AAC uploads commonly carry encoder-delay timestamps. They
    // have no pictures to synchronize; reset their decoded audio to time zero.
    // Original video soundtracks still require the strict shared timeline.
    if (!Number.isFinite(start) || (!audioOnly && Math.abs(start) > 1e-6) || !Number.isInteger(stream.index)) {
      throw new SubtitleError("COMPOSITION_TIMELINE_UNSUPPORTED", "This file's track start times need timing review. Choose a file whose tracks start together.");
    }
  }
  return { streams, format };
}

function durationMs(stream: Record<string, unknown>, format: Record<string, unknown>, audioOnly = false) {
  const duration = Number(stream.duration ?? format.duration) * 1000;
  if (!Number.isFinite(duration) || duration <= 0 || duration > (audioOnly ? EXPLORE_BACKGROUND_AUDIO_MAX_DURATION_MS : MAX_INPUT_DURATION_MS)) {
    throw new SubtitleError("COMPOSITION_DURATION_INVALID", audioOnly ? "Choose background audio up to 10 minutes long." : "Each video input must be up to 120 seconds. Videos are never trimmed automatically.");
  }
  // Keep the measured fractional duration for limit checks; rounding must not
  // turn an overlong input into a permitted 60-second subtitle sequence.
  return duration;
}

async function probeVideo(path: string, tools: CompositionTools, signal?: AbortSignal): Promise<VideoInput> {
  const { streams, format } = await probeLocal(path, tools, signal);
  const video = streams.find((stream) => stream.codec_type === "video" && (!stream.disposition || record(stream.disposition).attached_pic !== 1));
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (!video) throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Choose a playable video, not an audio-only file.");
  const [numerator, denominator] = String(video.sample_aspect_ratio ?? "1:1").split(":").map(Number);
  const sar = numerator > 0 && denominator > 0 ? numerator / denominator : 1;
  let width = Number(video.width) * sar, height = Number(video.height);
  const rotationData = Array.isArray(video.side_data_list) ? video.side_data_list.map(record).find((side) => typeof side.rotation === "number") : undefined;
  const rotation = Number(rotationData?.rotation ?? 0);
  if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new SubtitleError("COMPOSITION_INPUT_INVALID", "This video's rotation needs review.");
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  width = Math.ceil(width / 2) * 2; height = Math.ceil(height / 2) * 2;
  if (![width, height].every((value) => Number.isFinite(value) && value >= 64 && value <= 4096)) throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Unsupported video dimensions.");
  return { width, height, durationMs: durationMs(video, format), videoIndex: video.index as number, audioIndex: audio ? audio.index as number : null };
}

async function probeAudio(path: string, tools: CompositionTools, signal?: AbortSignal) {
  const { streams, format } = await probeLocal(path, tools, signal, true);
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (!audio) throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Choose a playable demo audio file.");
  return { audioIndex: audio.index as number, durationMs: durationMs(audio, format, true) };
}

type AudioInput = { inputIndex: number; audioIndex: number; durationMs: number; playback?: ExploreBackgroundPlayback };
function backgroundAudioFilter(input: AudioInput, targetDurationMs: number, label: string) {
  const timing = planExploreBackgroundAudio(input.durationMs, targetDurationMs, input.playback);
  const fade = timing.fadeDurationMs / 1000;
  const filters = [`[${input.inputIndex}:${input.audioIndex}]aresample=48000`, "aformat=sample_fmts=fltp:channel_layouts=stereo", "asetpts=PTS-STARTPTS"];
  if (timing.repeat) filters.push(`aloop=loop=-1:size=${Math.max(1, Math.round(input.durationMs * 48))}:start=0`);
  filters.push(`atrim=duration=${timing.audibleDurationMs / 1000}`, "asetpts=PTS-STARTPTS", "volume=0.2",
    `afade=t=in:st=0:d=${fade}`, `afade=t=out:st=${(timing.audibleDurationMs - timing.fadeDurationMs) / 1000}:d=${fade}`,
    "apad", `atrim=duration=${targetDurationMs / 1000}`, `asetpts=PTS-STARTPTS[${label}]`);
  return filters.join(",");
}
export function buildExploreCompositionFilter(videos: VideoInput[], demoAudio?: Omit<AudioInput, "inputIndex">, options: {
  backgroundMusic?: AudioInput;
  subtitleAudio?: boolean;
} = {}) {
  const { width, height } = videos[0];
  const filters: string[] = [];
  for (const [index, video] of videos.entries()) {
    const seconds = String(video.durationMs / 1000);
    filters.push(`[${index}:${video.videoIndex}]scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[v${index}]`);
    const selected = video.audioIndex === null ? null : { inputIndex: index, audioIndex: video.audioIndex };
    const original = selected === null ? "anullsrc=channel_layout=stereo:sample_rate=48000" : `[${selected.inputIndex}:${selected.audioIndex}]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo`;
    filters.push(`${original},apad,atrim=duration=${seconds},asetpts=PTS-STARTPTS[main${index}]`);
    if (options.subtitleAudio) filters.push(`[main${index}]asplit=2[original${index}][speech${index}]`);
    else filters.push(`[main${index}]anull[original${index}]`);
    if (index === 1 && demoAudio) {
      // Added audio is DEMO-ONLY, never a replacement for original speech.
      // Repeat is explicit; uploaded recordings play once by default.
      const inputIndex = videos.length;
      filters.push(backgroundAudioFilter({ ...demoAudio, inputIndex }, video.durationMs, "background"));
      filters.push(`[original${index}][background]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=false:latency=true[a${index}]`);
    } else filters.push(`[original${index}]anull[a${index}]`);
  }
  if (videos.length === 1) {
    filters.push("[v0]null[video];[a0]anull[combinedAudio]");
    if (options.subtitleAudio) filters.push("[speech0]anull[speech]");
  } else if (options.subtitleAudio) {
    // One concat operation establishes the same video/main-speech boundaries.
    // Separate music-free speech avoids captioning known background layers.
    filters.push("[v0][a0][speech0][v1][a1][speech1]concat=n=2:v=1:a=2[video][combinedAudio][speech]");
  } else filters.push("[v0][a0][v1][a1]concat=n=2:v=1:a=1[video][combinedAudio]");
  if (options.backgroundMusic) {
    const duration = videos.reduce((sum, video) => sum + video.durationMs, 0) / 1000;
    filters.push(backgroundAudioFilter(options.backgroundMusic, duration * 1000, "music"));
    filters.push("[combinedAudio][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=false:latency=true[audio]");
  } else filters.push("[combinedAudio]anull[audio]");
  return filters.join(";");
}

/**
 * Bounded composition primitive, not a registered/paid production job.
 * Produces a NEW local MP4. It does not transcribe, render captions, upload,
 * schedule, or change any source. The final worker must persist/own the output.
 */
export async function composeExploreVideo(options: {
  sourcePath: string;
  demoPath?: string;
  /** Demo-only background layer; preserves the demo's original soundtrack. */
  demoAudioPath?: string;
  /** Explicit user preference; never infer looping from an uploaded filename. */
  demoAudioPlayback?: ExploreBackgroundPlayback;
  /** Approved default/custom background; selected by the handler, never a client URL. */
  backgroundMusicPath?: string;
  /** Repeat only when the selected music is approved as suitable for looping. */
  backgroundMusicPlayback?: ExploreBackgroundPlayback;
  workDir: string;
  tools: CompositionTools;
  subtitleScope?: { language: unknown };
  signal?: AbortSignal;
}) {
  options.signal?.throwIfAborted();
  if (options.demoAudioPath && !options.demoPath) throw new SubtitleError("COMPOSITION_DEMO_REQUIRED", "Add a demo before adding demo audio.");
  if ((!options.demoAudioPath && options.demoAudioPlayback !== undefined) || (!options.backgroundMusicPath && options.backgroundMusicPlayback !== undefined)) {
    throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Select the background audio before choosing its playback mode.");
  }
  const videos = [await probeVideo(options.sourcePath, options.tools, options.signal)];
  if (options.demoPath) videos.push(await probeVideo(options.demoPath, options.tools, options.signal));
  const demoAudio = options.demoAudioPath ? await probeAudio(options.demoAudioPath, options.tools, options.signal) : undefined;
  const backgroundMusic = options.backgroundMusicPath ? await probeAudio(options.backgroundMusicPath, options.tools, options.signal) : undefined;
  const measuredDurationMs = videos.reduce((sum, video) => sum + video.durationMs, 0);
  const demoAudioTiming = demoAudio ? planExploreBackgroundAudio(demoAudio.durationMs, videos[1].durationMs, options.demoAudioPlayback) : null;
  const backgroundMusicTiming = backgroundMusic ? planExploreBackgroundAudio(backgroundMusic.durationMs, measuredDurationMs, options.backgroundMusicPlayback) : null;
  // Before creating outputs or any later paid transcription. This is the
  // complete sequence duration, not the length of the generated opening alone.
  if (options.subtitleScope) assertExploreSubtitleScope(options.subtitleScope.language, measuredDurationMs);
  options.signal?.throwIfAborted();
  const paths = [options.sourcePath, options.demoPath, options.demoAudioPath, options.backgroundMusicPath].filter((path): path is string => Boolean(path));
  const sourceHashes = await Promise.all(paths.map(hashFile));
  const workDir = resolve(options.workDir);
  await mkdir(workDir, { recursive: false });
  for (const [index, path] of paths.entries()) {
    options.signal?.throwIfAborted();
    await copyFile(path, join(workDir, `input-${index}`), constants.COPYFILE_EXCL);
    if (await hashFile(join(workDir, `input-${index}`)) !== sourceHashes[index]) throw new SubtitleError("COMPOSITION_SOURCE_CHANGED", "A source changed while preparing the composition. No output was published.");
  }
  // Probe snapshots too: callers must not replace a selected source while it
  // is copied and accidentally render a different video under the old limits.
  for (const [index, video] of videos.entries()) {
    const snapshot = await probeVideo(join(workDir, `input-${index}`), options.tools, options.signal);
    if (JSON.stringify(snapshot) !== JSON.stringify(video)) throw new SubtitleError("COMPOSITION_SOURCE_CHANGED", "The source changed while preparing the composition. No output was published.");
  }
  let audioIndex = videos.length;
  for (const input of [demoAudio, backgroundMusic]) {
    if (!input) continue;
    if (JSON.stringify(await probeAudio(join(workDir, `input-${audioIndex++}`), options.tools, options.signal)) !== JSON.stringify(input)) {
      throw new SubtitleError("COMPOSITION_SOURCE_CHANGED", "An audio source changed while preparing the composition. No output was published.");
    }
  }
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-n"];
  for (const [index] of paths.entries()) args.push("-protocol_whitelist", "file,pipe", "-i", `input-${index}`);
  args.push("-filter_complex", buildExploreCompositionFilter(videos, demoAudio ? { ...demoAudio, playback: options.demoAudioPlayback } : undefined, {
    backgroundMusic: backgroundMusic ? { ...backgroundMusic, inputIndex: videos.length + (demoAudio ? 1 : 0), playback: options.backgroundMusicPlayback } : undefined,
    subtitleAudio: Boolean(options.subtitleScope),
  }), "-map", "[video]", "-map", "[audio]", "-t", String(measuredDurationMs / 1000),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "composed.mp4");
  if (options.subtitleScope) args.push("-map", "[speech]", "-vn", "-t", String(measuredDurationMs / 1000), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "speech.wav");
  await runMediaCommand(options.tools.ffmpeg, args, { cwd: workDir, signal: options.signal, timeoutMs: 180_000 });
  const outputPath = join(workDir, "composed.mp4");
  // The final sequence can be twice the individual-input limit. Reuse the
  // bounded probe directly instead of the single-input duration validator.
  const { streams, format } = await probeLocal(outputPath, options.tools, options.signal);
  const video = streams.find((stream) => stream.codec_type === "video"), audio = streams.find((stream) => stream.codec_type === "audio");
  const outputDurationMs = Number(video?.duration ?? format.duration) * 1000;
  if (!video || !audio || video.width !== videos[0].width || video.height !== videos[0].height || audio.codec_name !== "aac" ||
      !Number.isFinite(outputDurationMs) || Math.abs(outputDurationMs - measuredDurationMs) > 150) {
    throw new SubtitleError("COMPOSITION_OUTPUT_INVALID", "The composition did not preserve its expected dimensions, duration and soundtrack. No output was published.");
  }
  if (options.subtitleScope) assertExploreSubtitleScope(options.subtitleScope.language, outputDurationMs);
  options.signal?.throwIfAborted();
  return { outputPath, durationMs: outputDurationMs, measuredDurationMs, width: videos[0].width, height: videos[0].height,
    sourceHashes,
    segments: videos.map((video, index) => ({ kind: index === 0 ? "opening" as const : "demo" as const, durationMs: video.durationMs, hasOriginalAudio: video.audioIndex !== null })),
    hasDemoBackgroundAudio: Boolean(demoAudio), hasBackgroundMusic: Boolean(backgroundMusic),
    demoAudioTiming, backgroundMusicTiming,
    subtitleAudioPath: options.subtitleScope ? join(workDir, "speech.wav") : null };
}
