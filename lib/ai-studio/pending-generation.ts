export type PendingGeneration = { version: 1; ownerId: string; kind: "image" | "video"; scope: string; requestKey: string; input: Record<string, unknown> };
export class GenerationClarificationError extends Error {
  constructor(message: string, public clarifications: string[]) { super(message); }
}
export type SlideshowGenerationIdentity = { version: 1; batchKey: string; slideIndex: number; slideCount: number; versionIndex: number; versionCount: number };
export type RecoveredGeneration = { ok: true; jobId: string; jobs: { jobId: string; generationId?: string; videoId?: string; slideshowGeneration?: SlideshowGenerationIdentity }[]; partial: boolean; message: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const pendingGenerationKey = (owner: string, kind: PendingGeneration["kind"], scope: string) => `ugc-ai-studio:pending:v1:${encodeURIComponent(owner)}:${kind}:${scope}`;
export const generationDiscoveryKey = (owner: string, kind: PendingGeneration["kind"], scope: string) => `${pendingGenerationKey(owner, kind, scope)}:discovery`;
export function readGenerationDiscoveries(raw: string | null, owner: string, kind: PendingGeneration["kind"], scope: string): PendingGeneration[] {
  if (!raw) return [];
  if (raw.length > 2 * 1024 * 1024) throw new Error("The earlier generation records are too large to verify.");
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error("The earlier generation records could not be verified.");
  const verified = entries.map(entry => readPendingGeneration(JSON.stringify(entry), owner, kind, scope)!);
  if (verified.some(entry => !entry) || new Set(verified.map(entry => entry.requestKey)).size !== verified.length) throw new Error("The earlier generation records could not be verified.");
  return verified;
}
/** Merge browser hints without erasing a newer batch in the same owner/scope. */
export function mergeStoredGenerationJobIds(storage: Pick<Storage, "getItem">, key: string, jobs: readonly { jobId: string }[]) {
  const raw = storage.getItem(key);
  let prior: unknown = [];
  if (raw) { try { prior = JSON.parse(raw); } catch { prior = raw; } }
  const ids = Array.isArray(prior) ? prior : typeof prior === "string" ? [prior] : [];
  return [...new Set([...ids.filter((id): id is string => typeof id === "string" && uuid.test(id)), ...jobs.map(job => job.jobId)])];
}
export function readPendingGeneration(raw: string | null, owner: string, kind: PendingGeneration["kind"], scope: string): PendingGeneration | null {
  if (!raw) return null;
  if (raw.length > 128 * 1024) throw new Error("The saved generation request is too large to verify.");
  const saved = JSON.parse(raw) as PendingGeneration;
  if (saved?.version !== 1 || saved.ownerId !== owner || saved.kind !== kind || saved.scope !== scope || !uuid.test(saved.requestKey) ||
      !saved.input || typeof saved.input !== "object" || Array.isArray(saved.input) || typeof saved.input.prompt !== "string" ||
      ![1, 2, 3, 4].includes(Number(saved.input.quantity)) || saved.input.idempotencyKey !== saved.requestKey ||
      (saved.input.slideshowSlideCount !== undefined && (kind !== "image" || scope !== "slideshow" || !Number.isInteger(saved.input.slideshowSlideCount) || Number(saved.input.slideshowSlideCount) < 1 || Number(saved.input.slideshowSlideCount) > 10)) ||
      (saved.input.exploreFormat ?? "studio") !== scope) throw new Error("The saved generation request could not be verified. Keep its recovery record.");
  return saved;
}
function expectedOutputs(saved: PendingGeneration) {
  return Number(saved.input.quantity) * Number(saved.input.slideshowSlideCount ?? 1);
}
function recoveryQuery(saved: PendingGeneration) {
  const query = new URLSearchParams({ requestKey: saved.requestKey, kind: saved.kind, quantity: String(saved.input.quantity), scope: saved.scope });
  if (saved.input.slideshowSlideCount !== undefined) query.set("slideshowSlideCount", String(saved.input.slideshowSlideCount));
  return query;
}
function confirmed(value: unknown, saved: PendingGeneration): RecoveredGeneration {
  const v = value as RecoveredGeneration | null;
  const total = expectedOutputs(saved);
  if (!v?.ok || !Array.isArray(v.jobs) || !v.jobs.length || v.jobs.length > total ||
      !v.jobs.every(job => uuid.test(job.jobId) && uuid.test(String(saved.kind === "image" ? job.generationId : job.videoId))) ||
      new Set(v.jobs.map(job => job.jobId)).size !== v.jobs.length) throw new Error("Could not verify the generation response. The saved request is preserved.");
  if (saved.input.slideshowSlideCount !== undefined) {
    const slots = new Set<string>();
    for (const job of v.jobs) {
      const group = job.slideshowGeneration;
      if (!group || group.version !== 1 || group.batchKey !== saved.requestKey || group.slideCount !== saved.input.slideshowSlideCount || group.versionCount !== Number(saved.input.quantity) ||
          !Number.isInteger(group.slideIndex) || group.slideIndex < 1 || group.slideIndex > group.slideCount ||
          !Number.isInteger(group.versionIndex) || group.versionIndex < 1 || group.versionIndex > group.versionCount ||
          slots.has(`${group.versionIndex}:${group.slideIndex}`)) throw new Error("Could not verify the slideshow generation response. The saved request is preserved.");
      slots.add(`${group.versionIndex}:${group.slideIndex}`);
    }
  }
  return { ...v, jobId: v.jobs[0].jobId, partial: v.jobs.length < total };
}
/** Explicit clicks recover first; hydration never creates or resubmits work. */
export async function submitPendingGeneration(args: {
  ownerId: string; kind: PendingGeneration["kind"]; scope: string; input: Record<string, unknown>; token: string;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">; locks: Pick<LockManager, "request">;
  fetch: typeof fetch; uuid: () => string; assertActive: () => void;
  onStored: (saved: PendingGeneration) => void; acknowledge: (result: RecoveredGeneration, input: Record<string, unknown>) => void;
}) {
  const { fetch: sendRequest } = args;
  const key = pendingGenerationKey(args.ownerId, args.kind, args.scope);
  return args.locks.request(key, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Another tab is submitting this generation. Check its saved request first.");
    args.assertActive();
    const prior = readPendingGeneration(args.storage.getItem(key), args.ownerId, args.kind, args.scope);
    const requestKey = prior?.requestKey ?? args.uuid();
    const saved: PendingGeneration = prior ?? { version: 1, ownerId: args.ownerId, kind: args.kind, scope: args.scope, requestKey, input: { ...args.input, idempotencyKey: requestKey } };
    readPendingGeneration(JSON.stringify(saved), args.ownerId, args.kind, args.scope);
    // Storage must succeed before any paid submission can be made.
    args.storage.setItem(key, JSON.stringify(saved)); args.onStored(saved);
    const options = { cache: "no-store" as const, headers: { Authorization: `Bearer ${args.token}` }, signal: AbortSignal.timeout(30_000) };
    let result: RecoveredGeneration | null = null;
    if (prior) {
      const query = recoveryQuery(saved);
      const response = await sendRequest(`/api/ai-studio/generation-requests?${query}`, options);
      const value = await response.json().catch(() => null); args.assertActive();
      if (!response.ok || !value?.ok || value.requestKey !== requestKey || !Array.isArray(value.jobs)) throw new Error("Could not check your saved generation. Its request is preserved; try recovery again.");
      if (value.jobs.length) result = confirmed(value, saved);
      else if (value.outcome !== "unconfirmed") throw new Error("The saved generation state could not be verified.");
    }
    if (!result) {
      args.assertActive();
      const response = await sendRequest(`/api/ai-studio/${saved.kind === "image" ? "images" : "videos"}/generate`, {
        ...options, ...(saved.input.slideshowContext ? { signal: AbortSignal.timeout(120_000) } : {}), method: "POST", headers: { ...options.headers, "Content-Type": "application/json", "Idempotency-Key": requestKey }, body: JSON.stringify(saved.input),
      });
      const value = await response.json().catch(() => null); args.assertActive();
      if (!response.ok || !value?.ok) {
        // These admission errors happen before the ordinary APIs create work.
        if ([400, 401, 402, 403, 422].includes(response.status)) args.storage.removeItem(key);
        if (response.status === 422 && Array.isArray(value?.clarifications) && value.clarifications.length > 0 && value.clarifications.length <= 5 && value.clarifications.every((item: unknown) => typeof item === "string" && item.length <= 500)) {
          throw new GenerationClarificationError(value.message, value.clarifications);
        }
        throw new Error(value?.message ?? value?.error ?? "Generation could not be confirmed. Its request is preserved.");
      }
      result = confirmed(value, saved);
    }
    args.assertActive();
    // A lost-response GET can see the first child while the original batch is
    // still admitting later children. Keep its base identity for GET-only
    // discovery, independently of the active submission slot.
    if (result.partial) {
      const discoveryKey = generationDiscoveryKey(args.ownerId, args.kind, args.scope);
      const history = readGenerationDiscoveries(args.storage.getItem(discoveryKey), args.ownerId, args.kind, args.scope);
      if (!history.some(entry => entry.requestKey === saved.requestKey)) args.storage.setItem(discoveryKey, JSON.stringify([...history, saved]));
    }
    args.acknowledge(result, saved.input);
    args.storage.removeItem(key);
    return { result, input: saved.input };
  });
}

