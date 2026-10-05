/** Standalone local pilot. Not imported by a production app route or worker. */
import { constants, createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rmdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { probeVideo, extractSubtitleAudio, runMediaCommand } from "../../worker/dist/subtitles/media.js";
import { SubtitleError, parseStyle, parsePlacement, validateTranscript } from "../../worker/dist/subtitles/contracts.js";
import { generateSubtitles } from "../../worker/dist/subtitles/generate.js";
import { digest, getTextCheckpoint, atomicJson } from "./cache.mjs";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const PILOT_MAX_BYTES = 50 * 1024 * 1024;
export const PILOT_MAX_DURATION_MS = 30000;
export const defaultTools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: resolve(root, "worker/src/assets/fonts") };
export const defaultPython = resolve(root, process.platform === "win32" ? ".tmp/subtitle-alignment-venv/Scripts/python.exe" : ".tmp/subtitle-alignment-venv/bin/python");
export const defaultModels = resolve(root, ".tmp/subtitle-alignment-models");
const alignmentScript = resolve(root, "scripts/subtitle-align.py");
const modelWeightName = "wav2vec2_fairseq_base_ls960_asr_ls960.pth";
const modelWeightHash = "488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d";

export function alignmentEnvironment(environment = process.env) {
  const allowed = new Set(["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOME", "LOCALAPPDATA", "APPDATA", "LD_LIBRARY_PATH"]);
  const isolated = Object.fromEntries(Object.entries(environment).filter(([key]) => allowed.has(key.toUpperCase())));
  return { ...isolated, PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1", HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", TORCH_FORCE_WEIGHTS_ONLY_LOAD: "1", OMP_NUM_THREADS: "4" };
}

async function hashFile(path) {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function checkPilotRuntime({ python = defaultPython, modelDir = defaultModels } = {}) {
  try {
    if (!(await stat(python)).isFile() || !(await stat(join(modelDir, modelWeightName))).isFile()) throw new Error();
    if (await hashFile(join(modelDir, modelWeightName)) !== modelWeightHash) throw new Error();
    await runMediaCommand(python, ["-c", "from importlib.metadata import version; assert version('whisperx') == '3.8.6'; import torch, torchaudio; import whisperx.alignment"], { timeoutMs: 60000, env: alignmentEnvironment() });
  } catch { throw new SubtitleError("ALIGNMENT_RUNTIME_MISSING", "The private WhisperX runtime/model is unavailable. Follow the subtitle pilot setup guide before starting it."); }
}

async function transcribeText(audioPath, apiKey, signal) {
  if (!apiKey?.trim()) throw new SubtitleError("PROVIDER_KEY_MISSING", "OPENAI_API_KEY is missing from the local server environment.");
  signal?.throwIfAborted();
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120000 });
  try {
    const response = await client.audio.transcriptions.create({ file: createReadStream(audioPath), model: "gpt-transcribe", language: "en", response_format: "json" }, { signal });
    return response.text;
  } catch (error) {
    if (signal?.aborted) throw new SubtitleError("CANCELLED", "Generation was stopped. A submitted transcription may still have been charged.");
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    throw new SubtitleError(status === 401 ? "PROVIDER_AUTH_FAILED" : status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_REQUEST_FAILED",
      `OpenAI transcription failed${status ? ` (HTTP ${status})` : ""}. No automatic paid retry was made.`);
  }
}

