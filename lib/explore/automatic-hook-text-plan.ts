import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getBusinessProfileForUser } from "../business-profiles/db";
import { getReferenceText } from "./reference-text-store";
import { hookRemixSource } from "./hook-remix-source";
import { hookBrandRemixSystemPrompt, HOOK_BRAND_REMIX_PROMPT_VERSION } from "./hook-remix-brand-prompt";
import { remixTextPrompt } from "./remix-text-prompt";
import type { AutomaticHookTextPlan } from "../../worker/src/lib/automatic-hook-text";

/** Freeze the reviewed source and business context before admitting paid video work. */
export async function prepareAutomaticHookText(input: { enabled: unknown; format: unknown; referenceId: unknown; owner: { uid: string; email: string | null; emailVerified: boolean }; requestKey: string; firstJobKey: string }): Promise<AutomaticHookTextPlan | null> {
  if (input.enabled === undefined || input.enabled === false) return null;
  if (input.enabled !== true || input.format !== "hook" || typeof input.referenceId !== "string") throw new Error("Choose a Hook reference before enabling automatic text.");
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const previous = await db.from("background_jobs").select("input_json").eq("user_id", input.owner.uid)
    .eq("job_type", "generate_hook_video").eq("project_id", "ai-studio").eq("idempotency_key", input.firstJobKey).maybeSingle();
  if (previous.error) throw new Error("Could not check the saved generation. Refresh status before trying again.");
  if (previous.data) {
    const saved = previous.data.input_json?.automaticHookText as AutomaticHookTextPlan | undefined;
    if (!saved || saved.source.referenceId !== input.referenceId) throw new Error("This generation was already saved with different text settings. Recover its saved status.");
    return saved;
  }
  if (process.env.EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED !== "true" || process.env.EXPLORE_TEXT_REMIX_ENABLED !== "true" || !process.env.OPENAI_API_KEY?.trim()) throw new Error("Automatic Hook text is unavailable. Turn it off to generate footage only.");
  const original = getReferenceText(input.referenceId, null, "hook", input.owner);
  if (!original || original.status !== "ready" || original.format !== "hook") throw new Error("This reference's text is not prepared. Turn off automatic text or choose another reference.");
  const source = hookRemixSource(original);
  const profile = await getBusinessProfileForUser(input.owner.uid);
  if (!profile?.context.businessName || !profile.context.productSummary) throw new Error("Add your business context in Settings, or turn off automatic text to generate footage only.");
  const allowance = await db.from("explore_text_remixes").select("request_key", { count: "exact", head: true }).eq("user_id", input.owner.uid).gt("created_at", new Date(Date.now() - 86400000).toISOString());
  if (allowance.error) throw new Error("Could not check your text allowance. No video was started.");
  if ((allowance.count ?? 20) >= 20) throw new Error("You've used today's 20 text remixes. Turn off automatic text or try again tomorrow.");
  const identity = createHash("sha256").update(`automatic-hook-text-v1:${input.owner.uid}:${input.requestKey}`).digest("hex");
  const requestKey = `${identity.slice(0,8)}-${identity.slice(8,12)}-4${identity.slice(13,16)}-8${identity.slice(17,20)}-${identity.slice(20,32)}`;
  return { version: 1, requestKey, source, businessProfileId: profile.id, businessProfileVersion: profile.profileVersion,
    businessContext: profile.context, model: process.env.OPENAI_TEXT_REMIX_MODEL?.trim() || "gpt-5.6-luna", promptVersion: HOOK_BRAND_REMIX_PROMPT_VERSION,
    systemPrompt: hookBrandRemixSystemPrompt(source), userPrompt: remixTextPrompt(source, profile.context, "") };
}
