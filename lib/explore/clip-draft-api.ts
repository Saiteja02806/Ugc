import "server-only";
import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { clipDraftScope, ExploreClipDraftError, parseClipDraftSave } from "./clip-draft-contract";
import { ExploreClipDraftStore } from "./clip-draft-store";

const json = (body: unknown, status = 200, elapsed?: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization",
  ...(elapsed === undefined ? {} : { "Server-Timing": `clip_save;dur=${elapsed}` }) } });
async function boundedBody(request: Request) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ExploreClipDraftError("Send JSON clip edits.", 415);
  const limit = 128 * 1024, declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new ExploreClipDraftError("These edits are too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ExploreClipDraftError("Choose clip edits to save.");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength;
      if (length > limit) throw new ExploreClipDraftError("These edits are too large.", 413); chunks.push(part.value); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new ExploreClipDraftError("Send valid JSON clip edits."); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function handleClipDraftRead(request: Request) {
  try {
    const owner = (await requireFirebaseUser(request)).uid;
    const query = new URL(request.url).searchParams, source = query.get("sourceAssetId"), scope = clipDraftScope(query.get("scope"));
    if (!isExploreUuid(source) || query.getAll("sourceAssetId").length !== 1 || query.getAll("scope").length !== 1 ||
        Array.from(query.keys()).some(key => key !== "sourceAssetId" && key !== "scope")) throw new ExploreClipDraftError("Choose a saved clip to edit.");
    const store = new ExploreClipDraftStore();
    const draft = await store.read(owner, source.toLowerCase(), scope);
    return json({ ok: true, draft, initialContent: draft ? null : await store.initialContent(owner, source.toLowerCase(), scope) });
  } catch (error) { return failure(error); }
}
export async function handleClipDraftSave(request: Request) {
  const started = Date.now();
  try {
    const owner = (await requireFirebaseUser(request)).uid;
    const input = parseClipDraftSave(await boundedBody(request));
    if (request.headers.get("Idempotency-Key")?.toLowerCase() !== input.requestId) throw new ExploreClipDraftError("The save identity does not match.", 428);
    return json({ ok: true, ...await new ExploreClipDraftStore().save(owner, input) }, 200, Date.now() - started);
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) return json({ ok: false, error: error.message }, error.status);
  if (error instanceof ExploreClipDraftError) return json({ ok: false, error: error.message, code: error.code }, error.status);
  return json({ ok: false, error: "Could not save your clip edits. Your local changes are kept." }, 503);
}
