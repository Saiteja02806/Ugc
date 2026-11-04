/** Frozen six-case/twelve-call experiment. No app receipts or media generation. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import OpenAI from "openai";
import { TALKING_HEAD_SCRIPT_SYSTEM, TALKING_HEAD_SCRIPT_PROMPT_VERSION, talkingHeadScriptRemixPayload, validateTalkingHeadScriptOutput } from "../lib/explore/talking-head-script-remix.ts";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

const mode = process.argv[2];
if (process.argv.length !== 3 || !["--prepare", "--verify-transcripts", "--run"].includes(mode)) throw Error("Use --prepare, --verify-transcripts, or --run.");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const baselineDirectory = path.resolve(".tmp/talking-head-script-comparison-20261104");
const directory = TALKING_HEAD_SCRIPT_PROMPT_VERSION === 1 ? baselineDirectory : path.join(baselineDirectory, `v${TALKING_HEAD_SCRIPT_PROMPT_VERSION}`); fs.mkdirSync(directory, { recursive: true });
const asr = read(".tmp/talking-head-openai-2026-11-04/manifest.json");
const pilot = [
  { referenceId: "talking-websites-explainer", endMs: 2740, endText: "about." },
  { referenceId: "talking-studyfetchlauren", endMs: 10860, endText: "Let me show you." },
  { referenceId: "talking-studywithsab", endMs: 44380, endText: "so here's how I study in the most efficient way." },
].map(source => {
  const row = asr.items.find(item => item.referenceId === source.referenceId && item.state === "completed");
  if (!row) throw Error("Pilot needs real completed source transcription.");
  const raw = read(row.responsePath), end = raw.text.indexOf(source.endText);
  if (end < 0) throw Error("Pilot source ending changed.");
  return { ...source, sourceSha256: row.sourceSha256, text: raw.text.slice(0, end + source.endText.length).trim(), audioPath: row.audioPath, transcriptSha256: row.responseSha256 };
});
const contexts = [
  { id: "saved-ugc-business", context: read(".tmp/hook-remix-pilot-context.json").business_context },
  { id: "fictional-language-app-fixture", context: { businessName: "LinguaLoop", productSummary: "An app offering English conversation practice, pronunciation feedback and guided speaking exercises.", targetAudience: "Busy adults learning English", claimsToAvoid: ["Guaranteed fluency", "Exam score promises", "Income claims", "Official school endorsement", "Free access or instant results"] } },
];
const allCases = pilot.flatMap(source => contexts.map(context => ({ caseId: `${source.referenceId}:${context.id}`, source, context, user: talkingHeadScriptRemixPayload(source.text, context.context) })));
const inputs = { promptVersion: TALKING_HEAD_SCRIPT_PROMPT_VERSION, system: TALKING_HEAD_SCRIPT_SYSTEM, reasoning: "medium", models: ["gpt-6-luna", "gpt-6.1-terra"], cases: TALKING_HEAD_SCRIPT_PROMPT_VERSION === 1 ? allCases : allCases.filter(item => item.source.referenceId === "talking-studyfetchlauren" || item.caseId === "talking-websites-explainer:saved-ugc-business") };
const file = path.join(directory, "manifest.json");
const baseline = TALKING_HEAD_SCRIPT_PROMPT_VERSION > 1 ? read(path.join(baselineDirectory, "manifest.json")) : null;
const manifest = fs.existsSync(file) ? read(file) : { createdAt: new Date().toISOString(), inputDigest: digest(inputs), ...inputs, verifications: baseline ? baseline.verifications : pilot.map(source => ({ referenceId: source.referenceId, requestId: randomUUID(), state: "planned" })), requests: inputs.cases.flatMap(item => inputs.models.map(model => ({ caseId: item.caseId, model, requestId: randomUUID(), state: "planned" }))) };
if (manifest.inputDigest !== digest(inputs)) throw Error("Frozen inputs changed; never overwrite prior paid experiment.");
const save = () => atomicJsonSync(file, manifest); save();
if (mode === "--prepare") console.log(JSON.stringify({ cases: inputs.cases.length, modelCalls: manifest.requests.length, models: inputs.models, reasoning: inputs.reasoning }));
else {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.OPENAI_API_KEY?.trim()) throw Error("Provider credential unavailable.");
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 120000 });
  const requests = mode === "--verify-transcripts" ? manifest.verifications : manifest.requests;
  for (const row of requests) {
    if (row.state === "completed") continue;
    if (row.state !== "planned") throw Error("Uncertain/failed request cannot be automatically repeated.");
    Object.assign(row, { state: "uncertain", submittedAt: new Date().toISOString() }); save();
    const start = Date.now();
    try {
      if (mode === "--verify-transcripts") {
        const source = pilot.find(item => item.referenceId === row.referenceId);
        const response = await ai.audio.transcriptions.create({ file: fs.createReadStream(source.audioPath), model: "gpt-transcribe" }, { headers: { "X-Client-Request-Id": row.requestId } });
        Object.assign(row, { state: "completed", response, latencyMs: Date.now() - start });
        console.log(JSON.stringify({ reference: row.referenceId, verifiedTranscript: response.text }));
      } else {
        if (!manifest.verifications.every(item => item.state === "completed")) throw Error("Complete independent transcript checks before Remix comparison.");
        const input = inputs.cases.find(item => item.caseId === row.caseId);
        const response = await ai.responses.create({ model: row.model, reasoning: { effort: "medium" }, instructions: inputs.system, input: input.user, max_output_tokens: 4000, store: false,
          text: { format: { type: "json_schema", name: "talking_head_script", strict: true, schema: { type: "object", properties: { script: { type: "string" } }, required: ["script"], additionalProperties: false } } } }, { headers: { "X-Client-Request-Id": row.requestId } });
        Object.assign(row, { state: "completed", responseId: response.id, responseModel: response.model, rawContent: response.output_text, usage: response.usage, status: response.status, latencyMs: Date.now() - start }); save();
        try { if (response.status !== "completed") throw Error("Incomplete output."); row.output = validateTalkingHeadScriptOutput(JSON.parse(response.output_text), input.source.text); row.validationError = null; }
        catch (error) { row.validationError = error.message; }
        console.log(JSON.stringify({ caseId: row.caseId, model: row.model, output: row.output ?? null, error: row.validationError, ms: row.latencyMs }));
      }
      save();
    } catch (error) {
      row.error = { status: error.status ?? null, code: error.code ?? null, message: "Request could not be confirmed; no automatic retry." }; save();
      throw Error(`Experiment halted: ${row.requestId}. HTTP ${error.status ?? "unknown"}; no retry.`);
    }
  }
}
