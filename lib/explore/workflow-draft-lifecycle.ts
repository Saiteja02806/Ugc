import { readWorkflowSession, serializeWorkflowSession, workflowSessionStorageKey, type WorkflowSession } from "./workflow-session.ts";

const PREFIX = "ugc-explore:work-draft:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type DraftRecord = { version: 1; draftId: string; updatedAt: number; state: "editing" | "scheduled"; value: string };
export type WorkflowDraftEntry = { id: string; createNew: boolean };
export function isWorkflowDraftId(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function scopedKey(key: string, id: string) {
  if (!isWorkflowDraftId(id)) throw new Error("This workflow draft could not be verified.");
  return `${PREFIX}${key}:${id}`;
}
function record(raw: string | null, id: string): DraftRecord | null {
  if (raw === null) return null;
  if (raw.length > 600_000) throw new Error("This workflow draft is too large to restore safely.");
  const value = JSON.parse(raw) as DraftRecord;
  if (!value || value.version !== 1 || value.draftId !== id || !Number.isFinite(value.updatedAt) ||
      !["editing", "scheduled"].includes(value.state) || typeof value.value !== "string") throw new Error("This workflow draft could not be verified.");
  return value;
}
/** Non-expiring draft state. Only explicit entry intent decides whether to open it.
 * Each owner-qualified base key stays isolated by the workflow's unique ID. */
export function workflowDraftStorage(storage: Store, id: string): Store {
  return {
    getItem(key) { return record(storage.getItem(scopedKey(key, id)), id)?.value ?? null; },
    setItem(key, value) {
      const previous = record(storage.getItem(scopedKey(key, id)), id);
      storage.setItem(scopedKey(key, id), JSON.stringify({ version: 1, draftId: id, updatedAt: Date.now(), state: previous?.state ?? "editing", value } satisfies DraftRecord));
    },
    removeItem(key) { storage.removeItem(scopedKey(key, id)); },
  };
}
export function markWorkflowDraftScheduled(storage: Store, owner: string, id: string) {
  const key = scopedKey(workflowSessionStorageKey(owner), id), previous = record(storage.getItem(key), id);
  if (previous && previous.state !== "scheduled") storage.setItem(key, JSON.stringify({ ...previous, state: "scheduled", updatedAt: Date.now() }));
}
export function workflowDraftState(storage: Store, owner: string, id: string) {
  return record(storage.getItem(scopedKey(workflowSessionStorageKey(owner), id)), id)?.state ?? null;
}
/** No shared index to overwrite when separate tabs save separate drafts. */
export function listWorkflowDrafts(storage: Store & Pick<Storage, "length" | "key">, owner: string) {
  const prefix = `${PREFIX}${workflowSessionStorageKey(owner)}:`;
  const drafts: { id: string; updatedAt: number; state: DraftRecord["state"]; session: WorkflowSession }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const id = key.slice(prefix.length);
    if (!isWorkflowDraftId(id)) continue;
    try {
      const saved = record(storage.getItem(key), id), session = readWorkflowSession(saved?.value ?? null, owner);
      if (saved && session && (session.generatedAssetId || session.sourceAssetId || session.demoAssetId || session.instructions.trim() ||
        session.pendingSource || session.localReferences || workflowDraftStorage(storage, id).getItem(`ugc-explore.generation.v1.${encodeURIComponent(owner)}.hook`))) drafts.push({ id, updatedAt: saved.updatedAt, state: saved.state, session });
    } catch { /* One unreadable draft cannot hide the other owned drafts. */ }
  }
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
}
export function draftEntryIntent(input: { id: string | null; explicitResume: boolean; navigationType: string; discarded: boolean; activeId: string | null }) {
  if (!isWorkflowDraftId(input.id)) return "new" as const;
  if (input.explicitResume) return "resume" as const;
  if (!input.discarded && input.navigationType === "reload" && input.activeId === input.id) return "reload" as const;
  return "ask" as const;
}
export function createWorkflowDraft(storage: Store, owner: string, id: string, session: WorkflowSession) {
  workflowDraftStorage(storage, id).setItem(workflowSessionStorageKey(owner), serializeWorkflowSession(session));
}
/** Keep uncertain paid requests account-wide; attribute their eventual result to
 * the task that submitted them instead of whichever screen happens to be open. */
export function workflowDraftRequestStorage(storage: Store, requestStorageKey: string, draftId: string): Store {
  return {
    getItem: key => storage.getItem(key), removeItem: key => storage.removeItem(key),
    setItem(key, value) {
      if (key === requestStorageKey) {
        const request = JSON.parse(value);
        if (typeof request.requestKey !== "string" || request.requestKey.length > 128) throw new Error("The generation request identity is invalid.");
        storage.setItem(`${requestStorageKey}:draft:${request.requestKey}`, draftId);
      }
      storage.setItem(key, value);
    },
  };
}
export function workflowRequestDraft(storage: Pick<Storage, "getItem">, key: string, requestKey: string): string | null {
  const id = storage.getItem(`${key}:draft:${requestKey}`);
  return isWorkflowDraftId(id) ? id : null;
}
