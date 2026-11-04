/** Offline catalog import. --prepare never contacts a provider; --run uses the
 * explicitly authorized ElevenLabs route. Uncertain submissions never retry. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import nextEnv from "@next/env";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

const mode = process.argv[2];
if (!["--prepare", "--run"].includes(mode) || process.argv.slice(3).some(arg => !["--gcp-secret", "--diagnose-rejected"].includes(arg))) throw Error("Use --prepare or --run [--gcp-secret] [--diagnose-rejected].");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const sources = read("lib/explore/talking-head-source-manifest.json").items;
const catalog = read("lib/explore/talking-head-reference-catalog.json").items;
const directory = path.resolve(".tmp/talking-head-scribe-2026-11-04");
fs.mkdirSync(directory, { recursive: true });
const manifestPath = path.join(directory, "manifest.json");
const sourceDigest = hash(JSON.stringify(sources));
const manifest = fs.existsSync(manifestPath) ? read(manifestPath) : { version: 1, sourceDigest, model: "scribe_v2", policy: "talking-head-full-audio-verbatim-v1", createdAt: new Date().toISOString(), items: [] };
if (manifest.sourceDigest !== sourceDigest) throw Error("Frozen source inventory changed; do not overwrite existing requests.");
const save = () => atomicJsonSync(manifestPath, manifest);
for (const source of sources) {
  if (manifest.items.some(item => item.referenceId === source.id)) continue;
  const videoPath = path.resolve(`public${source.file}`);
  if (hash(fs.readFileSync(videoPath)) !== source.sourceSha256) throw Error(`Source mismatch: ${source.id}`);
  const probe = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", videoPath], { encoding: "utf8", windowsHide: true }));
  const seconds = Number(probe.format.duration);
  if (!(seconds > 0 && seconds <= 120)) throw Error(`Unsupported source duration: ${source.id}`);
  const audio = probe.streams.find(stream => stream.codec_type === "audio");
  const item = { referenceId: source.id, sourceSha256: source.sourceSha256, sourceFile: source.file, durationMs: Math.round(seconds * 1000), requestId: randomUUID(), state: "planned" };
  if (!audio) { Object.assign(item, { state: "no_audio" }); manifest.items.push(item); save(); continue; }
  const audioPath = path.join(directory, `${source.id}.wav`);
  execFileSync(ffmpeg, ["-v", "error", "-nostdin", "-y", "-i", videoPath, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", audioPath], { windowsHide: true });
  const bytes = fs.readFileSync(audioPath);
  if (bytes.length < 44 || bytes.length > 4 * 1024 * 1024) throw Error(`Invalid prepared audio: ${source.id}`);
  Object.assign(item, { audioPath: path.relative(process.cwd(), audioPath).replaceAll("\\", "/"), audioSha256: hash(bytes), audioBytes: bytes.length, audioStartTimeSeconds: Number(audio.start_time ?? 0) });
  manifest.items.push(item); save();
}
if (mode === "--prepare") {
  console.log(JSON.stringify({ prepared: manifest.items.length, withAudio: manifest.items.filter(item => item.audioPath).length, seconds: manifest.items.reduce((sum, item) => sum + item.durationMs, 0) / 1000, providerCalls: 0 }));
} else {
  nextEnv.loadEnvConfig(process.cwd());
  let key = process.env.ELEVENLABS_API_KEY?.trim() || process.env.elevenlabs_api_key?.trim();
  if (!key && process.argv.includes("--gcp-secret")) {
    try { key = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "gcloud secrets versions access latest --secret=elevenlabs_api_key --project=ugcsaas --quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim(); }
    catch { throw Error("Could not read configured ElevenLabs credential. No transcription submitted."); }
  }
  if (!key || /[\r\n]/u.test(key)) throw Error("ElevenLabs credential unavailable; no transcription submitted.");
  const diagnostic = process.argv.includes("--diagnose-rejected");
  const diagnosticItem = diagnostic ? manifest.items.find(item => item.state === "rejected" && item.httpStatus === 401) : null;
  if (diagnostic && !diagnosticItem) throw Error("No known rejected authentication request to diagnose.");
  for (const item of manifest.items) {
    if (diagnostic && item !== diagnosticItem) continue;
    if (["completed", "no_audio"].includes(item.state)) continue;
    if (diagnostic && item === diagnosticItem) {
      item.previousAttempts = [...(item.previousAttempts ?? []), { requestId: item.requestId, state: item.state, httpStatus: item.httpStatus, submittedAt: item.submittedAt }];
      Object.assign(item, { requestId: randomUUID(), state: "planned", diagnosticReason: "Known HTTP401 rejection; credential GET user returned200. Capture missing provider error details once, never retry an uncertain submission." }); save();
    }
    if (item.state !== "planned") throw Error(`Existing ${item.state} request for ${item.referenceId}; never resubmit automatically.`);
    const bytes = fs.readFileSync(item.audioPath);
    if (hash(bytes) !== item.audioSha256) throw Error("Prepared audio changed.");
    const body = new FormData();
    body.set("file", new Blob([bytes], { type: "audio/wav" }), "speech.wav");
    body.set("model_id", manifest.model);
    body.set("timestamps_granularity", "word");
    body.set("tag_audio_events", "false");
    body.set("diarize", "false");
    body.set("no_verbatim", "false");
    body.set("temperature", "0");
    Object.assign(item, { state: "uncertain", submittedAt: new Date().toISOString() }); save();
    const started = Date.now();
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body, redirect: "error", signal: AbortSignal.timeout(120_000) });
      if (!response.ok) {
        let detail = {};
        try { detail = (await response.json()).detail ?? {}; } catch { /* Status still proves rejection. */ }
        Object.assign(item, { state: "rejected", httpStatus: response.status, providerErrorCode: typeof detail.status === "string" ? detail.status : null,
          providerErrorMessage: typeof detail.message === "string" ? detail.message.replaceAll(key, "[redacted]").slice(0, 1000) : null, providerRequestId: response.headers.get("request-id") }); save();
        console.log(JSON.stringify({ reference: item.referenceId, httpStatus: item.httpStatus, code: item.providerErrorCode, message: item.providerErrorMessage }));
        throw Error(`ElevenLabs rejected ${item.referenceId} (HTTP ${response.status}); stopped without retry.`);
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > 1024 * 1024) throw Error("Transcript response exceeds limit.");
      const raw = JSON.parse(text);
      const resultPath = path.join(directory, `${item.referenceId}.scribe.json`);
      atomicJsonSync(resultPath, raw);
      Object.assign(item, { state: "completed", responsePath: path.relative(process.cwd(), resultPath).replaceAll("\\", "/"), responseSha256: hash(fs.readFileSync(resultPath)), latencyMs: Date.now() - started, completedAt: new Date().toISOString(), language: raw.language_code, words: raw.words?.filter(word => word.type === "word").length ?? 0 }); save();
      console.log(JSON.stringify({ reference: item.referenceId, state: item.state, language: item.language, words: item.words, ms: item.latencyMs }));
    } catch (error) {
      item.error = { name: error.name, message: item.state === "rejected" ? "Provider rejected request." : "Provider response could not be confirmed; no automatic retry." }; save();
      throw Error(`${item.referenceId}: ${item.error.message}`);
    }
  }
  console.log(JSON.stringify({ completed: manifest.items.filter(item => item.state === "completed").length, noAudio: manifest.items.filter(item => item.state === "no_audio").length, catalogReferences: catalog.length }));
}
