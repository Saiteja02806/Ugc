import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runMediaCommand } from "../subtitles/media.js";
import { planExploreBackgroundAudio } from "./explore-background-audio.js";

export async function verifyReferenceAudioFile(file: string, sha256: string) {
  if (createHash("sha256").update(await readFile(file)).digest("hex") !== sha256) throw new Error("The paired reference MP3 does not match the registered audio.");
}

/** Copy the video stream unchanged; replace generated sound or preserve the clean demo speech. */
export async function renderExploreReferenceAudio(input: {
  sourcePath: string; audioPath: string; workDir: string; volume: number; replaceOriginal: boolean;
  tools: { ffmpeg: string; ffprobe: string }; signal?: AbortSignal;
}) {
  if (!Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1) throw new Error("Choose a valid reference music volume.");
  const probe = async (file: string) => JSON.parse((await runMediaCommand(input.tools.ffprobe,
    ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", file], { signal: input.signal })).stdout) as {
      streams: { codec_type: string; duration?: string; width?: number; height?: number }[]; format: { duration: string };
    };
  const video = await probe(input.sourcePath), audio = await probe(input.audioPath);
  const stream = video.streams.find(s => s.codec_type === "video"), audioStream = audio.streams.find(s => s.codec_type === "audio");
  const durationSeconds = Number(stream?.duration ?? video.format.duration);
  if (!stream || !audioStream) throw new Error("The reference soundtrack needs a playable video and MP3.");
  const timing = planExploreBackgroundAudio(Number(audioStream.duration ?? audio.format.duration) * 1000, durationSeconds * 1000, "repeat");
  const seconds = String(durationSeconds), fade = timing.fadeDurationMs / 1000;
  const filters = [`[1:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,atrim=duration=${seconds},volume=${input.volume},afade=t=in:st=0:d=${fade},afade=t=out:st=${durationSeconds - fade}:d=${fade}[music]`];
  if (!input.replaceOriginal && video.streams.some(s => s.codec_type === "audio")) {
    filters.push(`[0:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${seconds},asetpts=PTS-STARTPTS[original]`);
    filters.push("[original][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=false:latency=true[audio]");
  } else filters.push("[music]anull[audio]");
  const filterPath = join(input.workDir, "reference-audio.filter");
  await writeFile(filterPath, filters.join(";"), { flag: "wx" });
  const outputPath = join(input.workDir, "reference-audio.mp4");
  await runMediaCommand(input.tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,pipe", "-i", input.sourcePath,
    "-stream_loop", "-1", "-protocol_whitelist", "file,pipe", "-i", input.audioPath,
    "-filter_complex_script", filterPath, "-map", "0:v:0", "-map", "[audio]", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-t", seconds, "-movflags", "+faststart", outputPath], { signal: input.signal });
  const rendered = await probe(outputPath), finalVideo = rendered.streams.find(s => s.codec_type === "video");
  if (!finalVideo || !rendered.streams.some(s => s.codec_type === "audio") || finalVideo.width !== stream.width || finalVideo.height !== stream.height ||
      Math.abs(Number(finalVideo.duration ?? rendered.format.duration) - durationSeconds) > .15) throw new Error("The reference audio export changed the video's timing or dimensions.");
  return { outputPath, durationSeconds, timing };
}
