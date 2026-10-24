import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getReferenceText } from "./reference-text-store";
import { ReferenceTextSchema, RemixRequestSchema, RemixOutputSchema, validateRemixOutput } from "./reference-text";
import { REMIX_TEXT_PROMPT_VERSION, REMIX_TEXT_SYSTEM_PROMPT, remixTextPrompt } from "./remix-text-prompt";
import { HOOK_ROLE_REMIX_PROMPT_VERSION, hookRoleRemixSystemPrompt } from "./hook-remix-role-prompt";
import { remixInputSource } from "./remix-text-input";
import { hookRemixSource } from "./hook-remix-source";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
function client() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Remix storage is unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function errorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) return json({ ok: false, message: error.message }, error.status);
  return json({ ok: false, message: "Could not load Remix Text. Try again." }, 503);
}
export async function handleReferenceText(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    const url = new URL(request.url), referenceId = url.searchParams.get("referenceId"), slideId = url.searchParams.get("slideId");
    const format = url.searchParams.get("format");
    if (referenceId && referenceId.length > 160 || slideId && slideId.length > 160 || !referenceId && !["hook", "wall_text", "slideshow"].includes(format ?? "")) return json({ ok: false, message: "Choose a valid workflow or reference." }, 400);
    let source = null;
    try { if (referenceId) source = getReferenceText(referenceId, slideId); } catch { return json({ ok: false, message: "This reference text is unavailable. Choose another source." }, 400); }
    const profile = await getBusinessProfileForUser(user.uid);
    const enabled = process.env.EXPLORE_TEXT_REMIX_ENABLED === "true"
      && Boolean(process.env.OPENAI_API_KEY?.trim())
      && Boolean((process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    return json({ ok: true, source: source ? hookRemixSource(source) : null, enabled,
      businessContext: { name: profile?.context.businessName ?? null, ready: Boolean(profile?.context.businessName && profile.context.productSummary) } });
  } catch (error) { return errorResponse(error); }
}

/** A saved claim precedes every paid call. Pending/uncertain requests never resubmit. */
export async function handleTextRemix(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    if (process.env.EXPLORE_TEXT_REMIX_ENABLED !== "true") return json({ ok: false, message: "Remix Text is not enabled yet." }, 503);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 32768) return json({ ok: false, message: "The remix request is too large." }, 413);
    const parsed = RemixRequestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || request.headers.get("Idempotency-Key") !== parsed.data.requestKey) return json({ ok: false, message: "Choose a valid reference and request." }, 400);
    return await remixTextForOwner(user.uid, parsed.data);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ ok: false, message: "Invalid remix request." }, 400);
    return errorResponse(error);
  }
}

