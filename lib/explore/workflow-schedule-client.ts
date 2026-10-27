import { isExploreUuid } from "../../worker/src/lib/explore-finishing-contract.ts";
import type { ScheduleCreateInput, ScheduledPost } from "../scheduling/types.ts";

// Only an explicit validation rejection permits editing a durable request.
// Network failures and missing status reads still preserve the exact input.
export class ScheduleRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ScheduleRequestError";
    this.status = status;
    this.code = code;
  }
}
export function isScheduleTimeRejected(error: unknown) {
  return error instanceof ScheduleRequestError && error.status === 409 && error.code === "schedule_time_too_soon";
}
export const SCHEDULE_TIME_REJECTED_MESSAGE = "Choose a future date and time, then click Schedule post.";

export type ScheduleReceipt = { version: 1; owner: string; kind: "hook" | "phone"; input: ScheduleCreateInput; scheduleId?: string; timeRejected?: true };
export function readScheduleReceipt(raw: string | null, owner: string, kind: "hook" | "phone", sourceKind: "media_asset" | "library_item" = "media_asset"): ScheduleReceipt | null {
  if (!raw) return null;
  if (raw.length > 32768) throw new Error("The saved schedule could not be verified.");
  const v = JSON.parse(raw) as ScheduleReceipt;
  const input = v?.input;
  if (v?.version !== 1 || v.owner !== owner || v.kind !== kind || !input ||
      !/^explore:[0-9a-f-]{36}$/i.test(input.idempotencyKey ?? "") || !isExploreUuid(input.idempotencyKey?.slice(8)) ||
      input.source?.kind !== sourceKind || !isExploreUuid(input.source.id) ||
      !Array.isArray(input.targets) || input.targets.length < 1 || input.targets.length > 3 || input.targets.some(target => !isExploreUuid(target?.connectionId) || !["instagram", "tiktok", "youtube"].includes(target?.platform ?? "")) ||
      new Set(input.targets.map(target => target.connectionId)).size !== input.targets.length || new Set(input.targets.map(target => target.platform)).size !== input.targets.length ||
      (input.useDefaultScheduleTime !== undefined && typeof input.useDefaultScheduleTime !== "boolean") ||
      typeof input.scheduledFor !== "string" || !Number.isFinite(Date.parse(input.scheduledFor)) ||
      typeof input.timezone !== "string" || input.timezone.length > 100 ||
      typeof input.caption !== "string" || input.caption.length > 10000 ||
      (v.timeRejected !== undefined && v.timeRejected !== true) ||
      (v.scheduleId !== undefined && !isExploreUuid(v.scheduleId))) throw new Error("The saved schedule could not be verified. Review Scheduling before starting another.");
  return v;
}
export function verifySavedSchedule(value: unknown, saved: ScheduleReceipt): ScheduledPost {
  const v = value as { ok?: boolean; schedule?: ScheduledPost } | null;
  const s = v?.schedule;
  if (!v?.ok || !s || !isExploreUuid(s.id) || (saved.scheduleId && s.id !== saved.scheduleId) ||
      (saved.input.source.kind === "library_item" ? s.libraryItemId : s.mediaAssetId) !== saved.input.source.id || s.idempotencyKey !== saved.input.idempotencyKey ||
      !["draft", "scheduling", "scheduled", "publishing", "published", "partially_failed", "failed", "cancelled"].includes(s.status) ||
      !Array.isArray(s.targets) || s.targets.length !== saved.input.targets?.length || !saved.input.targets?.every(target => s.targets.some(t => t.socialConnectionId === target.connectionId && t.platform === target.platform))) throw new Error("The schedule response could not be verified. Keep and resume the saved request.");
  return s;
}
export function scheduleReceiptMessage(schedule: ScheduledPost): string {
  if (schedule.status === "scheduled") return "Post scheduled";
  if (schedule.status === "published") return "Your post is published. Review it in Scheduling.";
  if (["failed", "partially_failed", "cancelled"].includes(schedule.status)) return "Your saved post needs review in Scheduling.";
  return "Post scheduled. Check Scheduling for account actions or pending preparation.";
}
