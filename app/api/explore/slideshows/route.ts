import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";

export async function POST(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    if (process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED !== "true") return Response.json({ error: "Slideshow saving is not enabled yet." }, { status: 503 });
    const raw = await request.text();
    if (raw.length > 16_384) return Response.json({ error: "The slideshow request is too large." }, { status: 413 });
    let body: { requestKey?: unknown; referenceId?: unknown; slides?: unknown };
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "Choose a valid slideshow." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Choose a valid slideshow." }, { status: 400 });
    if (!isExploreUuid(body.requestKey) || request.headers.get("Idempotency-Key") !== body.requestKey || typeof body.referenceId !== "string" || !Array.isArray(body.slides)) return Response.json({ error: "Choose a valid slideshow." }, { status: 400 });
    const reference = getRecreateReferences().find(item => item.id === body.referenceId && item.format === "slideshow");
    if (!reference || reference.slides.length < 2 || reference.slides.length > 10 || body.slides.length !== reference.slides.length) return Response.json({ error: "This slideshow reference is unavailable." }, { status: 400 });
    const slides = [];
    for (const [index, original] of reference.slides.entries()) {
      const chosen = body.slides[index] as { referenceSlideId?: unknown; mediaAssetId?: unknown } | null;
      if (!chosen || chosen.referenceSlideId !== original.id || (chosen.mediaAssetId !== null && !isExploreUuid(chosen.mediaAssetId))) return Response.json({ error: "Keep the reference slides in their original order." }, { status: 400 });
      const asset = chosen.mediaAssetId ? await getMediaAssetForOwner({ userId: user.uid, assetId: chosen.mediaAssetId as string }) : null;
      if (chosen.mediaAssetId && (!asset || asset.collection !== "image" || asset.status !== "ready")) return Response.json({ error: "Choose a ready image from your account." }, { status: 400 });
      const url = asset?.url ?? original.url;
      if (!url.startsWith("https://") || !isTrustedStorageUrl(url)) return Response.json({ error: "This slide is unavailable for publishing." }, { status: 400 });
      slides.push({ slideNumber: index + 1, referenceSlideId: original.id, mediaAssetId: asset?.id ?? null, renderedUrl: url, renderedS3Key: asset?.storage_key ?? null });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ referenceId: reference.id, slides })).digest("hex");
    const databaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const databaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!databaseUrl || !databaseKey) throw new Error("Slideshow saving is unavailable.");
    const client = createClient(databaseUrl, databaseKey, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("explore_save_slideshow", { p_user_id: user.uid, p_request_key: body.requestKey, p_fingerprint: fingerprint, p_title: reference.title, p_slides: slides, p_metadata: { referenceId: reference.id } });
    if (error || !isExploreUuid(data)) throw new Error("Could not confirm the saved slideshow. Retry the same save.");
    return Response.json({ ok: true, id: data, kind: "library_item", title: reference.title, url: slides[0].renderedUrl, slides: slides.map(slide => slide.renderedUrl) });
  } catch (error) {
    return Response.json({ error: error instanceof FirebaseAuthRequestError ? error.message : error instanceof Error ? error.message : "Could not save the slideshow." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 503 });
  }
}
