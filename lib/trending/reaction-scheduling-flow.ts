import { SchedulingRequestError } from "../scheduling/errors.ts";
import type { ScheduleCreateInput, ScheduledPost } from "../scheduling/types.ts";
import type { createUserSchedule, scheduleRenderedPost, updateUserSchedule } from "../scheduling/service";

type Dependencies = {
  create: typeof createUserSchedule;
  publish: typeof scheduleRenderedPost;
  update: typeof updateUserSchedule;
};

export async function scheduleReactionWithDependencies(
  params: { input: ScheduleCreateInput; connectionIds: string[]; userId: string },
  dependencies: Dependencies,
): Promise<{ created: boolean; schedule: ScheduledPost }> {
  const result = await dependencies.create({ input: params.input, userId: params.userId });
  // Recover drafts left by a failed request with the newly submitted details.
  if (!result.created && result.schedule.targets.length === 0 && result.schedule.status === "draft") {
    await dependencies.update({
      input: { ...params.input, expectedUpdatedAt: result.schedule.updatedAt },
      postId: result.schedule.id,
      userId: params.userId,
    });
  }
  const published = await dependencies.publish({
    input: { connectionIds: params.connectionIds, timezone: params.input.timezone },
    postId: result.schedule.id,
    userId: params.userId,
  });
  const successful = new Set(["scheduled", "publishing", "published"]);
  if (!published.schedule.scheduledFor || params.connectionIds.length === 0 || !params.connectionIds.every((id) => published.schedule.targets.some(
    (target) => target.socialConnectionId === id && successful.has(target.status),
  ))) {
    throw new SchedulingRequestError("The Reaction Reel was saved, but platform scheduling needs attention. Open Scheduling to retry.", 409, "reaction_schedule_incomplete");
  }
  return { created: result.created, schedule: published.schedule };
}
