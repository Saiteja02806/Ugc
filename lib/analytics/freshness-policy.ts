/** Saved-data reads are cheap; provider synchronization has its own cooldown. */
export const ANALYTICS_SNAPSHOT_READ_STALE_MS = 60_000;
/** Opening Analytics may ask for a provider check even inside the background
 * window, but never more often than this floor, so repeated visits cannot
 * multiply provider calls. */
export const ANALYTICS_VISIT_RECHECK_MS = 60_000;
/** Provider refresh admission while an Analytics screen is open. Keeping this
 * short makes a visit pick up new posts and metrics without a manual Refresh,
 * while the worker still skips provider work that is not due. */
export const INSTAGRAM_ANALYTICS_REFRESH_MS = 5 * 60_000;
export const SOCIAL_ANALYTICS_REFRESH_MS = 3 * 60_000;
/** Per-post Instagram insight calls are the expensive part of a content sync,
 * so recent posts keep the slower provider budget even when the screen checks
 * for new content more often. */
export const INSTAGRAM_RECENT_MEDIA_METRICS_REFRESH_MS = 15 * 60_000;
