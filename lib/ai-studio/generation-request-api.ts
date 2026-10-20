import "server-only";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getBackgroundJobByIdempotencyKey } from "@/lib/jobs/background-jobs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Recovery reads terminal jobs too, and never reserves credits or dispatches. */
export async function handleGenerationRequestRecovery(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const query = new URL(request.url).searchParams;
    const key = query.get("requestKey") ?? "", kind = query.get("kind"), scope = query.get("scope"), quantity = Number(query.get("quantity"));
    const slideCountValue = query.get("slideshowSlideCount");
    const slideCount = slideCountValue === null ? 1 : Number(slideCountValue);
    if (!uuid.test(key) || !["image", "video"].includes(kind ?? "") || ![1, 2, 3, 4].includes(quantity) ||
        (slideCountValue !== null && (kind !== "image" || scope !== "slideshow" || !Number.isInteger(slideCount) || slideCount < 1 || slideCount > 10)) ||
        !(kind === "image" ? ["studio", "slideshow"] : ["studio", "hook", "wall_text"]).includes(scope ?? "")) {
      return Response.json({ ok: false, message: "Invalid generation recovery identity." }, { status: 400 });
    }
    const total = quantity * slideCount;
    const jobType = kind === "image" ? "generate_image" : "generate_hook_video";
    const records = await Promise.all(Array.from({ length: total }, (_, index) => getBackgroundJobByIdempotencyKey(total === 1 ? key : `${key}:${index + 1}`, { userId: user.uid, jobType })));
    const jobs = records.flatMap((job, index) => {
      if (!job) return [];
      const input = job.input && typeof job.input === "object" && !Array.isArray(job.input) ? job.input : null;
      const resultId = input?.[kind === "image" ? "generationId" : "videoId"];
      if (job.userId !== user.uid || job.jobType !== jobType || !input || (input.exploreFormat ?? "studio") !== scope || !uuid.test(String(resultId))) throw new Error("Saved job identity does not match");
      let slideshowGeneration;
      if (slideCountValue !== null) {
        const group = input.slideshowGeneration;
        if (!group || typeof group !== "object" || Array.isArray(group)) throw new Error("Saved slideshow identity does not match");
        const metadata = group as Record<string, unknown>;
        if (metadata.version !== 1 || metadata.batchKey !== key || metadata.slideCount !== slideCount || metadata.versionCount !== quantity ||
            metadata.slideIndex !== (index % slideCount) + 1 || metadata.versionIndex !== Math.floor(index / slideCount) + 1) throw new Error("Saved slideshow identity does not match");
        // Return only the validated group identity; never expose arbitrary job input.
        slideshowGeneration = { version: 1, batchKey: key, slideIndex: (index % slideCount) + 1, slideCount, versionIndex: Math.floor(index / slideCount) + 1, versionCount: quantity };
      } else if (input.slideshowGeneration !== undefined) {
        throw new Error("Saved slideshow request requires its original slide count");
      }
      return [{ jobId: job.id, ...(kind === "image" ? { generationId: String(resultId) } : { videoId: String(resultId) }), ...(slideshowGeneration ? { slideshowGeneration } : {}) }];
    });
    return Response.json({ ok: true, requestKey: key, jobs, jobId: jobs[0]?.jobId ?? null, outcome: jobs.length ? "confirmed" : "unconfirmed", partial: jobs.length < total,
      message: jobs.length < total && jobs.length ? `Recovered ${jobs.length} of ${total} saved outputs. No replacement batch was submitted.` : "Your saved generation was recovered." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify this saved generation." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 503 });
  }
}
