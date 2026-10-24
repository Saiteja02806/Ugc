/* Explicit local provider experiment; never invoked by the application or test suite. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { RemixOutputSchema, validateRemixOutput } from "../lib/explore/reference-text.ts";
import { hookRemixResult } from "../lib/explore/hook-remix-source.ts";
import { REMIX_TEXT_SYSTEM_PROMPT, remixTextSystemPrompt, remixTextPrompt } from "../lib/explore/remix-text-prompt.ts";
import { HOOK_SOURCE_VOICE_SYSTEM_PROMPT, hookSourceVoiceSystemPrompt } from "../lib/explore/hook-remix-source-voice-prompt.ts";
import { HOOK_MINIMAL_REMIX_SYSTEM_PROMPT, hookMinimalRemixSystemPrompt } from "../lib/explore/hook-remix-minimal-prompt.ts";
import { HOOK_ROLE_REMIX_SYSTEM_PROMPT, hookRoleRemixSystemPrompt } from "../lib/explore/hook-remix-role-prompt.ts";

const args = process.argv.slice(2);
if (args.some(arg => !["--prepare", "--run", "--followup", "--source-voice", "--minimal", "--roles"].includes(arg)) || args.filter(arg => arg === "--prepare" || arg === "--run").length !== 1 || new Set(args).size !== args.length || args.filter(arg => ["--followup", "--source-voice", "--minimal", "--roles"].includes(arg)).length > 1) throw Error("Use --prepare or --run with at most one candidate mode: --followup, --source-voice, --minimal or --roles.");
const followup = args.includes("--followup");
const sourceVoice = args.includes("--source-voice"), minimal = args.includes("--minimal"), roles = args.includes("--roles"), candidateOnly = followup || sourceVoice || minimal || roles;
const dir = path.resolve(roles ? ".tmp/hook-remix-role-v7" : minimal ? ".tmp/hook-remix-minimal-v6" : sourceVoice ? ".tmp/hook-remix-source-voice-v5" : followup ? ".tmp/hook-remix-prompt-followup" : ".tmp/hook-remix-prompt-pilot"), manifestPath = path.join(dir, "manifest.json");
const samples = JSON.parse(fs.readFileSync("docs/hook-remix-quality-samples-2026-10-23.json", "utf8")).records;
const context = JSON.parse(fs.readFileSync(".tmp/hook-remix-pilot-context.json", "utf8"));
const hash = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
if (samples.length !== 12 || samples.some(row => row.model !== context.model)) throw Error("Expected the audited twelve examples and their original model.");
const conditions = { baseline: REMIX_TEXT_SYSTEM_PROMPT, candidate: roles ? HOOK_ROLE_REMIX_SYSTEM_PROMPT : minimal ? HOOK_MINIMAL_REMIX_SYSTEM_PROMPT : sourceVoice ? HOOK_SOURCE_VOICE_SYSTEM_PROMPT : remixTextSystemPrompt("hook") };
const cases = samples.map(row => {
  const normalized = hookRemixResult(row.output, row.source);
  return { savedRequestKey: row.request_key, source: normalized.source, historicalOutput: normalized.output,
    historicalPromptVersion: row.promptVersion, userMessage: remixTextPrompt(normalized.source, context.business_context, row.instructions),
    ...(candidateOnly ? { candidateSystemPrompt: roles ? hookRoleRemixSystemPrompt(normalized.source) : minimal ? hookMinimalRemixSystemPrompt(normalized.source) : sourceVoice ? hookSourceVoiceSystemPrompt(normalized.source) : remixTextSystemPrompt("hook", normalized.source) } : {}) };
});
const inputs = { model: context.model, reasoning_effort: "low", max_completion_tokens: 4000,
  businessProfileVersion: context.business_profile_version, contextDigest: hash(context.business_context), conditions, cases };
const previousComparison = sourceVoice || minimal || roles ? JSON.parse(fs.readFileSync("docs/hook-remix-prompt-comparison-2026-10-23.json", "utf8")) : null;
const previousFollowup = sourceVoice || minimal || roles ? JSON.parse(fs.readFileSync("docs/hook-remix-prompt-followup-2026-10-23.json", "utf8")) : null;
const previousVoice = minimal || roles ? JSON.parse(fs.readFileSync("docs/hook-remix-source-voice-v5-results-2026-10-23.json", "utf8")) : null;
const previousMinimal = roles ? JSON.parse(fs.readFileSync("docs/hook-remix-minimal-v6-results-2026-10-23.json", "utf8")) : null;
if ((sourceVoice || minimal || roles) && (previousComparison.model !== inputs.model || previousComparison.contextDigest !== inputs.contextDigest || cases.some(sample => sample.userMessage !== previousComparison.examples.find(row => row.savedRequestKey === sample.savedRequestKey)?.userMessage))) throw Error("Model, business context or user messages differ from the original comparison; no new request sent.");
fs.mkdirSync(dir, { recursive: true });
let manifest;
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.inputDigest !== hash(inputs)) throw Error("Frozen experiment differs from current inputs. Preserve its evidence; do not overwrite or resubmit it.");
} else {
  manifest = { createdAt: new Date().toISOString(), inputDigest: hash(inputs), ...inputs,
    requests: cases.flatMap((sample, index) => (candidateOnly ? ["candidate"] : index % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"]).map(condition => ({ savedRequestKey: sample.savedRequestKey, condition, requestId: randomUUID(), state: "planned" }))) };
  write(manifestPath, manifest);
}
if (args.includes("--prepare")) {
  console.log(JSON.stringify({ prepared: manifest.requests.length, manifest: manifestPath, inputDigest: manifest.inputDigest }));
} else {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.OPENAI_API_KEY?.trim()) throw Error("Configured text-provider credential is missing; no request sent.");
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
  for (const request of manifest.requests) {
    if (request.state === "completed") continue;
    if (request.state !== "planned") throw Error(`Request ${request.requestId} is ${request.state}; recover it before considering any separately authorized replacement.`);
    const sample = cases.find(row => row.savedRequestKey === request.savedRequestKey);
    request.state = "uncertain";
    request.startedAt = new Date().toISOString();
    write(manifestPath, manifest);
    try {
      const completion = await ai.chat.completions.parse({ model: inputs.model, reasoning_effort: "low", max_completion_tokens: 4000,
        messages: [{ role: "system", content: request.condition === "candidate" && candidateOnly ? sample.candidateSystemPrompt : conditions[request.condition] }, { role: "user", content: sample.userMessage }],
        response_format: zodResponseFormat(RemixOutputSchema, "reference_text_remix") },
        { headers: { "X-Client-Request-Id": request.requestId } });
      const output = completion.choices[0]?.message.parsed;
      let validationError = null;
      try { validateRemixOutput(output, sample.source); } catch (error) { validationError = error.message; }
      Object.assign(request, { state: "completed", completedAt: new Date().toISOString(), providerResponseId: completion.id,
        providerModel: completion.model, finishReason: completion.choices[0]?.finish_reason, usage: completion.usage,
        output, validationError, refusal: completion.choices[0]?.message.refusal ?? null });
      write(manifestPath, manifest);
      console.log(JSON.stringify({ source: request.savedRequestKey.slice(0, 8), condition: request.condition, valid: !validationError, output }));
    } catch (error) {
      request.error = { name: error.name, status: error.status ?? null, code: error.code ?? null, message: String(error.message).slice(0, 1000) };
      write(manifestPath, manifest);
      throw Error(`Provider outcome not completed for ${request.requestId}. Saved diagnostic; no automatic retry. ${error.name}`);
    }
  }
  const comparison = { createdAt: manifest.createdAt, completedAt: new Date().toISOString(), inputDigest: manifest.inputDigest,
    model: inputs.model, reasoningEffort: "low", contextDigest: inputs.contextDigest,
    baselineSystemPrompt: conditions.baseline, candidateSystemPrompt: conditions.candidate,
    method: roles ? "Twelve explicitly authorized paid OpenAI human-role-v7 calls, one per original saved case. Same exact user messages, historical business context, model and settings. V7 changes only the v6 product-for-person permission to preserve human roles; the corrected prompt is frozen unchanged. No extra few-shot drafts. Prior outputs are reused from completed experiments, not regenerated. Same legacy-tail normalization. No active app/receipt changes or deployment." : minimal ? "Twelve explicitly authorized paid OpenAI minimal-v6 calls, one per original saved case. Exact same user messages, historical business context, model and settings as earlier rounds. The approved simplified prompt is unchanged; illustrative edits are not added to provider input. Same legacy screen-cut normalization. Baseline, v4 and v5 results are reused from completed experiments, not newly generated. No active application prompt or receipt change; no deployment." : sourceVoice ? "Twelve explicitly authorized paid OpenAI source-voice-v5 calls, one per original saved case. Same exact user messages, historical business context, model and settings as earlier rounds. Approved illustrative drafts are not included in the provider prompt. One legacy screen-cut tail is normalized as in earlier rounds. Baseline and rejected-v4 results are copied from their previous completed experiments; no new baseline or v4 calls. No application prompt/receipt changes or deployment." : followup ? "Twelve separately authorized Hook-v4 follow-up calls, one per original saved example. Same user messages, model and context as the first paired comparison; per-source character budget is in the revised system prompt. No new baseline calls. Historical receipts and first comparison remain unchanged." : "Same twelve saved examples and historical business context; fresh v2 and Hook-v3 calls, alternating order. Legacy screen-cut tail normalized equally. Historical receipts remain unchanged. One fresh call per condition/example; repeated source texts are retained as separate saved cases. Local SDK experiment, not application account remix receipts.",
    examples: cases.map(sample => ({ ...sample, baseline: sourceVoice || minimal || roles ? previousComparison.examples.find(row => row.savedRequestKey === sample.savedRequestKey).baseline : manifest.requests.find(r => r.savedRequestKey === sample.savedRequestKey && r.condition === "baseline"),
      ...(sourceVoice || minimal || roles ? { rejectedV4: previousFollowup.examples.find(row => row.savedRequestKey === sample.savedRequestKey).candidate } : {}),
      ...(minimal || roles ? { previousV5: previousVoice.examples.find(row => row.savedRequestKey === sample.savedRequestKey).candidate } : {}),
      ...(roles ? { previousV6: previousMinimal.examples.find(row => row.savedRequestKey === sample.savedRequestKey).candidate } : {}),
      candidate: manifest.requests.find(r => r.savedRequestKey === sample.savedRequestKey && r.condition === "candidate") })) };
  const comparisonPath = roles ? "docs/hook-remix-role-v7-results-2026-10-23.json" : minimal ? "docs/hook-remix-minimal-v6-results-2026-10-23.json" : sourceVoice ? "docs/hook-remix-source-voice-v5-results-2026-10-23.json" : followup ? "docs/hook-remix-prompt-followup-2026-10-23.json" : "docs/hook-remix-prompt-comparison-2026-10-23.json";
  write(comparisonPath, comparison);
  console.log(JSON.stringify({ completed: manifest.requests.length, comparison: comparisonPath }));
}
