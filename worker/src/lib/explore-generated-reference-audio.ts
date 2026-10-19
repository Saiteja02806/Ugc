import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ExploreFinishingStorage } from "./explore-finishing-storage.js";
import { renderExploreReferenceAudio, verifyReferenceAudioFile } from "./explore-reference-audio-render.js";
import type { getExplorePairedReference } from "./explore-reference-soundtrack.js";
import { isSilentExploreReference } from "./explore-reference-soundtrack.js";
import { runMediaCommand } from "../subtitles/media.js";

/** Final silent deliverable, including providers without an audio-disable flag. */
export async function silenceGeneratedVideo(buffer: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), "ugc-explore-silent-"));
  try {
    const source = join(directory, "source.mp4"), output = join(directory, "silent.mp4");
    await writeFile(source, buffer, { flag: "wx" });
    await runMediaCommand(process.env.FFMPEG_PATH || "ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,pipe", "-i", source,
      "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", output]);
    return await readFile(output);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** A local post-process of the completed provider output; never asks an AI to reproduce the song. */
export async function applyGeneratedReferenceAudio(buffer: Buffer, reference: NonNullable<ReturnType<typeof getExplorePairedReference>>) {
  const directory = await mkdtemp(join(tmpdir(), "ugc-explore-reference-"));
  try {
    const sourcePath = join(directory, "generated.mp4"), audioPath = join(directory, "reference.mp3");
    await writeFile(sourcePath, buffer, { flag: "wx" });
    if (isSilentExploreReference(reference)) {
      const outputPath = join(directory, "silent.mp4");
      await runMediaCommand(process.env.FFMPEG_PATH || "ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-n",
        "-protocol_whitelist", "file,pipe", "-i", sourcePath, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", outputPath]);
      return await readFile(outputPath);
    }
    await new ExploreFinishingStorage().download(reference.audioStorageKey, audioPath, 50 * 1024 ** 2);
    await verifyReferenceAudioFile(audioPath, reference.audioSha256);
    const result = await renderExploreReferenceAudio({ sourcePath, audioPath, workDir: directory, volume: .2, replaceOriginal: true,
      tools: { ffmpeg: process.env.FFMPEG_PATH || "ffmpeg", ffprobe: process.env.FFPROBE_PATH || "ffprobe" } });
    return await readFile(result.outputPath);
  } finally {
    if (resolve(directory).startsWith(resolve(tmpdir()) + "/") || resolve(directory).startsWith(resolve(tmpdir()) + "\\")) await rm(directory, { recursive: true, force: true });
  }
}
