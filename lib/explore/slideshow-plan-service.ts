import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { resolveOwnedPrivateMediaUrl } from "@/worker/src/lib/private-media";
import { downloadReferenceImageContext } from "@/worker/src/lib/reference-image-download";
import { SLIDESHOW_REQUEST_PLANNER_SYSTEM, SlideshowRequestPlanSchema, validateSlideshowRequestPlan, type SlideshowPlanningInput } from "./slideshow-request-plan";
import { parseSlideshowBusinessContext, type SlideshowBusinessContext } from "../../worker/src/lib/slideshow-business-context";

export class SlideshowPlanError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

/** A durable claim fences the single planning call, including lost HTTP responses. */
export async function planSlideshowRequest(owner: string, requestKey: string, input: SlideshowPlanningInput, businessContext: SlideshowBusinessContext) {
  const deadline = Date.now() + 90_000;
  if (!/^[0-9a-f-]{36}$/i.test(requestKey)) throw new SlideshowPlanError("Start a new slideshow request.", 400);
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !secret || !process.env.OPENAI_API_KEY?.trim()) throw new SlideshowPlanError("Slideshow planning is not configured yet. Your instructions and images are preserved.", 503);
  const db = createClient(endpoint, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const model = process.env.OPENAI_SLIDESHOW_PLAN_MODEL?.trim() || process.env.OPENAI_SLIDESHOW_PROMPT_MODEL?.trim() || process.env.OPENAI_TEXT_REMIX_MODEL?.trim() || "gpt-5.6-luna";
  if (!parseSlideshowBusinessContext(businessContext)) throw new SlideshowPlanError("Could not confirm your saved business context. Review it in Settings before generating slides.", 503);
  // Fence both the model instructions and the server-owned facts, not browser-supplied context.
  const planningInput = { ...input, businessContext, plannerVersion: 2, model };
  const hash = createHash("sha256").update(JSON.stringify(planningInput)).digest("hex");
  const { data: claim, error } = await db.rpc("explore_claim_slideshow_plan", { p_user_id: owner, p_request_key: requestKey, p_payload_hash: hash, p_input: planningInput });
  if (error) throw new SlideshowPlanError(error.message.includes("slideshow_plan_conflict") ? "The selected images or instructions changed. Start a new generation."
    : error.message.includes("slideshow_plan_daily_limit") ? "You've reached today's slideshow planning limit. Your draft is preserved."
    : "Could not save the slideshow plan. No image generation was started.", error.message.includes("slideshow_plan_conflict") ? 409 : error.message.includes("daily_limit") ? 429 : 503);
  if (!claim?.claimed) {
    if (claim?.status === "completed") return validateSlideshowRequestPlan(claim.output, input);
    if (claim?.status === "failed") throw new SlideshowPlanError("The image assignments could not be confirmed. Review your instructions and generate again.");
    throw new SlideshowPlanError("Your slide plan is still pending or its result is uncertain. Recover this request to check it without running planning twice.", 409);
  }
  let output;
  try {
    // Only canonical, authorized inputs reach this function. Bearer URLs/pixels are never stored.
    const urls = [...new Set(input.images.map(image => image.url))];
    const readable = await Promise.all(urls.map(url => resolveOwnedPrivateMediaUrl(url, owner)));
    const pixels = await downloadReferenceImageContext(readable);
    if (Date.now() > deadline) throw new Error("Planning input deadline exceeded");
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: JSON.stringify({
      originalRequest: input.prompt, targetIds: input.targetIds, businessContext,
      images: input.images.map(({ id, label, kind, sourceSlideNumber }) => ({ id, label, kind, sourceSlideNumber })),
    }) }];
    for (const image of input.images) {
      const data = pixels[urls.indexOf(image.url)];
      content.push({ type: "text", text: `${image.label}; id=${image.id}; kind=${image.kind}` },
        { type: "image_url", image_url: { url: `data:${data.contentType};base64,${data.buffer.toString("base64")}`, detail: "auto" } });
    }
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60_000 });
    const response = await ai.chat.completions.parse({ model, max_completion_tokens: 12000,
      ...(/^gpt-5|^gpt-6/.test(model) ? { reasoning_effort: "low" as const } : { temperature: 0 }),
      messages: [{ role: "system", content: SLIDESHOW_REQUEST_PLANNER_SYSTEM }, { role: "user", content }],
      response_format: zodResponseFormat(SlideshowRequestPlanSchema, "slideshow_execution_plan"),
    });
    output = validateSlideshowRequestPlan(response.choices[0]?.message.parsed, input);
    if (Date.now() > deadline) throw new Error("Planning deadline exceeded");
  } catch {
    // A failed/uncertain submission is never automatically submitted again.
    await db.from("explore_slideshow_plans").update({ status: "failed", updated_at: new Date().toISOString() }).eq("user_id", owner).eq("request_key", requestKey).eq("status", "pending");
    throw new SlideshowPlanError("Could not confirm the slide assignments. No image credits were reserved. Review your instructions and generate again.");
  }
  const saved = await db.from("explore_slideshow_plans").update({ status: "completed", output_json: output, updated_at: new Date().toISOString() }).eq("user_id", owner).eq("request_key", requestKey).eq("status", "pending").select("request_key").maybeSingle();
  if (saved.error || !saved.data) throw new SlideshowPlanError("The plan could not be saved. Recover this request before starting another generation.", 503);
  return output;
}
