import { createHash, randomUUID } from "node:crypto";

export const HOOK_BUNDLE_LIMIT = 100;
export const HOOK_BUNDLE_STATE_KEY = "resources/hook-video-bundle/v1/downloads.json";
export const validBundleRequestId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
export type BundleItem = { name: string; id: string; key: string; sha256: string };
export type BundleState = { version: 1; bundleHash: string; starts: { requestId: string; executionId: string }[] };
export type BundleStateStore = {
  read(): Promise<{ generation: string; value: unknown } | null>;
  replace(generation: string, value: BundleState): Promise<boolean>;
};

export function validateBundleItems(items: readonly BundleItem[]) {
  if (!items.length || items.length > 200 || new Set(items.map(item => item.id)).size !== items.length ||
    new Set(items.map(item => item.name)).size !== items.length || items.some(item =>
      !/^Hook-\d{3}\.mp4$/.test(item.name) || !/^explore-paired-hook-[a-f0-9]{24}$/.test(item.id) ||
      !/^[a-f0-9]{64}$/.test(item.sha256) || item.key !== `explore/paired-references/v1/${item.sha256}.mp4`)) {
    throw new Error("Invalid public Hook bundle manifest.");
  }
  return createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

export function readBundleState(value: unknown, bundleHash: string): BundleState {
  const state = value as BundleState;
  if (!state || state.version !== 1 || state.bundleHash !== bundleHash || !Array.isArray(state.starts) ||
    state.starts.length > HOOK_BUNDLE_LIMIT || new Set(state.starts.map(item => item?.requestId)).size !== state.starts.length ||
    state.starts.some(item => !item || !validBundleRequestId(item.requestId) || !validBundleRequestId(item.executionId))) {
    throw new Error("The Hook bundle counter needs review.");
  }
  return state;
}

export async function bundleStatus(store: BundleStateStore, bundleHash: string, requestId?: string | null) {
  const stored = await store.read();
  const state = stored ? readBundleState(stored.value, bundleHash) : { starts: [] };
  return { count: state.starts.length, limit: HOOK_BUNDLE_LIMIT, exhausted: state.starts.length >= HOOK_BUNDLE_LIMIT,
    started: Boolean(requestId && state.starts.some(item => item.requestId === requestId)) };
}

/** A generation-conditional write admits at most 100 streams across all instances.
 * Execution identity distinguishes our own ambiguous write from a competing replay.
 * Never decrement after bytes could have reached the browser or reset a bad counter.
 */
export async function claimBundleDownload(store: BundleStateStore, bundleHash: string, requestId: string,
  options: { pause?: () => Promise<void>; maxAttempts?: number; signal?: AbortSignal } = {}) {
  if (!validBundleRequestId(requestId)) throw new Error("Invalid download request.");
  const executionId = randomUUID();
  for (let attempt = 0; attempt < (options.maxAttempts ?? 100); attempt++) {
    options.signal?.throwIfAborted();
    const stored = await store.read();
    const state: BundleState = stored ? readBundleState(stored.value, bundleHash) : { version: 1, bundleHash, starts: [] };
    if (state.starts.some(item => item.requestId === requestId)) return "duplicate" as const;
    if (state.starts.length >= HOOK_BUNDLE_LIMIT) return "exhausted" as const;
    const next: BundleState = { ...state, starts: [...state.starts, { requestId, executionId }] };
    try {
      if (await store.replace(stored?.generation ?? "0", next)) return "accepted" as const;
    } catch (error) {
      // A lost acknowledgement must not start another write or another stream.
      const readback = await store.read();
      const receipt = readback && readBundleState(readback.value, bundleHash).starts.find(item => item.requestId === requestId);
      if (receipt?.executionId === executionId) return "accepted" as const;
      if (receipt) return "duplicate" as const;
      throw error;
    }
    await (options.pause?.() ?? new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 70)));
  }
  throw new Error("The download queue is busy. Please try again.");
}
