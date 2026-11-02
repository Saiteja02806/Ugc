import "server-only";

import { NextResponse } from "next/server";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { canonicalMediaReference, isTrustedMediaReferenceUrl } from "@/lib/media/media-reference";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { readSlideshowGenerationSlot } from "@/worker/src/lib/slideshow-generation-batch";
import {
  BillingAccessError,
  getGenerationCreditCost,
  reserveBillingCredits,
} from "@/lib/billing/subscription-db";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_RATIOS = new Set(["1:1", "4:5", "9:16", "16:9"]);

export async function handleAIStudioFaceSwap(request: Request) {
  let user;
  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return NextResponse.json(
      {
        message: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify your session.",
        ok: false,
      },
      { status },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON request body.", ok: false }, { status: 400 });
  }

  const targetAssetId = typeof body.targetAssetId === "string" ? body.targetAssetId.trim() : "";
  const influencerAssetId = typeof body.influencerAssetId === "string" ? body.influencerAssetId.trim() : "";

  if (!UUID_PATTERN.test(targetAssetId) || !UUID_PATTERN.test(influencerAssetId)) {
    return NextResponse.json(
      { message: "Please provide a valid target image and influencer photo.", ok: false },
      { status: 400 },
    );
  }

  const [targetAsset, influencerAsset] = await Promise.all([
    getMediaAssetForOwner({ assetId: targetAssetId, userId: user.uid }),
    getMediaAssetForOwner({ assetId: influencerAssetId, userId: user.uid }),
  ]);

  if (!targetAsset || targetAsset.deleted_at !== null || targetAsset.status !== "ready") {
    return NextResponse.json({ message: "Target image is unavailable.", ok: false }, { status: 404 });
  }

  if (!influencerAsset || influencerAsset.deleted_at !== null || influencerAsset.status !== "ready") {
    return NextResponse.json({ message: "Influencer photo is unavailable.", ok: false }, { status: 404 });
  }

  const targetUrl = (await canonicalMediaReference(targetAsset.url, user.uid)) as string | null;
  const influencerUrl = (await canonicalMediaReference(influencerAsset.url, user.uid)) as string | null;

  if (!targetUrl || typeof targetUrl !== "string" || !isTrustedMediaReferenceUrl(targetUrl) || !influencerUrl || typeof influencerUrl !== "string" || !isTrustedMediaReferenceUrl(influencerUrl)) {
    return NextResponse.json({ message: "Reference media is not accessible.", ok: false }, { status: 400 });
  }

  const rawRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : targetAsset.ratio;
  const aspectRatio = SUPPORTED_RATIOS.has(rawRatio) ? rawRatio : "4:5";
  const slideshowGeneration = readSlideshowGenerationSlot(body.slideshowGeneration);
  const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, 2000) : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : crypto.randomUUID();

  const creditCost = getGenerationCreditCost("image");

  try {
    await reserveBillingCredits({
      amount: creditCost,
      idempotencyKey,
      jobType: "generate_image",
      userId: user.uid,
    });
  } catch (error) {
    if (error instanceof BillingAccessError) {
      return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
    }
    return NextResponse.json({ message: "Could not reserve generation credits.", ok: false }, { status: 402 });
  }

  try {
    const generationId = crypto.randomUUID();
    const job = await createAndDispatchBackgroundJob({
      jobType: "generate_image",
      userId: user.uid,
      projectId: "ai-studio",
      idempotencyKey,
      input: {
        generationId,
        model: "gemini_3_pro",
        provider: "openrouter",
        mode: "face_swap",
        aspectRatio,
        prompt: instructions || "Apply exact biometric influencer identity to the target scene photograph.",
        referenceImageUrl: targetUrl,
        referenceImageUrls: [targetUrl, influencerUrl],
        creditCost,
        ...(slideshowGeneration ? { slideshowGeneration, exploreFormat: "slideshow" } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      generationId,
      creditCost,
      message: "Face swap started.",
    });
  } catch (error) {
    console.error("Failed to dispatch face swap background job:", error);
    return NextResponse.json({ message: "Could not start face swap job.", ok: false }, { status: 502 });
  }
}
