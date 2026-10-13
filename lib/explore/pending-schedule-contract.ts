import { ExploreFinishError, isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft } from "../../worker/src/lib/explore-finishing-contract.ts";
import type { ScheduleCreateInput, ScheduledPost } from "../scheduling/types.ts";

export type ExplorePendingScheduleInput = {
  version: 1;
  requestKey: string;
  draft: ExploreFinishDraft;
  schedule: Omit<ScheduleCreateInput, "source" | "metadata" | "plannedTargets" | "idempotencyKey">;
};
export type ExplorePendingScheduleResult = {
  ok: true;
  version: 1;
  requestKey: string;
  schedule: ScheduledPost | null;
  preparation: {
    state: "unconfirmed" | "preparing" | "scheduled" | "failed" | "cancelled";
    jobId: string | null;
    mediaAssetId: string | null;
    message: string;
  };
};

export function parseExplorePendingSchedule(value: unknown): ExplorePendingScheduleInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExploreFinishError("Choose a video and schedule details.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !["version", "requestKey", "draft", "schedule"].includes(key)) || raw.version !== 1 || !isExploreUuid(raw.requestKey)) {
    throw new ExploreFinishError("This background schedule uses an unsupported format.");
  }
  const draft = parseExploreFinishDraft(raw.draft);
  if (draft.captionPreview) throw new ExploreFinishError("Generate and review captions before scheduling the finished video.");
  if (!raw.schedule || typeof raw.schedule !== "object" || Array.isArray(raw.schedule)) throw new ExploreFinishError("Choose schedule details.");
  const schedule = raw.schedule as Record<string, unknown>;
  const fields = ["caption", "title", "targets", "scheduledDate", "scheduledTime", "scheduledFor", "timezone", "useDefaultScheduleTime"];
  if (Object.keys(schedule).some(key => !fields.includes(key)) || !Array.isArray(schedule.targets) || schedule.targets.length < 1 || schedule.targets.length > 5 ||
      typeof schedule.caption !== "string" || schedule.caption.length > 5000 || typeof schedule.timezone !== "string" || schedule.timezone.length > 100 ||
      (schedule.title !== undefined && (typeof schedule.title !== "string" || schedule.title.length > 160)) ||
      fields.filter(key => key.startsWith("scheduled")).some(key => schedule[key] !== undefined && typeof schedule[key] !== "string") ||
      (schedule.useDefaultScheduleTime !== undefined && typeof schedule.useDefaultScheduleTime !== "boolean")) throw new ExploreFinishError("Choose valid accounts, caption, date, time and timezone.");
  // Deterministic normalized object order makes retries stable. The server then
  // validates the accounts/settings against current owned social connections.
  const normalizedSchedule: ExplorePendingScheduleInput["schedule"] = { caption: schedule.caption, timezone: schedule.timezone,
    targets: schedule.targets as ExplorePendingScheduleInput["schedule"]["targets"],
    ...(schedule.title === undefined ? {} : { title: schedule.title as string }),
    ...(schedule.scheduledDate === undefined ? {} : { scheduledDate: schedule.scheduledDate as string }),
    ...(schedule.scheduledTime === undefined ? {} : { scheduledTime: schedule.scheduledTime as string }),
    ...(schedule.scheduledFor === undefined ? {} : { scheduledFor: schedule.scheduledFor as string }),
    ...(schedule.useDefaultScheduleTime === undefined ? {} : { useDefaultScheduleTime: schedule.useDefaultScheduleTime as boolean }) };
  return { version: 1, requestKey: raw.requestKey.toLowerCase(), draft, schedule: normalizedSchedule };
}

/** Object keys are irrelevant to request identity; array order remains exact. */
export function stableExploreScheduleJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableExploreScheduleJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableExploreScheduleJson(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function explorePreparationDecision(params: {
  receiptCompleted: boolean; jobStatus: string; receiptUncertain: boolean;
  scheduleStatus: string; hasTargets: boolean; deadlineAt: string; now?: number;
}): "cancelled" | "already_scheduled" | "failed" | "deadline_expired" | "finalize" | "wait" {
  if (params.scheduleStatus === "cancelled") return "cancelled";
  if (params.hasTargets && ["scheduling", "scheduled", "publishing", "published"].includes(params.scheduleStatus)) return "already_scheduled";
  // A post-file callback can exhaust worker retries after a verified output was
  // already committed. Recovery must finalize that output, never render again.
  if (params.receiptUncertain || (!params.receiptCompleted && ["failed", "cancelled"].includes(params.jobStatus))) return "failed";
  if (!Number.isFinite(Date.parse(params.deadlineAt)) || (params.now ?? Date.now()) >= Date.parse(params.deadlineAt)) return "deadline_expired";
  return params.receiptCompleted ? "finalize" : "wait";
}
