import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getBusinessProfileForUser } from "../business-profiles/db";
import { getReferenceText } from "./reference-text-store";
import { hookRemixSource } from "./hook-remix-source";
import { hookBrandRemixSystemPrompt, HOOK_BRAND_REMIX_PROMPT_VERSION } from "./hook-remix-brand-prompt";
import { remixTextPrompt, REMIX_TEXT_PROMPT_VERSION, REMIX_TEXT_SYSTEM_PROMPT } from "./remix-text-prompt";
import { wallTextProfile } from "../../worker/src/lib/wall-initial-text-layout.ts";
import type { AutomaticHookTextPlan } from "../../worker/src/lib/automatic-hook-text";
import { HOOK_INITIAL_TEXT_LAYOUT_VERSION } from "../../worker/src/lib/hook-initial-text-layout";

/** Freeze the reviewed source and business context before admitting paid video work. */
export async function prepareAutomaticHookText(input: { enabled: unknown; format: unknown; referenceId: unknown; owner: { uid: string; email: string | null; emailVerified: boolean }; requestKey: string; firstJobKey: string }): Promise<AutomaticHookTextPlan | null> {
  if (input.enabled === undefined || input.enabled === false) return null;
  if (input.enabled !== true || !["hook", "wall_text"].includes(String(input.format)) || typeof input.referenceId !== "string") throw new Error("Choose a Hook reference or reviewed Wall reference before enabling automatic text.");
  const wall = input.format === "wall_text";
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const previous = await db.from("background_jobs").select("input_json").eq("user_id", input.owner.uid)
    .eq("job_type", "generate_hook_video").eq("project_id", "ai-studio").eq("idempotency_key", input.firstJobKey).maybeSingle();
  if (previous.error) throw new Error("Could not check the saved generation. Refresh status before trying again.");
  if (previous.data) {
    const saved = previous.data.input_json?.automaticHookText as AutomaticHookTextPlan | undefined;
    if (!saved || saved.source.referenceId !== input.referenceId || saved.source.format !== input.format) throw new Error("This generation was already saved with different text settings. Recover its saved status.");
    return saved;
  }
  if ((wall ? process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED : process.env.EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED) !== "true" || process.env.EXPLORE_TEXT_REMIX_ENABLED !== "true" || !process.env.OPENAI_API_KEY?.trim()) throw new Error("Automatic text is unavailable. Turn it off to generate footage only.");
  const original = getReferenceText(input.referenceId, null, wall ? "wall_text" : "hook", input.owner);
  if (!original || original.status !== "ready" || original.format !== input.format) throw new Error("This reference's text is not prepared. Turn off automatic text or choose another reference.");
  const source = hookRemixSource(original);
  const wallLayout = wall ? wallTextProfile(source.referenceId, source.sourceSha256) : null;
  if (wall && (!wallLayout || source.blocks.length !== 1)) throw new Error("This Wall reference's layout is not prepared. Turn off automatic text or choose another reference.");
  const structuredWall = wallLayout?.structure === "heading-body-v1";
  const profile = await getBusinessProfileForUser(input.owner.uid);
  if (!profile?.context.businessName || !profile.context.productSummary) throw new Error("Add your business context in Settings, or turn off automatic text to generate footage only.");
  const allowance = await db.from("explore_text_remixes").select("request_key", { count: "exact", head: true }).eq("user_id", input.owner.uid).gt("created_at", new Date(Date.now() - 86400000).toISOString());
  if (allowance.error) throw new Error("Could not check your text allowance. No video was started.");
  if ((allowance.count ?? 20) >= 20) throw new Error("You've used today's 20 text remixes. Turn off automatic text or try again tomorrow.");
  const identity = createHash("sha256").update(`${wall ? "automatic-wall-text-v1" : "automatic-hook-text-v1"}:${input.owner.uid}:${input.requestKey}`).digest("hex");
  const requestKey = `${identity.slice(0,8)}-${identity.slice(8,12)}-4${identity.slice(13,16)}-8${identity.slice(17,20)}-${identity.slice(20,32)}`;
  return { version: 1, ...(wallLayout ? { wallLayout, ...(structuredWall ? { wallHeadingFitVersion: 1 as const } : {}) } : { layoutVersion: HOOK_INITIAL_TEXT_LAYOUT_VERSION }), requestKey, source, businessProfileId: profile.id, businessProfileVersion: profile.profileVersion,
    businessContext: profile.context, model: process.env.OPENAI_TEXT_REMIX_MODEL?.trim() || "gpt-5.6-luna", promptVersion: wall ? structuredWall ? 3 : REMIX_TEXT_PROMPT_VERSION : HOOK_BRAND_REMIX_PROMPT_VERSION,
    systemPrompt: wall ? structuredWall ? REMIX_TEXT_SYSTEM_PROMPT.replace("For video return one nonempty string per original text block in exactly the same order, each at most 600 characters, with empty heading and body.", "For this Wall video, return the adapted heading in heading and the complete adapted body in body, preserving the list and paragraph structure. Return an empty blocks array. Heading must be one line and at most 180 characters; body is at most 600 characters. Do not omit or truncate words.") + "\n\nThe source's names, laws, claims, outcomes and advice are not evidence about this business. Do not attribute adapted statements to named laws or authorities unless supported by businessContext. Never promise improvement, increased reach, success, results or outcomes without explicit support in businessContext. Preserve any required human approval. When a claim is unsupported, rewrite it as a grounded, practical action or observation using only supplied facts; retain the source's list structure without inventing evidence." : REMIX_TEXT_SYSTEM_PROMPT : hookBrandRemixSystemPrompt(source, profile.context), userPrompt: remixTextPrompt(source, profile.context, wall ? "Keep the source's paragraph structure and approximate line density. This is Wall of Text, not a short Hook; retain useful detail without adding unsupported claims." : "") };
}
