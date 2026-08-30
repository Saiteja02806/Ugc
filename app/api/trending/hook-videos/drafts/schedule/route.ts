import {
  createUserSchedule,
  getSocialSchedulingMinimumLeadMinutes,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import { ScheduleTimeError } from "@/lib/scheduling/schedule-time";
import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { attachScheduleDraftToHookVideo } from "@/lib/trending/hook-video-db";
import {
  createHookVideoScheduleIdempotencyKey,
  getDefaultHookVideoScheduleTime,
} from "@/lib/trending/hook-video-scheduling";
import { persistHookVideoSelection } from "@/lib/trending/hook-video-service";
import { prepareOwnedHookMediaAsset } from "@/lib/trending/hook-video-sources";
import { getHookVideoTextPosition } from "@/lib/trending/hook-video-text-placement";
import { HookVideoScheduleRequestSchema } from "@/lib/trending/hook-video-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = HookVideoScheduleRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return hookVideoJson(
      { error: "Complete the Hook video before scheduling it.", ok: false },
      400,
    );
  }

  try {
    const composition = await persistHookVideoSelection({
      input: parsed.data,
      librarySaved: false,
      userId: auth.user.uid,
    });
    const ownedHook = await prepareOwnedHookMediaAsset({
      influencerId: composition.source.influencerId,
      sourceKind: composition.source.sourceKind,
      userId: auth.user.uid,
      videoId: composition.source.id,
    });
    const scheduleTime = parsed.data.useDefaultScheduleTime
      ? resolveDefaultScheduleTime(parsed.data.timezone)
      : {
          scheduledDate: parsed.data.scheduledDate,
          scheduledTime: parsed.data.scheduledTime,
        };
    const scheduleInput = {
      ...parsed.data,
      ...scheduleTime,
    };
    const scheduleResult = await createUserSchedule({
      input: {
        idempotencyKey: createHookVideoScheduleIdempotencyKey({
          ...scheduleInput,
          draftId: composition.draft.id,
          influencerId: composition.source.influencerId,
          influencerVideoId: composition.source.id,
          sourceKind: composition.source.sourceKind,
        }),
        metadata: {
          demoMediaId: composition.demo.id,
          demoMediaTitle: composition.demo.title,
          hookMediaId: ownedHook.id,
          hookMediaTitle: composition.source.title,
          hookCatalogVideoId:
            composition.source.sourceKind === "catalog"
              ? composition.source.id
              : null,
          hookText: composition.draft.hookText,
          hookTextFontSize: composition.hookRenderSpec.fontSize,
          hookTextLayoutVersion: composition.hookRenderSpec.version,
          hookTextLines: composition.hookRenderSpec.lines,
          hookTextPosition:
            composition.creativeEdit?.content.format === "hook_video"
              ? composition.creativeEdit.content.position
              : getHookVideoTextPosition(
                  composition.source.hookTextPlacement,
                ),
          hookTextColor:
            composition.creativeEdit?.content.format === "hook_video"
              ? composition.creativeEdit.content.textColor
              : null,
          hookTrimEnd: composition.draft.trimEnd,
          hookTrimStart: composition.draft.trimStart,
          hookVideoDraftId: composition.draft.id,
          mediaMode: "combined_video",
          scheduledVideoId: composition.demo.id,
          scheduledVideoSourceType: composition.demo.source_type,
          scheduledVideoTitle: composition.demo.title,
          selectedHookId: composition.draft.selectedHookId,
          useOpeningClip: true,
        },
        plannedTargets: scheduleInput.targets,
        scheduledDate: scheduleInput.scheduledDate,
        scheduledTime: scheduleInput.scheduledTime,
        source: { id: composition.demo.id, kind: "media_asset" },
        targets: [],
        timezone: scheduleInput.timezone,
        title: `${composition.influencer.name} + ${composition.demo.title}`.slice(
          0,
          140,
        ),
      },
      userId: auth.user.uid,
    });
    const draft = await attachScheduleDraftToHookVideo({
      draftId: composition.draft.id,
      scheduledPostId: scheduleResult.schedule.id,
      userId: auth.user.uid,
    });

    return hookVideoJson({
      draft,
      ok: true,
      scheduleId: scheduleResult.schedule.id,
    });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return hookVideoJson({ error: error.message, ok: false }, error.status);
    }

    return hookVideoErrorResponse(error, "Could not prepare this schedule.");
  }
}

function resolveDefaultScheduleTime(timeZone: string) {
  try {
    return getDefaultHookVideoScheduleTime({
      minimumLeadMinutes: getSocialSchedulingMinimumLeadMinutes(),
      timeZone,
    });
  } catch (error) {
    if (error instanceof ScheduleTimeError) {
      throw new SchedulingRequestError(error.message);
    }

    throw error;
  }
}
