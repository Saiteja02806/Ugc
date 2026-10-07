import { groupNaturalSubtitleWords } from "./phrases.js";
import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { getSubtitleLayout, groupSubtitleWords, serializeAss, serializeSrt, serializeVtt } from "./captions.js";
import { SUBTITLE_VERSION, SubtitleError, parsePlacement, parseStyle, record, validateTranscript, type SubtitlePlacement, type SubtitleStyle, type SubtitleTranscript } from "./contracts.js";
import { createTextMeasurer, extractSubtitleAudio, prepareSubtitleFonts, probeVideo, renderSubtitleVideo, type SubtitleTools } from "./media.js";
import type { TranscriptionProvider } from "./openai-provider.js";

import { EDITORIAL_RENDER_VERSION, planEditorialPages, serializeEditorialAss } from "./editorial.js";
import { createEditorialMeasurer, prepareEditorialFonts } from "./editorial-media.js";
import { createDynamicMeasurer, serializeDynamicAss } from "./dynamic.js";
import { isDynamicSubtitleStyle, subtitleStyleDefinition } from "./styles.js";


export type GenerateSubtitlesInput = {
  inputPath: string;
  /** Must not already exist. This API never replaces the original or an old output. */
  outputDir: string;
  cacheDir: string;
  style: SubtitleStyle;
  placement: SubtitlePlacement;
  provider: TranscriptionProvider;
  tools: SubtitleTools;
  signal?: AbortSignal;
  onStage?: (stage: "probing" | "extracting_audio" | "transcribing" | "rendering" | "completed") => void;
};

