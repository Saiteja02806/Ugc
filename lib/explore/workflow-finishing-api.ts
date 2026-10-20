import "server-only";

import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { ExploreFinishError, isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { startWorkflowFinishingForOwner, getWorkflowFinishingForOwner } from "./workflow-finishing-service";
export { fingerprintExploreFinish } from "./workflow-finishing-service";

const MAX_BODY_BYTES = 32 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
async function bodyJson(request: Request) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ExploreFinishError("Send a JSON finishing draft.", 415);
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new ExploreFinishError("The finishing draft is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ExploreFinishError("Choose a finishing draft.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) throw new ExploreFinishError("The finishing draft is too large.", 413);
      chunks.push(chunk.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new ExploreFinishError("Choose a valid JSON finishing draft."); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Queues a committed, owned edit only. No ffmpeg or paid ASR in the app route. */
export async function handleWorkflowFinishingStart(request: Request) {
  try {
    const owner = (await requireAIStudioProUser(request)).uid;
    // Enable only after the migration and matching worker are ready. This gate
    // is not authorization to omit Explore from the complete release.
    if (process.env.EXPLORE_FINISHING_ENABLED !== "true") throw new ExploreFinishError("Video finishing is not enabled yet.", 503);
    const body = await bodyJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ExploreFinishError("Choose a valid finishing request.");
    const raw = body as Record<string, unknown>;
    if (Object.keys(raw).some(key => !["requestKey", "draft"].includes(key)) || !isExploreUuid(raw.requestKey) ||
        request.headers.get("Idempotency-Key")?.toLowerCase() !== raw.requestKey.toLowerCase()) throw new ExploreFinishError("Invalid finishing request identity.");
    const { result, httpStatus } = await startWorkflowFinishingForOwner(owner, raw.requestKey, raw.draft);
    return json(result, httpStatus);
  } catch (error) { return errorResponse(error); }
}

/** Read-only owner recovery, even when starts are off. Absence is not proof an
 * interrupted POST cannot still commit. Never create or dispatch from GET. */
export async function handleWorkflowFinishingStatus(request: Request) {
  try {
    const owner = (await requireFirebaseUser(request)).uid;
    const query = new URL(request.url).searchParams, key = query.get("requestKey");
    if (!isExploreUuid(key) || Array.from(query.keys()).some(name => name !== "requestKey") || query.getAll("requestKey").length !== 1) throw new ExploreFinishError("Invalid saved finishing identity.");
    return json(await getWorkflowFinishingForOwner(owner, key));
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) return json({ ok: false, error: error.message }, error.status);
  if (error instanceof ExploreFinishError) return json({ ok: false, error: error.message, code: error.code }, error.status);
  return json({ ok: false, error: "Could not confirm finishing. Check this saved request before starting another edit." }, 503);
}
