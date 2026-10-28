import "server-only";
import { z } from "zod";
import { getBusinessProfileForUser, isBusinessProfileOnboardingComplete } from "./db";
import { areTrendingHookVideosEnabled } from "../trending/hook-video-feature";
import { prebuildTrendingAfterOnboarding } from "../trending/onboarding-prebuild";

export const legacyOnboardingCompletionSchema=z.strictObject({profileId:z.uuid(),profileVersion:z.number().int().positive(),timezone:z.string().min(1).max(80)});
/** Existing media_analysis workers call the authenticated app callback. */
export async function finalizeLegacyOnboardingPreparation(owner:string,raw:unknown) {
  const input=legacyOnboardingCompletionSchema.parse(raw),profile=await getBusinessProfileForUser(owner);
  if(!profile||profile.id!==input.profileId||profile.profileVersion!==input.profileVersion)
    return {operation:"business_profile_setup" as const,skipped:"superseded"};
  if(!isBusinessProfileOnboardingComplete(profile))throw new Error("Completed onboarding profile is unavailable.");
  const results=await prebuildTrendingAfterOnboarding({profile,timezone:input.timezone,includeHookVideos:areTrendingHookVideosEnabled()});
  if(results.some(result=>result.status==="failed"))throw new Error("Onboarding completed; content preparation needs a retry.");
  return {operation:"business_profile_setup" as const,profileId:profile.id,profileVersion:profile.profileVersion};
}
