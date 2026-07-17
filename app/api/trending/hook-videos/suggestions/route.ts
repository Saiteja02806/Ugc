import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { createHookVideoSuggestions } from "@/lib/trending/hook-video-db";
import { generateBusinessHookSuggestions } from "@/lib/trending/generate-hook-suggestions";
import {
  getHookDemoAsset,
  getHookInfluencerForUser,
  resolveHookVideoSource,
} from "@/lib/trending/hook-video-sources";
import { HookSuggestionRequestSchema } from "@/lib/trending/hook-video-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = HookSuggestionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return hookVideoJson(
      { error: "Choose an influencer video and product demo first.", ok: false },
      400,
    );
  }

  try {
    const profile = await getBusinessProfileForUser(auth.user.uid);

    if (!profile) {
      return hookVideoJson(
        {
          code: "business_profile_required",
          error: "Complete your business profile before generating hooks.",
          ok: false,
        },
        409,
      );
    }

    const [influencer, source, demo] = await Promise.all([
      getHookInfluencerForUser({
        influencerId: parsed.data.influencerId,
        sourceKind: parsed.data.sourceKind,
        userId: auth.user.uid,
      }),
      resolveHookVideoSource({
        influencerId: parsed.data.influencerId,
        sourceKind: parsed.data.sourceKind,
        userId: auth.user.uid,
        videoId: parsed.data.influencerVideoId,
      }),
      getHookDemoAsset({
        assetId: parsed.data.demoAssetId,
        userId: auth.user.uid,
      }),
    ]);
    const texts = await generateBusinessHookSuggestions({
      business: profile.context,
      demoTitle: demo.title,
      influencerName: influencer.name,
    });
    const suggestions = await createHookVideoSuggestions({
      businessProfileId: profile.id,
      demoAssetId: demo.id,
      influencerId: influencer.id,
      influencerVideoId: source.id,
      sourceKind: source.sourceKind,
      texts,
      userId: auth.user.uid,
    });

    return hookVideoJson({ ok: true, suggestions });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "OpenAI is not configured."
    ) {
      return hookVideoJson(
        { error: "AI hook generation is not configured.", ok: false },
        501,
      );
    }

    return hookVideoErrorResponse(error, "Could not generate hook suggestions.");
  }
}
