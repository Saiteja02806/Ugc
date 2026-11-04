/** User-authorized, one-time timestamped catalog import (~$0.08/12.97min).
 * Whisper retires 2027-02-26; this is not a production transcription route. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import OpenAI from "openai";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

if (process.argv.length !== 3 || !["--prepare", "--run"].includes(process.argv[2])) throw Error("Use --prepare or --run.");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const prepared = read(".tmp/talking-head-scribe-2026-11-04/manifest.json");
const directory = path.resolve(".tmp/talking-head-openai-2026-11-04");
fs.mkdirSync(directory, { recursive: true });
const manifestPath = path.join(directory, "manifest.json");
const manifest = fs.existsSync(manifestPath) ? read(manifestPath) : { version: 1, sourceDigest: prepared.sourceDigest, model: "whisper-1", policy: "full-source-word-segment-v1", createdAt: new Date().toISOString(), items: prepared.items.map(({ referenceId, sourceSha256, sourceFile, durationMs, audioPath, audioSha256 }) => ({ referenceId, sourceSha256, sourceFile, durationMs, audioPath, audioSha256, requestId: randomUUID(), state: audioPath ? "planned" : "no_audio" })) };
if (manifest.sourceDigest !== prepared.sourceDigest) throw Error("Frozen source inventory changed.");
const save = () => atomicJsonSync(manifestPath, manifest);
save();
if (process.argv[2] === "--prepare") console.log(JSON.stringify({ requests: manifest.items.length, model: manifest.model, estimatedUsd: Number((prepared.items.reduce((n, x) => n + x.durationMs, 0) / 60000 * .006).toFixed(5)) }));
else {
  if (Date.now() >= Date.parse("2027-02-26T00:00:00Z")) throw Error("Import model retired; select a supported aligner.");
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.OPENAI_API_KEY?.trim()) throw Error("OpenAI credential unavailable.");
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 120000 });
  for (const item of manifest.items) {
    if (["completed", "no_audio"].includes(item.state)) continue;
    if (item.state !== "planned") throw Error(`Never automatically repeat ${item.state} request: ${item.referenceId}`);
    if (hash(fs.readFileSync(item.audioPath)) !== item.audioSha256 || hash(fs.readFileSync(`public${item.sourceFile}`)) !== item.sourceSha256) throw Error("Source/audio fingerprint mismatch.");
    Object.assign(item, { state: "uncertain", submittedAt: new Date().toISOString() }); save();
    const start = Date.now();
    try {
      const result = await ai.audio.transcriptions.create({ file: fs.createReadStream(item.audioPath), model: manifest.model, response_format: "verbose_json", timestamp_granularities: ["word", "segment"], temperature: 0 }, { headers: { "X-Client-Request-Id": item.requestId } });
      const responsePath = path.join(directory, `${item.referenceId}.json`);
      atomicJsonSync(responsePath, result);
      Object.assign(item, { state: "completed", responsePath: path.relative(process.cwd(), responsePath).replaceAll("\\", "/"), responseSha256: hash(fs.readFileSync(responsePath)), latencyMs: Date.now() - start, words: result.words?.length ?? 0, language: result.language, completedAt: new Date().toISOString() }); save();
      console.log(JSON.stringify({ reference: item.referenceId, words: item.words, language: item.language, ms: item.latencyMs }));
    } catch (error) {
      Object.assign(item, { error: { status: error.status ?? null, code: error.code ?? null }, ...(error.status && error.status >= 400 && error.status < 500 && error.status !== 408 ? { state: "rejected" } : {}) }); save();
      throw Error(`${item.referenceId}: transcription ${item.state} (HTTP ${error.status ?? "unknown"}); no automatic retry.`);
    }
  }
  console.log(JSON.stringify({ completed: manifest.items.filter(item => item.state === "completed").length }));
}