/** Caller authenticates and checks current access; the website and MCP share claims and validation. */
export async function remixTextForOwner(userId: string, value: unknown) {
  try {
    if (process.env.EXPLORE_TEXT_REMIX_ENABLED !== "true") return json({ ok: false, message: "Remix Text is not enabled yet." }, 503);
    const parsed = RemixRequestSchema.safeParse(value);
    if (!parsed.success) return json({ ok: false, message: "Choose a valid reference and request." }, 400);
    const body = parsed.data, db = client();
    // Omitted fields keep the original hash so existing receipts remain recoverable.
    const payloadHash = createHash("sha256").update(JSON.stringify({ referenceId: body.referenceId, slideId: body.slideId, instructions: body.instructions,
      ...(body.format !== undefined ? { format: body.format } : {}), ...(body.referenceBlocks !== undefined ? { referenceBlocks: body.referenceBlocks } : {}) })).digest("hex");
    const { data: previous, error: readError } = await db.from("explore_text_remixes").select("payload_hash,status,output_json,input_json").eq("user_id", userId).eq("request_key", body.requestKey).maybeSingle();
    if (readError) return json({ ok: false, message: "Remix storage is unavailable. No AI request was made." }, 503);
    if (previous) {
      if (previous.payload_hash !== payloadHash) return json({ ok: false, message: "This remix request belongs to different instructions." }, 409);
      return receiptResponse(previous.status, previous.output_json, previous.input_json?.source);
    }
    let original = null;
    try { if (body.referenceId) original = getReferenceText(body.referenceId, body.slideId, body.format); } catch { return json({ ok: false, message: "Choose an available reference or slide." }, 400); }
    if (body.referenceId && !body.referenceBlocks && (!original || original.status !== "ready")) return json({ ok: false, message: "This reference text has not been prepared for remixing yet." }, 409);
    let source;
    try { source = remixInputSource(body, original); } catch (error) { return json({ ok: false, message: error instanceof Error ? error.message : "Enter valid starting text." }, 400); }
    const profile = await getBusinessProfileForUser(userId);
    if (!profile?.context.businessName || !profile.context.productSummary) return json({ ok: false, message: "Add your business context in Settings before remixing." }, 409);
    if (!process.env.OPENAI_API_KEY?.trim()) return json({ ok: false, message: "Text generation is unavailable." }, 503);
    const model = process.env.OPENAI_TEXT_REMIX_MODEL?.trim() || "gpt-5.6-luna";
    const promptVersion = source.format === "hook" ? HOOK_ROLE_REMIX_PROMPT_VERSION : REMIX_TEXT_PROMPT_VERSION;
    const input = { source, businessProfileId: profile.id, businessProfileVersion: profile.profileVersion, businessContext: profile.context, instructions: body.instructions, model, promptVersion };
    const { data: claim, error: claimError } = await db.rpc("explore_claim_text_remix", { p_user_id: userId, p_request_key: body.requestKey, p_payload_hash: payloadHash, p_input: input });
    if (claimError) return json({ ok: false, message: claimError.message.includes("remix_daily_limit") ? "You've reached today's 20 text remixes. Try again tomorrow." : "Could not reserve this remix. No AI request was made." }, claimError.message.includes("remix_daily_limit") ? 429 : 409);
    if (!claim?.claimed) return receiptResponse(claim?.status, claim?.output, claim?.source);
    try {
      const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
      const completion = await ai.chat.completions.parse({
        model, ...(/^gpt-5/.test(model) ? { reasoning_effort: "low" as const } : { temperature: 0.2 }), max_completion_tokens: 4000,
        messages: [{ role: "system", content: source.format === "hook" ? hookRoleRemixSystemPrompt(source) : REMIX_TEXT_SYSTEM_PROMPT }, { role: "user", content: remixTextPrompt(source, profile.context, body.instructions) }],
        response_format: zodResponseFormat(RemixOutputSchema, "reference_text_remix"),
      });
      const output = validateRemixOutput(completion.choices[0]?.message.parsed, source);
      const saved = await db.from("explore_text_remixes").update({ status: "completed", output_json: output, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("request_key", body.requestKey).eq("status", "pending").select("request_key").single();
      if (saved.error) return json({ ok: false, outcome: "uncertain", message: "The AI answered, but saving its result could not be confirmed. This request will not run again automatically." }, 503);
      return json({ ok: true, output, source });
    } catch {
      // Terminal record prevents automatic SDK/network retries from billing twice.
      await db.from("explore_text_remixes").update({ status: "failed", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("request_key", body.requestKey).eq("status", "pending");
      return json({ ok: false, outcome: "failed", message: "The remix could not be completed. Your text is unchanged. You can start a new remix." }, 502);
    }
  } catch (error) {
    if (error instanceof SyntaxError) return json({ ok: false, message: "Invalid remix request." }, 400);
    return errorResponse(error);
  }
}
function receiptResponse(status: string, output: unknown, source: unknown) {
  if (status === "completed") {
    try {
      const original = ReferenceTextSchema.parse(source);
      return json({ ok: true, output: validateRemixOutput(output, original), source: original });
    } catch { return json({ ok: false, outcome: "uncertain", message: "The saved remix could not be verified. This request will not be submitted again." }, 503); }
  }
  return json({ ok: false, outcome: status === "failed" ? "failed" : "uncertain", message: status === "failed" ? "This remix failed. You can start a new remix." : "This request may still be processing. Check its result again; it will not be submitted twice." }, 409);
}


/** Read an owned receipt without current creation gates, plan checks or provider calls. */
export async function getTextRemixForOwner(userId: string, requestKey: string) {
  try {
    const { data, error } = await client().from("explore_text_remixes")
      .select("status,output_json,input_json").eq("user_id", userId).eq("request_key", requestKey).maybeSingle();
    if (error) return json({ ok: false, message: "Remix storage is unavailable." }, 503);
    if (!data) return json({ ok: false, message: "This saved remix was not found." }, 404);
    return receiptResponse(data.status, data.output_json, data.input_json?.source);
  } catch (error) { return errorResponse(error); }
}


const remixHistoryCursor = z.strictObject({ version:z.literal(1), owner:z.string().regex(/^[a-f0-9]{64}$/),
  createdAt:z.string().datetime({offset:true}), requestKey:z.uuid() });
export async function listTextRemixesForOwner(userId: string, options: { limit:number; cursor?:string }) {
  try {
    const owner = createHash("sha256").update(userId).digest("hex");
    let cursor: z.infer<typeof remixHistoryCursor> | null = null;
    if (options.cursor) {
      try {
        if (!/^[A-Za-z0-9_-]+$/.test(options.cursor)) throw Error();
        cursor = remixHistoryCursor.parse(JSON.parse(Buffer.from(options.cursor,"base64url").toString("utf8")));
        if (cursor.owner !== owner) throw Error();
      } catch { return json({ ok:false, message:"Choose a valid text-remix history cursor for this account." },400); }
    }
    let query = client().from("explore_text_remixes").select("request_key,status,created_at,updated_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).order("request_key",{ascending:false}).limit(options.limit+1);
    if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},request_key.lt.${cursor.requestKey})`);
    const { data,error } = await query;
    if (error) return json({ok:false,message:"Remix history is unavailable."},503);
    const items = (data ?? []).slice(0,options.limit), last = items.at(-1);
    return json({ok:true,items,next_cursor:data && data.length>options.limit && last
      ? Buffer.from(JSON.stringify({version:1,owner,createdAt:last.created_at,requestKey:last.request_key})).toString("base64url") : null});
  } catch (error) { return errorResponse(error); }
}
