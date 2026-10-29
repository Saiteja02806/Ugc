import { isExploreUuid, type ExploreFinishDraft } from "../../worker/src/lib/explore-finishing-contract.ts";
import { parseExplorePendingSchedule, stableExploreScheduleJson, type ExplorePendingScheduleInput, type ExplorePendingScheduleResult } from "./pending-schedule-contract.ts";
import { normalizeScheduleTargetSettings } from "../scheduling/platform-settings.ts";

export type ExploreScheduleComposition = {
  signature: string;
  sourceId: string;
  title: string;
  draft: ExploreFinishDraft | null;
  error: string | null;
  retryLoad?: () => void;
  resolve: () => Promise<ExploreFinishDraft>;
};
export type SavedExploreSchedule = { version: 1; owner: string; signature: string; confirmed: boolean; input: ExplorePendingScheduleInput; timeRejected?: true };
export function readSavedExploreSchedule(raw: string | null, owner: string): SavedExploreSchedule | null {
  if (!raw) return null;
  if (raw.length > 400000) throw new Error("The saved schedule request is too large to verify.");
  const value = JSON.parse(raw);
  if (value?.version !== 1 || value.owner !== owner || typeof value.signature !== "string" || value.signature.length > 131072 || typeof value.confirmed !== "boolean") throw new Error("The saved schedule belongs to a different workflow or account.");
  if (value.timeRejected !== undefined && value.timeRejected !== true) throw new Error("The saved schedule rejection could not be verified.");
  return { version: 1, owner, signature: value.signature, confirmed: value.confirmed, input: parseExplorePendingSchedule(value.input), ...(value.timeRejected ? { timeRejected: true } : {}) };
}
export function verifyExploreScheduleReply(raw: unknown, saved: SavedExploreSchedule): ExplorePendingScheduleResult {
  const value = raw as ExplorePendingScheduleResult;
  const preparation = value?.preparation;
  if (!value?.ok || value.version !== 1 || value.requestKey !== saved.input.requestKey || !preparation ||
      !["unconfirmed", "preparing", "scheduled", "failed", "cancelled"].includes(preparation.state) || typeof preparation.message !== "string") throw new Error("The schedule response could not be verified. Check the same saved request.");
  if (preparation.state === "unconfirmed") {
    if (value.schedule !== null || preparation.jobId !== null || preparation.mediaAssetId !== null) throw new Error("This unconfirmed response is inconsistent.");
    return value;
  }
  const schedule = value.schedule;
  if (!schedule || !isExploreUuid(schedule.id) || !isExploreUuid(preparation.jobId) || schedule.metadata?.exploreFinishRequestKey !== saved.input.requestKey ||
      typeof schedule.metadata.exploreFinishFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(schedule.metadata.exploreFinishFingerprint) ||
      !isExploreUuid(schedule.metadata.exploreFinishOutputAssetId) || preparation.mediaAssetId !== null && preparation.mediaAssetId !== schedule.metadata.exploreFinishOutputAssetId) throw new Error("The saved video preparation could not be verified.");
  const requested = saved.input.schedule;
  const requestedTargets = requested.targets ?? [];
  const expectedTime = requested.scheduledFor ? Date.parse(requested.scheduledFor) : null;
  let planned: unknown;
  try { planned = JSON.parse(String(schedule.metadata.plannedTargetsJson)); } catch { planned = null; }
  // Compare the same provider contract the server persists. UI-only disclosure
  // controls are not stored provider options; real visibility/interaction and
  // AI disclosure settings remain part of this exact verification.
  if (schedule.caption !== requested.caption?.trim() || schedule.timezone !== requested.timezone?.trim() ||
      requested.title?.trim() && schedule.title !== requested.title.trim() ||
      expectedTime !== null && (!Number.isFinite(expectedTime) || Date.parse(schedule.scheduledFor ?? "") !== expectedTime || Date.parse(String(schedule.metadata.plannedScheduledFor)) !== expectedTime) ||
      !Array.isArray(planned) || planned.length !== requestedTargets.length || requestedTargets.some(target => {
        const matching = planned.filter(value => value && value.connectionId === target.connectionId && value.platform === target.platform);
        return matching.length !== 1 || !target.platform || stableExploreScheduleJson(normalizeScheduleTargetSettings(target.platform, matching[0].settings)) !==
          stableExploreScheduleJson(normalizeScheduleTargetSettings(target.platform, target.settings));
      })) throw new Error("The saved schedule details do not match your confirmation. Check the same saved request.");
  return value;
}
