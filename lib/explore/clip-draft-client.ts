import { ExploreClipDraftError, parseClipDraftContent, parseClipDraftReceipt, parseClipDraftSave,
  type ExploreClipDraft, type ExploreClipDraftContent, type ExploreClipDraftSaveRequest } from "./clip-draft-contract.ts";
import { ReadDeadlineError, withReadDeadline } from "../http/read-deadline.ts";

const same = (a: ExploreClipDraftContent, b: ExploreClipDraftContent) => JSON.stringify(a) === JSON.stringify(b);
export function clipDraftPendingKey(owner: string, scope: string, sourceAssetId: string) {
  return `ugc-explore:clip-save:v1:${owner}:${scope}:${sourceAssetId}`;
}
export type ClipDraftTransport = { token: () => Promise<string | null>; fetch: typeof fetch; tokenDeadlineMs?: number; readDeadlineMs?: number };
const TOKEN_DEADLINE_MS = 8_000;
const READ_DEADLINE_MS = 20_000;
async function request(deps: ClipDraftTransport, url: string, body?: ExploreClipDraftSaveRequest, parentSignal?: AbortSignal) {
  // Sign-in has its own budget. Folding it into the read deadline made a slow
  // token refresh abort the draft request while the server was still checking
  // the account, which blocked Schedule after 15 seconds.
  let token: string | null;
  try { token = await withReadDeadline(async signal => { const value = await deps.token(); signal.throwIfAborted(); return value; }, parentSignal, deps.tokenDeadlineMs ?? TOKEN_DEADLINE_MS); }
  catch (error) {
    if (error instanceof ReadDeadlineError) throw new ExploreClipDraftError(body
      ? "Could not confirm your saved edits in time. Retry Save edits to check the same save."
      : "Sign-in is still loading. Retry loading your saved edits.", 503, "clip_draft_unavailable");
    throw error;
  }
  if (!token) throw new ExploreClipDraftError("Sign in to save your edits.", 401);
  const read = () => withReadDeadline(async signal => {
    if (parentSignal?.aborted) parentSignal.throwIfAborted();
    // Call fetch unbound. A browser's native fetch rejects a transport object as this.
    const send = deps.fetch;
    const response = await send(url, { method: body ? "POST" : "GET", cache: "no-store", signal,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json", "Idempotency-Key": body.requestId } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new ExploreClipDraftError(result?.error ?? "Could not confirm your saved edits. Retry this save.", response.status, result?.code ?? "clip_draft_unavailable");
    return result;
  }, parentSignal, deps.readDeadlineMs ?? READ_DEADLINE_MS);
  try { return await read(); }
  catch (error) {
    // A read is safe to repeat once. A save keeps its single attempt so a late
    // reply cannot start a second mutation after the screen offers Retry.
    if (error instanceof ReadDeadlineError && !body && !parentSignal?.aborted) {
      try { return await read(); }
      catch (retryError) { if (!(retryError instanceof ReadDeadlineError)) throw retryError; }
    }
    if (error instanceof ReadDeadlineError) throw new ExploreClipDraftError(body
      ? "Could not confirm your saved edits in time. Retry Save edits to check the same save."
      : "Loading your saved edits took too long. Please retry loading your saved edits.", 503, "clip_draft_unavailable");
    throw error;
  }
}
export async function loadClipDraft(deps: ClipDraftTransport, sourceAssetId: string, scope: string, signal?: AbortSignal) {
  const result = await request(deps, `/api/explore/clip-drafts?${new URLSearchParams({ sourceAssetId, scope })}`, undefined, signal);
  return result.draft === null ? null : parseClipDraftReceipt(result.draft, sourceAssetId, scope);
}
export async function loadClipDraftWithInitial(deps: ClipDraftTransport, sourceAssetId: string, scope: string, signal?: AbortSignal) {
  const result = await request(deps, `/api/explore/clip-drafts?${new URLSearchParams({ sourceAssetId, scope })}`, undefined, signal);
  const draft = result.draft === null ? null : parseClipDraftReceipt(result.draft, sourceAssetId, scope);
  const initialContent = !draft && result.initialContent ? parseClipDraftContent(result.initialContent) : null;
  if (initialContent && (!["hook", "wall_text"].includes(scope) || initialContent.editing.format !== scope || initialContent.sourceAssetId !== sourceAssetId)) throw new ExploreClipDraftError("The initial clip belongs to a different source.");
  return { draft, initialContent };
}
export async function saveClipDraft(deps: ClipDraftTransport, input: ExploreClipDraftSaveRequest) {
  const result = await request(deps, "/api/explore/clip-drafts", input);
  const draft = parseClipDraftReceipt(result.draft, input.content.sourceAssetId, input.scope);
  if (result.requestId !== input.requestId || typeof result.replayed !== "boolean" || !same(draft.content, input.content))
    throw new ExploreClipDraftError("Could not verify these saved edits. Retry this save.", 503);
  return draft;
}
/** Lost replies must recover the exact accepted snapshot before saving newer edits. */
export class ClipDraftSaveSession {
  private pending: ExploreClipDraftSaveRequest | null;
  private conflict = false;
  constructor(private revision: number, private readonly scope: string, private readonly source: string,
    private readonly persist: (request: ExploreClipDraftSaveRequest | null) => void, pending: unknown = null,
    private readonly uuid = () => crypto.randomUUID()) {
    this.pending = pending === null ? null : parseClipDraftSave(pending);
    if (this.pending && (this.pending.scope !== scope || this.pending.content.sourceAssetId !== source)) throw new ExploreClipDraftError("The saved request belongs to a different clip.");
  }
  async save(value: ExploreClipDraftContent, send: (request: ExploreClipDraftSaveRequest) => Promise<ExploreClipDraft>) {
    if (this.conflict) throw new ExploreClipDraftError("This clip changed in another session. Your local edits are kept; reload the saved draft before saving again.", 409, "clip_draft_changed");
    const content = parseClipDraftContent(value);
    if (content.sourceAssetId !== this.source) throw new ExploreClipDraftError("Choose this clip before saving.");
    if (this.pending) { const prior = this.pending.content, recovered = await this.commit(send); if (same(content, prior)) return recovered; }
    this.pending = { scope: this.scope, expectedRevision: this.revision, requestId: this.uuid(), content };
    this.persist(this.pending);
    return this.commit(send);
  }
  private async commit(send: (request: ExploreClipDraftSaveRequest) => Promise<ExploreClipDraft>) {
    try {
      const request = this.pending!;
      this.persist(request);
      const draft = await send(request);
      const verified = parseClipDraftReceipt(draft, this.source, this.scope);
      if (!same(verified.content, request.content) || verified.revision < request.expectedRevision)
        throw new ExploreClipDraftError("Could not verify these saved edits. Retry this save.", 503);
      this.revision = verified.revision; this.pending = null; this.persist(null); return verified;
    } catch (error) {
      if (error instanceof ExploreClipDraftError && ["clip_draft_changed", "clip_draft_request_conflict", "clip_draft_precondition_required"].includes(error.code)) this.conflict = true;
      if (error instanceof ExploreClipDraftError && error.code === "clip_draft_invalid") { this.pending = null; this.persist(null); }
      throw error;
    }
  }
}
