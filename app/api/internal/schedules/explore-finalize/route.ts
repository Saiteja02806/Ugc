import { INTERNAL_FINALIZATION_SIGNATURE_HEADER, INTERNAL_FINALIZATION_TIMESTAMP_HEADER } from "@/lib/scheduling/finalization-signature";
import { verifyInternalFinalizationRequest } from "@/lib/scheduling/internal-finalization-auth";
import { reconcileExplorePendingSchedule } from "@/lib/explore/pending-schedule-service";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 4096)) return json({ ok: false, message: "Request body is too large." }, 413);
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false, message: "Request body is invalid." }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4096) return json({ ok: false, message: "Request body is too large." }, 413);
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body || Buffer.byteLength(body, "utf8") > 4096) return json({ ok: false, message: "Request body is invalid." }, 400);
  if (!verifyInternalFinalizationRequest({ body, signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
    timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER) })) return json({ ok: false, message: "Unauthorized." }, 401);
  let input: { userId?: unknown; requestKey?: unknown };
  try { input = JSON.parse(body); } catch { return json({ ok: false, message: "Send valid JSON." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["userId", "requestKey"].includes(key)) ||
      typeof input.userId !== "string" || !input.userId.trim() || input.userId.length > 128 || !isExploreUuid(input.requestKey)) return json({ ok: false, message: "Invalid preparation identity." }, 400);
  try { return json({ ok: true, ...await reconcileExplorePendingSchedule(input.userId, input.requestKey) }); }
  catch { return json({ ok: false, message: "Scheduling confirmation is pending and will be recovered." }, 503); }
}
