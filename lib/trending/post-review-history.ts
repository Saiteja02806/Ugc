export type ReviewedPost<T> = {
  id: string;
  value: T;
  decision: "liked" | "skipped";
  reviewedAt?: number;
};

export type PostReviewState<T> = { entries: ReviewedPost<T>[]; activeId: string | null };
export type PostReviewPersistence<T> = { ownerId: string; isValue: (value: unknown) => value is T };

const PREFIX = "ugc:trending-review-history:v1:";
export const POST_REVIEW_LIMIT = 120;
export const POST_REVIEW_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const POST_REVIEW_STORAGE_LIMIT = 1_000_000;

export function getPostReviewHistoryKey(ownerId: string) {
  return `${PREFIX}${encodeURIComponent(ownerId)}`;
}

export function emptyPostReviewState<T>(): PostReviewState<T> {
  return { entries: [], activeId: null };
}

export function parsePostReviewHistory<T>(raw: string | null, persistence: PostReviewPersistence<T>, now = Date.now()): PostReviewState<T> {
  if (!raw || raw.length > POST_REVIEW_STORAGE_LIMIT) return emptyPostReviewState();
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.ownerId !== persistence.ownerId || !Array.isArray(saved.entries)) return emptyPostReviewState();
    const entries: ReviewedPost<T>[] = [];
    for (const entry of saved.entries.slice(-POST_REVIEW_LIMIT)) {
      if (!entry || typeof entry.id !== "string" || !entry.id ||
        (entry.decision !== "liked" && entry.decision !== "skipped") ||
        !Number.isFinite(entry.reviewedAt) || entry.reviewedAt > now + 60_000 ||
        now - entry.reviewedAt > POST_REVIEW_RETENTION_MS || !persistence.isValue(entry.value)) continue;
      if (entries.some(previous => previous.id === entry.id)) continue;
      entries.push(entry);
    }
    return { entries, activeId: entries.some(entry => entry.id === saved.activeId) ? saved.activeId : null };
  } catch { return emptyPostReviewState(); }
}

/** Merge other tabs' reviews without turning an already-liked entry back into a skip. */
export function mergePostReviewHistory<T>(stored: PostReviewState<T>, current: PostReviewState<T>): PostReviewState<T> {
  const byId = new Map(stored.entries.map(entry => [entry.id, entry]));
  for (const entry of current.entries) {
    const previous = byId.get(entry.id);
    byId.set(entry.id, previous?.decision === "liked" ? { ...entry, decision: "liked" } : entry);
  }
  const entries = [...byId.values()].sort((a, b) => (a.reviewedAt ?? 0) - (b.reviewedAt ?? 0)).slice(-POST_REVIEW_LIMIT);
  return { entries, activeId: entries.some(entry => entry.id === current.activeId) ? current.activeId : null };
}

/** Bound local storage by both count and serialized size; never store image bytes. */
export function serializePostReviewHistory<T>(state: PostReviewState<T>, ownerId: string) {
  const entries = state.entries.slice(-POST_REVIEW_LIMIT);
  while (entries.length) {
    const activeId = entries.some(entry => entry.id === state.activeId) ? state.activeId : null;
    const raw = JSON.stringify({ version: 1, ownerId, entries, activeId });
    if (raw.length <= POST_REVIEW_STORAGE_LIMIT) return raw;
    entries.shift();
  }
  return JSON.stringify({ version: 1, ownerId, ...emptyPostReviewState<T>() });
}