/** Archived requests only discover saved children; they can never submit work. */
export async function checkGenerationDiscoveries(args: {
  ownerId: string; kind: PendingGeneration["kind"]; scope: string; token: string;
  storage: Pick<Storage, "getItem" | "setItem">; locks: Pick<LockManager, "request">;
  fetch: typeof fetch; assertActive: () => void;
  acknowledge: (result: RecoveredGeneration, input: Record<string, unknown>) => void;
}) {
  const { fetch: sendRequest } = args;
  const key = pendingGenerationKey(args.ownerId, args.kind, args.scope);
  const discoveryKey = generationDiscoveryKey(args.ownerId, args.kind, args.scope);
  return args.locks.request(key, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Another tab is updating saved generations. Check again when it finishes.");
    args.assertActive();
    const history = readGenerationDiscoveries(args.storage.getItem(discoveryKey), args.ownerId, args.kind, args.scope);
    const remaining: PendingGeneration[] = [];
    let recovered = 0;
    for (const saved of history) {
      const query = recoveryQuery(saved);
      const response = await sendRequest(`/api/ai-studio/generation-requests?${query}`, { cache: "no-store", headers: { Authorization: `Bearer ${args.token}` }, signal: AbortSignal.timeout(30_000) });
      const value = await response.json().catch(() => null); args.assertActive();
      if (!response.ok || !value?.ok || value.requestKey !== saved.requestKey || !Array.isArray(value.jobs)) throw new Error("Could not check an earlier generation. Its discovery record is preserved.");
      if (value.jobs.length) {
        const result = confirmed(value, saved);
        args.acknowledge(result, saved.input); recovered += result.jobs.length;
        if (result.partial) remaining.push(saved);
      } else if (value.outcome === "unconfirmed") remaining.push(saved);
      else throw new Error("The earlier generation state could not be verified.");
    }
    args.assertActive();
    args.storage.setItem(discoveryKey, JSON.stringify(remaining));
    return { remaining: remaining.length, recovered };
  });
}
