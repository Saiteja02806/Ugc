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
    if (!uuid.test(key) || !["image", "video"].includes(kind ?? "") || ![1, 2, 3, 4].includes(quantity) ||
        !(kind === "image" ? ["studio", "slideshow"] : ["studio", "hook", "wall_text"]).includes(scope ?? "")) {
      return Response.json({ ok: false, message: "Invalid generation recovery identity." }, { status: 400 });
    }
    const jobType = kind === "image" ? "generate_image" : "generate_hook_video";
    const records = await Promise.all(Array.from({ length: quantity }, (_, index) => getBackgroundJobByIdempotencyKey(quantity === 1 ? key : `${key}:${index + 1}`, { userId: user.uid, jobType })));
    const jobs = records.flatMap(job => {
      if (!job) return [];
      const input = job.input && typeof job.input === "object" && !Array.isArray(job.input) ? job.input : null;
      const resultId = input?.[kind === "image" ? "generationId" : "videoId"];
      if (job.userId !== user.uid || job.jobType !== jobType || !input || (input.exploreFormat ?? "studio") !== scope || !uuid.test(String(resultId))) throw new Error("Saved job identity does not match");
      return [{ jobId: job.id, ...(kind === "image" ? { generationId: String(resultId) } : { videoId: String(resultId) }) }];
    });
    return Response.json({ ok: true, requestKey: key, jobs, jobId: jobs[0]?.jobId ?? null, outcome: jobs.length ? "confirmed" : "unconfirmed", partial: jobs.length < quantity,
      message: jobs.length < quantity && jobs.length ? `Recovered ${jobs.length} saved outputs. No replacement batch was submitted.` : "Your saved generation was recovered." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify this saved generation." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 503 });
  }
}
