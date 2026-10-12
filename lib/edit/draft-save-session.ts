import { EditDraftError, parseEditDraft } from "./draft-contract";
import type { EditableVideoDraftInput } from "./video-library";

export type EditDraftSaveRequest = { draft: EditableVideoDraftInput; requestId: string; expectedRevision: number };
/** The browser serializes calls. Recover an ambiguous save before sending newer edits. */
export class EditDraftSaveSession<T extends { draftRevision?: number }> {
  private pending: EditDraftSaveRequest | null = null;
  private conflict = false;
  constructor(private revision: number, private readonly uuid = () => crypto.randomUUID()) {}
  async save(value: unknown, send: (request: EditDraftSaveRequest) => Promise<T>): Promise<T> {
    if (this.conflict) throw new EditDraftError("DRAFT_CHANGED", "This draft changed in another session. Reload the saved draft before trying again.", 409);
    const draft = parseEditDraft(value);
    let recovered: T | null = null;
    if (this.pending) {
      const pendingDraft = this.pending.draft;
      recovered = await this.commit(send);
      if (JSON.stringify(draft) === JSON.stringify(pendingDraft)) return recovered;
    }
    this.pending = { draft, requestId: this.uuid(), expectedRevision: this.revision };
    return this.commit(send);
  }
  private async commit(send: (request: EditDraftSaveRequest) => Promise<T>): Promise<T> {
    try {
      const video = await send(this.pending!);
      if (!Number.isSafeInteger(video.draftRevision) || video.draftRevision! < 0)
        throw new EditDraftError("DRAFTS_UNAVAILABLE", "Could not verify the saved draft. Retry this save.", 503);
      this.revision = video.draftRevision!;
      this.pending = null;
      return video;
    } catch (error) {
      if (error instanceof EditDraftError && ["DRAFT_CHANGED", "DRAFT_REQUEST_CONFLICT", "DRAFT_PRECONDITION_REQUIRED"].includes(error.code)) this.conflict = true;
      if (error instanceof EditDraftError && error.code === "INVALID_DRAFT") this.pending = null;
      throw error;
    }
  }
}
