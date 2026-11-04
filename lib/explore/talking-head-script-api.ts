import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getTalkingHeadScript } from "./talking-head-script-store";
import { TalkingHeadScriptRequestSchema as Body } from "./talking-head-script-draft";
import { ReferenceTextSchema, validateRemixOutput, type ReferenceText } from "./reference-text";
import { TALKING_HEAD_SCRIPT_MODEL, TALKING_HEAD_SCRIPT_PROMPT_VERSION, TALKING_HEAD_SCRIPT_SYSTEM, talkingHeadScriptRemixPayload, validateTalkingHeadScriptOutput } from "./talking-head-script-remix";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
function db() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw Error("Remix storage is unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function failure(error: unknown) {
  return error instanceof FirebaseAuthRequestError ? reply({ ok: false, message: error.message }, error.status) : reply({ ok: false, message: "Script Remix is unavailable. Your text is kept." }, 503);
}

/** Compatibility storage only: these blocks never enter an overlay renderer. */
export function scriptReceiptBlocks(text: string, count = Math.max(1, Math.ceil(text.length / 400))) {
  const words = text.trim().split(/\s+/u), chunks: string[] = [];
  for (let remaining = count; remaining > 0; remaining--) chunks.push(words.splice(0, Math.ceil(words.length / remaining)).join(" "));
  if (chunks.some(chunk => !chunk || chunk.length > 600)) throw Error("This script cannot fit the saved receipt. Shorten it before remixing.");
  return chunks;
}
function receipt(status: string, output: unknown, source: unknown) {
  if (status !== "completed") return reply({ ok: false, outcome: status === "failed" ? "failed" : "uncertain", message: status === "failed" ? "This remix failed. Your text is kept; you can start another remix." : "This remix may still be processing. Check its saved result; it will not be submitted again." }, 409);
  try {
    const original = ReferenceTextSchema.parse(source), result = validateRemixOutput(output, original);
    return reply({ ok: true, script: result.blocks.join(" "), sourceSha256: original.sourceSha256, referenceId: original.referenceId });
  } catch { return reply({ ok: false, outcome: "uncertain", message: "The saved result could not be verified. It will not be regenerated automatically." }, 503); }
}
export async function handleTalkingHeadScriptGet(request: Request) {
  try {
    const url = new URL(request.url), requestKey = url.searchParams.get("requestKey");
    const user = requestKey ? await requireFirebaseUser(request) : await requireAIStudioProUser(request);
    if (requestKey) {
      if (!z.uuid().safeParse(requestKey).success) return reply({ ok: false, message: "Choose a valid saved request." }, 400);
      const result = await db().from("explore_text_remixes").select("status,output_json,input_json").eq("user_id", user.uid).eq("request_key", requestKey).maybeSingle();
      if (result.error) throw Error("Storage unavailable.");
      if (!result.data || result.data.input_json?.purpose !== "talking_head_script") return reply({ ok: false, message: "Saved script remix not found." }, 404);
      return receipt(result.data.status, result.data.output_json, result.data.input_json.source);
    }
    let source;
    try { source = getTalkingHeadScript(url.searchParams.get("referenceId") ?? ""); } catch (error) { return reply({ ok: false, message: (error as Error).message }, 409); }
    const profile = await getBusinessProfileForUser(user.uid);
    return reply({ ok: true, source, enabled: process.env.EXPLORE_TEXT_REMIX_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim()), business: { name: profile?.context.businessName ?? null, ready: Boolean(profile?.context.businessName && profile.context.productSummary), version: profile?.profileVersion ?? null } });
  } catch (error) { return failure(error); }
}
export async function handleTalkingHeadScriptPost(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    if (process.env.EXPLORE_TEXT_REMIX_ENABLED !== "true") return reply({ ok: false, message: "Script Remix is not enabled. You can still edit your script." }, 503);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 32768) return reply({ ok: false, message: "The script request is too large." }, 413);
    const parsed = Body.safeParse(JSON.parse(raw));
    if (!parsed.success || request.headers.get("Idempotency-Key") !== parsed.data.requestKey) return reply({ ok: false, message: "Review the hook script before remixing." }, 400);
    const body = parsed.data, storage = db();
    const payloadHash = createHash("sha256").update(JSON.stringify({ purpose: "talking_head_script", ...body, requestKey: undefined })).digest("hex");
    const previous = await storage.from("explore_text_remixes").select("payload_hash,status,output_json,input_json").eq("user_id", user.uid).eq("request_key", body.requestKey).maybeSingle();
    if (previous.error) throw Error("Storage unavailable.");
    if (previous.data) return previous.data.payload_hash !== payloadHash ? reply({ ok: false, message: "This request belongs to different script inputs." }, 409) : receipt(previous.data.status, previous.data.output_json, previous.data.input_json?.source);
    const transcript = getTalkingHeadScript(body.referenceId);
    if (transcript.sourceSha256 !== body.sourceSha256 || transcript.transcriptSha256 !== body.transcriptSha256) return reply({ ok: false, message: "The source transcript changed. Reload it before remixing." }, 409);
    const profile = await getBusinessProfileForUser(user.uid);
    if (!profile?.context.businessName || !profile.context.productSummary) return reply({ ok: false, message: "Add your business context in Settings before remixing." }, 409);
    if (profile.profileVersion !== body.businessProfileVersion) return reply({ ok: false, message: "Your business context changed. Reload the script section before remixing." }, 409);
    if (!process.env.OPENAI_API_KEY?.trim()) throw Error("Provider unavailable.");
    const model = process.env.OPENAI_TALKING_HEAD_SCRIPT_MODEL?.trim() || TALKING_HEAD_SCRIPT_MODEL;
    if (!["gpt-6.1-terra", "gpt-6-luna"].includes(model)) throw Error("Unvalidated script model configuration.");
    const chunks = scriptReceiptBlocks(body.script);
    const source: ReferenceText = { referenceId: body.referenceId, slideId: null, sourceSha256: body.sourceSha256, format: "hook", status: "ready", blocks: chunks.map(text => ({ text, startMs: 0, endMs: transcript.hookEndMs })), extractedAt: transcript.extractedAt, model: "user-reviewed-spoken-script", notes: "Spoken-script receipt only; all blocks cover the selected introduction, not word timings or on-screen overlays." };
    const input = { purpose: "talking_head_script", source, originalScript: body.script, transcriptSha256: body.transcriptSha256, hookRange: { startMs: 0, endMs: transcript.hookEndMs }, businessProfileId: profile.id, businessProfileVersion: profile.profileVersion, businessContext: profile.context, model, reasoningEffort: "medium", promptVersion: TALKING_HEAD_SCRIPT_PROMPT_VERSION };
    const claim = await storage.rpc("explore_claim_text_remix", { p_user_id: user.uid, p_request_key: body.requestKey, p_payload_hash: payloadHash, p_input: input });
    if (claim.error) return reply({ ok: false, message: claim.error.message.includes("remix_daily_limit") ? "You've reached today's 20 text remixes. Try again tomorrow." : "Could not reserve this remix. No AI request was made." }, claim.error.message.includes("remix_daily_limit") ? 429 : 503);
    if (!claim.data?.claimed) return receipt(claim.data?.status, claim.data?.output, claim.data?.source);
    try {
      const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
      const result = await ai.responses.create({ model, reasoning: { effort: "medium" }, instructions: TALKING_HEAD_SCRIPT_SYSTEM, input: talkingHeadScriptRemixPayload(body.script, profile.context), max_output_tokens: 4000, store: false,
        text: { format: { type: "json_schema", name: "talking_head_script", strict: true, schema: { type: "object", properties: { script: { type: "string" } }, required: ["script"], additionalProperties: false } } } });
      if (result.status !== "completed") throw Error("Incomplete script output.");
      const output = validateTalkingHeadScriptOutput(JSON.parse(result.output_text), body.script);
      const savedOutput = validateRemixOutput({ blocks: scriptReceiptBlocks(output.script, chunks.length), heading: "", body: "" }, source);
      const saved = await storage.from("explore_text_remixes").update({ status: "completed", output_json: savedOutput, input_json: { ...input, providerResponseId: result.id, providerModel: result.model, usage: result.usage }, updated_at: new Date().toISOString() }).eq("user_id", user.uid).eq("request_key", body.requestKey).eq("status", "pending").select("request_key").single();
      if (saved.error) return reply({ ok: false, outcome: "uncertain", message: "The AI answered, but saving could not be confirmed. Check the saved request; do not resubmit." }, 503);
      return receipt("completed", savedOutput, source);
    } catch {
      await storage.from("explore_text_remixes").update({ status: "failed", updated_at: new Date().toISOString() }).eq("user_id", user.uid).eq("request_key", body.requestKey).eq("status", "pending");
      return reply({ ok: false, outcome: "failed", message: "The remix could not be completed. Your script is unchanged. No automatic retry was made." }, 502);
    }
  } catch (error) { return error instanceof SyntaxError ? reply({ ok: false, message: "Invalid script request." }, 400) : failure(error); }
}
