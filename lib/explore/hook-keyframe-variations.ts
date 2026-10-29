import { createHookKeyframeCheckpoint, readHookKeyframeCheckpoint, type HookKeyframeCheckpoint } from "./hook-keyframe-client.ts";
import { createHookKeyframeDraft, type HookKeyframeDraft, type HookKeyframeScope } from "./hook-keyframe-draft.ts";

export const HOOK_KEYFRAME_MAX_VARIATIONS = 4;
export const HOOK_KEYFRAME_MAX_VARIATION_HISTORY = 12;
type VariationState = "planned" | "submitting" | "accepted" | "rejected" | "settled";
export type HookKeyframeVariation = {
  checkpoint: HookKeyframeCheckpoint;
  batchId: string;
  state: VariationState;
  error: string | null;
};
export type HookKeyframeVariations = {
  version: 1;
  scope: HookKeyframeScope;
  revision: number;
  batchId: string | null;
  selectedRequestKey: string | null;
  entries: HookKeyframeVariation[];
};
export type HookKeyframeVariationStore = HookKeyframeVariations;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES = new Set<VariationState>(["planned", "submitting", "accepted", "rejected", "settled"]);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key)) && keys.every(key => key in value);
function invalid(): never { throw new Error("The saved starting-image variations could not be verified. Their recovery records have been preserved."); }
function nextRevision(store: HookKeyframeVariations) {
  if (!Number.isSafeInteger(store.revision + 1)) invalid();
  return store.revision + 1;
}
export function hookKeyframeVariationsKey(scope: HookKeyframeScope) {
  createHookKeyframeDraft(scope);
  return `ugc-explore:hook-frame-variations:v1:${encodeURIComponent(scope.ownerId)}:${scope.draftId}:${scope.referenceId}`;
}
export function readHookKeyframeVariations(raw: string | null, scope: HookKeyframeScope): HookKeyframeVariations | null {
  if (raw === null) return null;
  try {
    createHookKeyframeDraft(scope);
    if (!raw || raw.length > 768_000) invalid();
    const value: unknown = JSON.parse(raw);
    if (!object(value) || !exact(value, ["version", "scope", "revision", "batchId", "selectedRequestKey", "entries"]) || value.version !== 1 ||
      !object(value.scope) || !exact(value.scope, ["ownerId", "draftId", "referenceId", "sourceSha256"]) ||
      Object.keys(scope).some(key => (value.scope as Record<string, unknown>)[key] !== scope[key as keyof HookKeyframeScope]) ||
      !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
      value.batchId !== null && (typeof value.batchId !== "string" || !UUID.test(value.batchId)) ||
      value.selectedRequestKey !== null && (typeof value.selectedRequestKey !== "string" || !UUID.test(value.selectedRequestKey)) ||
      !Array.isArray(value.entries) || value.entries.length > HOOK_KEYFRAME_MAX_VARIATION_HISTORY) invalid();
    const keys = new Set<string>();
    const entries = value.entries.map((entry: unknown): HookKeyframeVariation => {
      if (!object(entry) || !exact(entry, ["checkpoint", "batchId", "state", "error"]) || typeof entry.batchId !== "string" || !UUID.test(entry.batchId) ||
        !STATES.has(entry.state as VariationState) || entry.error !== null && (typeof entry.error !== "string" || entry.error.length > 1_000)) invalid();
      const checkpoint = readHookKeyframeCheckpoint(JSON.stringify(entry.checkpoint), scope);
      if (!checkpoint || keys.has(checkpoint.requestKey.toLowerCase())) invalid();
      const input = JSON.parse(checkpoint.inputKey) as Record<string, unknown>;
      if (!object(input) || input.version !== 1 && input.version !== 2 && input.version !== 3 && input.version !== 4 ||
        Object.keys(scope).some(key => input[key] !== scope[key as keyof HookKeyframeScope])) invalid();
      if ((entry.state === "planned" || entry.state === "submitting" || entry.state === "rejected") && checkpoint.jobId !== null ||
        (entry.state === "accepted" || entry.state === "settled") && !checkpoint.jobId || entry.state !== "rejected" && entry.error !== null) invalid();
      keys.add(checkpoint.requestKey.toLowerCase());
      return { checkpoint, batchId: entry.batchId, state: entry.state as VariationState, error: entry.error as string | null };
    });
    if (value.batchId !== null && !entries.some(entry => entry.batchId === value.batchId) ||
      value.selectedRequestKey !== null && !entries.some(entry => entry.checkpoint.requestKey === value.selectedRequestKey && (entry.state === "accepted" || entry.state === "settled"))) invalid();
    const batchCounts = new Map<string, number>();
    for (const entry of entries) {
      const count = (batchCounts.get(entry.batchId) ?? 0) + 1;
      if (count > HOOK_KEYFRAME_MAX_VARIATIONS) invalid();
      batchCounts.set(entry.batchId, count);
    }
    return { version: 1, scope: { ...scope }, revision: value.revision as number, batchId: value.batchId as string | null,
      selectedRequestKey: value.selectedRequestKey as string | null, entries };
  } catch { return invalid(); }
}
function checked(store: HookKeyframeVariations) { return readHookKeyframeVariations(JSON.stringify(store), store.scope)!; }

