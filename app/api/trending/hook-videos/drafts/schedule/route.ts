import {
  createUserSchedule,
  getUserSchedule,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import {
  attachScheduleDraftToHookVideo,
  getHookVideoDraftForUser,
} from "@/lib/trending/hook-video-db";
import { createHookVideoScheduleIdempotencyKey } from "@/lib/trending/hook-video-scheduling";
import { persistHookVideoSelection } from "@/lib/trending/hook-video-service";
import { prepareOwnedHookMediaAsset } from "@/lib/trending/hook-video-sources";
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
    const existingDraft = parsed.data.draftId
      ? await getHookVideoDraftForUser({
          draftId: parsed.data.draftId,
          userId: auth.user.uid,
        })
      : null;

    if (existingDraft?.scheduledPostId) {
      const existingSchedule = await getUserSchedule({
        postId: existingDraft.scheduledPostId,
        userId: auth.user.uid,
      });
      const requestedIdempotencyKey =
        createHookVideoScheduleIdempotencyKey({
          ...parsed.data,
          draftId: existingDraft.id,
        });

      if (
        existingSchedule &&
        existingSchedule.idempotencyKey === requestedIdempotencyKey &&
        existingSchedule.status !== "cancelled"
      ) {
        return hookVideoJson({
          draft: existingDraft,
          ok: true,
          scheduleId: existingSchedule.id,
        });
      }

      throw new SchedulingRequestError(
        "This Hook video already has a schedule. Open Scheduling to edit or cancel it.",
        409,
        "hook_video_already_scheduled",
      );
    }

    const composition = await persistHookVideoSelection({
      input: parsed.data,
      librarySaved: true,
      userId: auth.user.uid,
    });
    const ownedHook = await prepareOwnedHookMediaAsset({
      influencerId: composition.source.influencerId,
      sourceKind: composition.source.sourceKind,
      userId: auth.user.uid,
      videoId: composition.source.id,
    });
    const scheduleResult = await createUserSchedule({
      input: {
        idempotencyKey: createHookVideoScheduleIdempotencyKey({
          ...parsed.data,
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
          hookTextLines: composition.hookRenderSpec.lines,
          hookTextPosition:
            composition.creativeEdit?.content.format === "hook_video"
              ? composition.creativeEdit.content.position
              : null,
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
        plannedTargets: parsed.data.targets,
        scheduledDate: parsed.data.scheduledDate,
        scheduledTime: parsed.data.scheduledTime,
        source: { id: composition.demo.id, kind: "media_asset" },
        targets: [],
        timezone: parsed.data.timezone,
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
