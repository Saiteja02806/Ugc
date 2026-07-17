import { createHash } from "node:crypto";

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

function sortRecord(
  value: Record<string, boolean | number | string>,
): Record<string, boolean | number | string> {
  return Object.fromEntries(
    Object.entries(value).sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
}