/** Only an explicit Generate action creates plans. Restored plans are never work
 * to resume: only submitting/accepted entries may trigger status reads. */
export function createHookKeyframeVariationBatch(previous: HookKeyframeVariations | null, draft: HookKeyframeDraft, requestKeys: string[]): HookKeyframeVariations {
  if (requestKeys.length < 1 || requestKeys.length > HOOK_KEYFRAME_MAX_VARIATIONS || requestKeys.some(key => !UUID.test(key)) ||
    new Set(requestKeys.map(key => key.toLowerCase())).size !== requestKeys.length) invalid();
  const prior = previous ? readHookKeyframeVariations(JSON.stringify(previous), draft.scope)! : null;
  let entries = prior?.entries.filter(entry => entry.state !== "planned") ?? [];
  if (entries.some(entry => requestKeys.some(key => key.toLowerCase() === entry.checkpoint.requestKey.toLowerCase()))) invalid();
  const batchId = requestKeys[0];
  const plans = requestKeys.map(requestKey => ({ checkpoint: createHookKeyframeCheckpoint(draft, requestKey), batchId, state: "planned" as const, error: null }));
  // Never evict an uncertain or running paid request. Oldest terminal rows may
  // leave the local chooser; the account's generated-media inventory remains.
  const protectedKey = prior?.selectedRequestKey;
  while (entries.length + plans.length > HOOK_KEYFRAME_MAX_VARIATION_HISTORY) {
    const index = entries.findIndex(entry => (entry.state === "settled" || entry.state === "rejected") && entry.checkpoint.requestKey !== protectedKey);
    if (index < 0) throw new Error("Check the saved image requests before generating more variations.");
    entries = entries.filter((_, i) => i !== index);
  }
  return checked({ version: 1, scope: { ...draft.scope }, revision: prior ? nextRevision(prior) : 1, batchId,
    selectedRequestKey: prior?.selectedRequestKey ?? null, entries: [...entries, ...plans] });
}

/** Call under the same Web Lock as the persisted revision comparison. Set
 * submitting and persist BEFORE POST; a network failure leaves it recoverable. */
export function updateHookKeyframeVariation(store: HookKeyframeVariations, requestKey: string,
  patch: { state: VariationState; jobId?: string | null; error?: string | null }): HookKeyframeVariations {
  const previous = checked(store);
  const entry = previous.entries.find(item => item.checkpoint.requestKey === requestKey);
  if (!entry || !object(patch) || !Object.keys(patch).every(key => ["state", "jobId", "error"].includes(key))) invalid();
  const transitions: Record<VariationState, readonly VariationState[]> = {
    planned: ["submitting"], submitting: ["accepted", "rejected", "settled"], accepted: ["accepted", "settled"], rejected: [], settled: [],
  };
  if (!transitions[entry.state].includes(patch.state)) invalid();
  const jobId = patch.jobId === undefined ? entry.checkpoint.jobId : patch.jobId;
  if (entry.checkpoint.jobId && jobId !== entry.checkpoint.jobId) invalid();
  return checked({ ...previous, revision: nextRevision(previous),
    selectedRequestKey: patch.state === "rejected" && previous.selectedRequestKey === requestKey ? null : previous.selectedRequestKey,
    entries: previous.entries.map(item => item !== entry ? item : { ...item, state: patch.state,
      checkpoint: { ...item.checkpoint, jobId }, error: patch.state === "rejected" ? patch.error ?? null : null }) });
}
export function selectHookKeyframeVariation(store: HookKeyframeVariations, requestKey: string): HookKeyframeVariations {
  const previous = checked(store);
  if (!previous.entries.some(entry => entry.checkpoint.requestKey === requestKey && (entry.state === "accepted" || entry.state === "settled"))) invalid();
  return checked({ ...previous, revision: nextRevision(previous), selectedRequestKey: requestKey });
}
export function importHookKeyframeCheckpoint(checkpoint: HookKeyframeCheckpoint): HookKeyframeVariations {
  return checked({ version: 1, scope: checkpoint.scope, revision: 1, batchId: checkpoint.requestKey,
    selectedRequestKey: checkpoint.jobId ? checkpoint.requestKey : null,
    entries: [{ checkpoint, batchId: checkpoint.requestKey, state: checkpoint.jobId ? "accepted" : "submitting", error: null }] });
}
export function hookKeyframeRecoverableVariations(store: HookKeyframeVariations): HookKeyframeVariation[] {
  return checked(store).entries.filter(entry => entry.state === "submitting" || entry.state === "accepted");
}
