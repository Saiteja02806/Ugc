import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { SlideshowPromptInputSchema, SlideshowPromptOutputSchema, SLIDESHOW_PROMPT_IMPROVER_SYSTEM,
  slideshowPromptImproverMessage, validateSlideshowPromptOutput } from "./slideshow-prompt-plan";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function database() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw Error("Prompt storage unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Private durable claim precedes every paid text request. Replays only read saved state. */
export async function handleSlideshowPromptImprovement(request: Request) {
  try {
    const owner = await requireAIStudioProUser(request);
    if (process.env.EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED !== "true" || !process.env.OPENAI_API_KEY?.trim()) return json({ ok: false, message: "Improve instructions is not available yet. Your original instructions can still be used." }, 503);
    const requestKey = request.headers.get("Idempotency-Key") ?? "";
    if (!uuid.test(requestKey)) return json({ ok: false, message: "Choose a valid improvement request." }, 400);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 32768) return json({ ok: false, message: "The instructions are too long to improve." }, 413);
    const parsed = SlideshowPromptInputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ ok: false, message: "Use 1–8,000 characters of text only. Do not include images or reference metadata." }, 400);
    const input = parsed.data, db = database();
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const model = process.env.OPENAI_SLIDESHOW_PROMPT_MODEL?.trim() || process.env.OPENAI_TEXT_REMIX_MODEL?.trim() || "gpt-5.6-luna";
    const { data: claim, error } = await db.rpc("explore_claim_slideshow_prompt", { p_user_id: owner.uid, p_request_key: requestKey, p_payload_hash: hash,
      p_input: { ...input, model, promptVersion: 2 } });
    if (error) return json({ ok: false, message: error.message.includes("prompt_daily_limit") ? "You've reached today's 20 instruction improvements. You can still generate using your original instructions."
      : error.message.includes("prompt_request_conflict") ? "This request belongs to different instructions. Start a new improvement."
      : "Could not reserve this improvement. No text generation was started." }, error.message.includes("prompt_daily_limit") ? 429 : error.message.includes("prompt_request_conflict") ? 409 : 503);
    if (!claim?.claimed) {
      if (claim?.status === "completed") return json({ ok: true, output: validateSlideshowPromptOutput(claim.output) });
      return json({ ok: false, outcome: claim?.status === "failed" ? "failed" : "pending", message: claim?.status === "failed"
        ? "This improvement failed. Your original instructions are unchanged. Start a new improvement to try again."
        : "This improvement has not finished or its result could not be confirmed. Check the same request again; it will not run twice." }, 409);
    }
    let output;
    try {
      const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
      const completion = await ai.chat.completions.parse({ model,
        ...(/^gpt-5|^gpt-6/.test(model) ? { reasoning_effort: "low" as const } : { temperature: 0.2 }),
        max_completion_tokens: 5000,
        messages: [{ role: "system", content: SLIDESHOW_PROMPT_IMPROVER_SYSTEM }, { role: "user", content: slideshowPromptImproverMessage(input) }],
        response_format: zodResponseFormat(SlideshowPromptOutputSchema, "slideshow_prompt_rewrite"),
      });
      output = validateSlideshowPromptOutput(completion.choices[0]?.message.parsed);
    } catch {
      await db.from("explore_slideshow_prompts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("user_id", owner.uid).eq("request_key", requestKey).eq("status", "pending");
      return json({ ok: false, outcome: "failed", message: "The improvement could not be completed. Your original instructions are unchanged." }, 502);
    }
    const saved = await db.from("explore_slideshow_prompts").update({ status: "completed", output_json: output, updated_at: new Date().toISOString() })
      .eq("user_id", owner.uid).eq("request_key", requestKey).eq("status", "pending").select("request_key").single();
    if (saved.error) return json({ ok: false, outcome: "pending", message: "The suggestion was generated, but saving it could not be confirmed. Check the same request again." }, 503);
    return json({ ok: true, output });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json({ ok: false, message: error.message }, error.status);
    return json({ ok: false, message: error instanceof SyntaxError ? "Enter a valid improvement request." : "Could not confirm the improvement. Your original instructions are unchanged." }, error instanceof SyntaxError ? 400 : 503);
  }
}
