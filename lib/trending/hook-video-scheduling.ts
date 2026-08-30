import { createHash } from "node:crypto";

import {
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
} from "../scheduling/schedule-time.ts";
import type { HookVideoScheduleRequest } from "./hook-video-validation.ts";

type HookVideoScheduleIdentity = Omit<
  HookVideoScheduleRequest,
  "draftId"
> & {
  draftId: string;
};

export function createHookVideoScheduleIdempotencyKey(
  input: HookVideoScheduleIdentity,
) {
  const identityHash = createHash("sha256")
    .update(
      JSON.stringify({
        composition: {
          demoAssetId: input.demoAssetId,
          influencerId: input.influencerId,
          influencerVideoId: input.influencerVideoId,
          selectedHookId: input.selectedHookId,
          sourceKind: input.sourceKind,
          trimEnd: input.trimEnd,
          trimStart: input.trimStart,
        },
        targets: input.targets
          .map((target) => ({
            connectionId: target.connectionId,
            platform: target.platform,
            settings: sortRecord(target.settings ?? {}),
          }))
          .sort((first, second) =>
            `${first.connectionId}:${first.platform}`.localeCompare(
              `${second.connectionId}:${second.platform}`,
            ),
          ),
        timezone: input.timezone,
      }),
    )
    .digest("hex")
    .slice(0, 24);

  return `hook-video:${input.draftId}:${input.scheduledDate}:${input.scheduledTime}:${identityHash}`;
}

/**
 * Resolve the automatic Hook scheduling choice as late as possible on the
 * server. A timestamp calculated when a client-side drawer opens can become
 * invalid while the user reviews the composition; this uses the same lead-time
 * policy as the scheduling service at the moment the schedule is created.
 */
export function getDefaultHookVideoScheduleTime(params: {
  minimumLeadMinutes: number;
  now?: number;
  timeZone: string;
}) {
  const scheduledFor = getEarliestScheduleTimestamp({
    minimumLeadMinutes: params.minimumLeadMinutes,
    now: params.now,
  });
  const parts = getZonedDateTimeParts(scheduledFor, params.timeZone);

  return {
    scheduledDate: parts.date,
    scheduledTime: parts.time,
  };
}

function sortRecord(
  value: Record<string, boolean | number | string>,
): Record<string, boolean | number | string> {
  return Object.fromEntries(
    Object.entries(value).sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
}