async function hashFile(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function atomicJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

/** A local cache, not a production ownership/authentication boundary. */
export async function getCachedTranscript(params: {
  sourceHash: string; durationMs: number; cacheDir: string; provider: TranscriptionProvider;
  audioPath: string; signal?: AbortSignal;
}): Promise<{ transcript: SubtitleTranscript; cacheHit: boolean }> {
  const cacheKey = createHash("sha256").update(JSON.stringify([SUBTITLE_VERSION, params.sourceHash, params.provider.id])).digest("hex");
  await mkdir(params.cacheDir, { recursive: true });
  const path = join(params.cacheDir, `${cacheKey}.json`);
  const lock = join(params.cacheDir, `${cacheKey}.lock`);
  try { await mkdir(lock); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new SubtitleError("ALREADY_RUNNING", "This video transcription is already running. Inspect stale locks before removing them.");
    throw error;
  }
  try {
    let saved: Record<string, unknown> | undefined;
    try { saved = record(JSON.parse(await readFile(path, "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new SubtitleError("CACHE_INVALID", "The transcription cache is invalid. Inspect it before retrying."); }
    if (saved) {
      if (saved.sourceHash !== params.sourceHash || saved.providerId !== params.provider.id || saved.version !== SUBTITLE_VERSION) throw new SubtitleError("CACHE_INVALID", "The transcription cache identity does not match this request.");
      if (saved.status === "no_speech") throw new SubtitleError("NO_SPEECH", "No speech detected.");
      if (saved.status === "rejected") throw new SubtitleError("TRANSCRIPT_REJECTED", "This provider previously returned unusable transcription or word timings. Review the recording or select another provider; no paid retry was made.");
      if (saved.status !== "completed") throw new SubtitleError("TRANSCRIPTION_UNCERTAIN", "A previous transcription did not save a result. Check provider usage before explicitly clearing its cache; it will not be submitted twice automatically.");
      return { transcript: validateTranscript(saved.transcript, params.durationMs), cacheHit: true };
    }
    params.signal?.throwIfAborted();
    const identity = { version: SUBTITLE_VERSION, sourceHash: params.sourceHash, providerId: params.provider.id };
    await atomicJson(path, { ...identity, status: "submitting", startedAt: new Date().toISOString() });
    let transcript: SubtitleTranscript;
    try {
      transcript = validateTranscript(await params.provider.transcribe(params.audioPath, params.durationMs, params.signal), params.durationMs);
    } catch (error) {
      if (error instanceof SubtitleError && error.code === "NO_SPEECH") await atomicJson(path, { ...identity, status: "no_speech" });
      else if (error instanceof SubtitleError && ["TRANSCRIPT_UNRELIABLE", "WORD_TIMINGS_UNRELIABLE", "WORD_TIMINGS_UNAVAILABLE", "PROVIDER_RESPONSE_INVALID", "INVALID_TIMESTAMPS", "INVALID_TRANSCRIPT"].includes(error.code)) {
        await atomicJson(path, { ...identity, status: "rejected", errorCode: error.code });
      }
      throw error;
    }
    await atomicJson(path, { ...identity, status: "completed", transcript });
    return { transcript, cacheHit: false };
  } finally { await rmdir(lock); }
}

export async function generateSubtitles(input: GenerateSubtitlesInput) {
  const style = parseStyle(input.style), placement = parsePlacement(input.placement);
  const inputPath = resolve(input.inputPath), outputDir = resolve(input.outputDir);
  const workDir = await mkdtemp(join(tmpdir(), "ugc-subtitles-"));
  let ownsOutputDir = false;
  try {
    input.signal?.throwIfAborted();
    input.onStage?.("probing");
    // Reject oversized/invalid sources before copying or making a paid request.
    await probeVideo(inputPath, input.tools, input.signal);
    try { await mkdir(outputDir); ownsOutputDir = true; } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new SubtitleError("OUTPUT_EXISTS", "Choose a new output directory. Existing files are never overwritten.");
      throw error;
    }
    await copyFile(inputPath, join(workDir, "source-video"));
    const video = await probeVideo(join(workDir, "source-video"), input.tools, input.signal);
    const sourceHash = await hashFile(join(workDir, "source-video"));
    if (style === "editorial") await prepareEditorialFonts(input.tools, workDir);
    else await prepareSubtitleFonts(input.tools, workDir);

    input.onStage?.("extracting_audio");
    const audioPath = join(workDir, "audio.wav");
    await extractSubtitleAudio(join(workDir, "source-video"), audioPath, video, input.tools, input.signal);
    input.onStage?.("transcribing");
    const { transcript, cacheHit } = await getCachedTranscript({ sourceHash, durationMs: video.durationMs,
      cacheDir: resolve(input.cacheDir), provider: input.provider, audioPath, signal: input.signal });
    const layout = style === "editorial"
      ? { width: video.width, height: video.height, fontSize: Math.max(16, Math.round(64 * Math.min(video.width / 720, video.height / 1280))), maxLineWidth: Math.floor(video.width * .8), bold: false }
      : getSubtitleLayout(video.width, video.height, style);
    let cues, ass;
    if (style === "editorial") {
      if (transcript.language !== "en") throw new SubtitleError("EDITORIAL_LANGUAGE_UNSUPPORTED", "Editorial phrase grouping currently supports English. Choose another style.");
      const measure = createEditorialMeasurer(layout, input.tools, workDir, input.signal);
      cues = await groupNaturalSubtitleWords(transcript.words, layout, text => measure(text, layout.fontSize, "lead").then(ink => ink.width));
      const pages = await planEditorialPages(cues, layout, placement, measure);
      ass = serializeEditorialAss(pages, layout);
      await writeFile(join(workDir, "layout.json"), JSON.stringify({ version: EDITORIAL_RENDER_VERSION, pages }, null, 2));
    } else if (isDynamicSubtitleStyle(style)) {
      cues = await groupSubtitleWords(transcript.words, layout, createTextMeasurer(layout, input.tools));
      ass = await serializeDynamicAss(cues, layout, style as "word-pop" | "karaoke" | "marker-highlight", placement,
        createDynamicMeasurer(layout, input.tools, workDir, input.signal));
    } else {
      cues = await groupSubtitleWords(transcript.words, layout, createTextMeasurer(layout, input.tools));
      ass = serializeAss(cues, layout, style, placement);
    }

    input.signal?.throwIfAborted();
    await writeFile(join(workDir, "captions.ass"), ass);

    input.onStage?.("rendering");
    await renderSubtitleVideo(workDir, video, input.tools, input.signal);
    await Promise.all([
      writeFile(join(workDir, "captions.srt"), serializeSrt(cues)),
      writeFile(join(workDir, "captions.vtt"), serializeVtt(cues)),
      writeFile(join(workDir, "transcript.json"), JSON.stringify(transcript, null, 2), { mode: 0o600 }),
    ]);
    input.signal?.throwIfAborted();
    // The directory is new and owned by this run. Publish the manifest last as the completion marker.
    for (const file of ["captioned.mp4", "captions.ass", "captions.srt", "captions.vtt", "transcript.json", ...(style === "editorial" ? ["layout.json"] : [])]) {
      input.signal?.throwIfAborted();
      await copyFile(join(workDir, file), join(outputDir, file), constants.COPYFILE_EXCL);
    }
    const result = { version: SUBTITLE_VERSION, sourceHash, providerId: input.provider.id, style,
      placement, renderVersion: subtitleStyleDefinition(style).renderVersion, durationMs: video.durationMs, width: video.width, height: video.height,
      wordCount: transcript.words.length, cueCount: cues.length, cacheHit,
      videoPath: join(outputDir, "captioned.mp4"), outputDir };
    input.signal?.throwIfAborted();
    await writeFile(join(outputDir, "manifest.json"), JSON.stringify(result, null, 2), { flag: "wx" });
    input.onStage?.("completed");
    return result;
  } catch (error) {
    // Never recursively remove a caller-supplied output directory. Remove it only if still empty.
    if (ownsOutputDir) await rmdir(outputDir).catch(() => undefined);
    if (input.signal?.aborted) throw new SubtitleError("CANCELLED", "Subtitle generation was cancelled.");
    throw error;
  } finally {
    // Verify the resolved recursive-delete target even though it came from mkdtemp.
    if (dirname(resolve(workDir)) === resolve(tmpdir()) && basename(workDir).startsWith("ugc-subtitles-")) {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