export async function runPilotGeneration({ inputPath, jobDir, cacheDir, style, placement = "bottom", apiKey,
  python = defaultPython, modelDir = defaultModels, tools = defaultTools, signal, onStage = () => {},
  // Test seams never become browser request options.
  submitText, align } = {}) {
  const start = performance.now();
  parseStyle(style); parsePlacement(placement);
  signal?.throwIfAborted();
  onStage("checking_video");
  if ((await stat(inputPath)).size > PILOT_MAX_BYTES) throw new SubtitleError("VIDEO_SIZE_INVALID", "Choose a video smaller than 50 MB.");
  const initial = await probeVideo(inputPath, tools, signal);
  if (initial.durationMs > PILOT_MAX_DURATION_MS) throw new SubtitleError("VIDEO_DURATION_INVALID", "This pilot supports English videos up to 30 seconds.");
  await mkdir(jobDir, { recursive: false });
  const snapshot = join(jobDir, "source.mp4");
  await copyFile(inputPath, snapshot, constants.COPYFILE_EXCL);
  const info = await probeVideo(snapshot, tools, signal);
  const sourceHash = await hashFile(snapshot);
  // The pilot accepts the usual zero-origin timeline. Refuse differing stream
  // origins until audio-to-video offset handling has an explicit test.
  const offsets = JSON.parse((await runMediaCommand(tools.ffprobe, ["-v", "error", "-show_entries", "stream=index,start_time", "-of", "json", snapshot], { signal })).stdout).streams;
  const videoStart = Number(offsets.find(s => s.index === info.videoIndex)?.start_time ?? 0);
  const audioStart = Number(offsets.find(s => s.index === info.audioIndex)?.start_time ?? 0);
  if (!Number.isFinite(videoStart) || !Number.isFinite(audioStart) || Math.abs(videoStart) > 1e-6 || Math.abs(audioStart) > 1e-6) {
    throw new SubtitleError("TIMELINE_UNSUPPORTED", "This video's track start times need additional timing validation. Choose a video whose tracks start together.");
  }
  onStage("preparing_audio");
  const audio = join(jobDir, "audio.wav");
  await extractSubtitleAudio(snapshot, audio, info, tools, signal);
  const audioHash = await hashFile(audio);
  onStage("transcribing");
  const text = await getTextCheckpoint({ cacheDir: join(cacheDir, "text"), audioHash, signal,
    submit: () => submitText ? submitText(audio, signal) : transcribeText(audio, apiKey, signal) });
  signal?.throwIfAborted();
  const textPath = join(jobDir, "gpt-transcript.json");
  await atomicJson(textPath, { model: "gpt-transcribe", text: text.text, audioHash });
  const alignKey = digest(JSON.stringify(["observed-characters-v1", audioHash, info.durationMs, digest(text.text), digest(await readFile(alignmentScript)), modelWeightHash]));
  const alignCacheDir = join(cacheDir, "alignment");
  await mkdir(alignCacheDir, { recursive: true });
  const alignCache = join(alignCacheDir, `${alignKey}.json`), lock = `${alignCache}.lock`;
  try { await mkdir(lock); } catch (error) {
    if (error.code === "EEXIST") throw new SubtitleError("ALREADY_RUNNING", "This recording is already being aligned.");
    throw error;
  }
  let transcript, alignmentCacheHit = false;
  try {
    onStage("aligning_words");
    let saved;
    try { saved = JSON.parse(await readFile(alignCache, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw new SubtitleError("CACHE_INVALID", "The local alignment cache needs inspection."); }
    if (saved) {
      if (saved.alignKey !== alignKey) throw new SubtitleError("CACHE_INVALID", "The saved alignment does not match the audio/transcript.");
      transcript = validateTranscript(saved.transcript, info.durationMs); alignmentCacheHit = true;
    } else {
      const alignDir = join(jobDir, "aligned");
      if (align) transcript = await align({ audio, text: text.text, durationMs: info.durationMs, signal });
      else {
        try {
          await runMediaCommand(python, [alignmentScript, "--audio", audio, "--text-json", textPath, "--output-dir", alignDir, "--model-dir", modelDir, "--offline"], { signal, timeoutMs: 180000, env: alignmentEnvironment() });
          transcript = JSON.parse(await readFile(join(alignDir, "transcript.json"), "utf8"));
        } catch (error) {
          if (signal?.aborted) throw error;
          throw new SubtitleError("ALIGNMENT_REVIEW_REQUIRED", "Some words could not be timed reliably. This pilot supports English letters and apostrophes; numbers and other languages still need validation. The transcript is saved, so another style will not repeat the paid request.");
        }
      }
      transcript = validateTranscript(transcript, info.durationMs);
    }
    if (transcript.words.map(w => w.text).join(" ") !== text.text.trim().split(/\s+/u).join(" ") ||
        transcript.words.some((word, index) => index > 0 && word.startMs < transcript.words[index - 1].endMs)) {
      throw new SubtitleError(alignmentCacheHit ? "CACHE_INVALID" : "ALIGNMENT_REVIEW_REQUIRED", "The aligned words or intervals do not match the saved transcription. No subtitle result was published.");
    }
    if (!alignmentCacheHit) await atomicJson(alignCache, { alignKey, transcript });
  } finally { await rmdir(lock); }
  signal?.throwIfAborted();
  const result = await generateSubtitles({ inputPath: snapshot, outputDir: join(jobDir, "result"), cacheDir: join(cacheDir, "render-transcripts"),
    style, placement, tools, signal, provider: { id: `gpt-whisperx:${alignKey}`, transcribe: async () => transcript },
    onStage: stage => { if (stage === "rendering") onStage("rendering_video"); } });
  signal?.throwIfAborted();
  if (result.sourceHash !== sourceHash || await hashFile(snapshot) !== sourceHash) throw new SubtitleError("SOURCE_CHANGED", "The source changed during generation. No result was attached.");
  const summary = { ...result, transcriptionCacheHit: text.cacheHit, alignmentCacheHit, elapsedMs: Math.round(performance.now() - start),
    transcriptModel: "gpt-transcribe", alignmentModel: "WhisperX 3.8.6 / WAV2VEC2_ASR_BASE_960H", evaluationOnly: true };
  await atomicJson(join(jobDir, "generation.json"), summary);
  onStage("completed");
  return summary;
}
