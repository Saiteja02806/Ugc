export type TargetSchedulingRow = {
  id: string;
  scheduled_for: string;
};

export type TargetSchedulingDependencies = {
  assertMinimumLead: (scheduledFor: string) => void;
  attachPublishJob: (params: {
    jobId: string;
    targetId: string;
    userId: string;
  }) => Promise<unknown>;
  createProviderSchedule: (params: {
    jobId: string;
    scheduledFor: string;
    targetId: string;
  }) => Promise<{ arn: string | null; name: string }>;
  createPublishJob: (params: {
    projectId: string | null;
    targetId: string;
    userId: string;
  }) => Promise<{ id: string }>;
  deleteProviderSchedule: (scheduleName: string) => Promise<unknown>;
  failPublishJob: (params: {
    errorMessage: string;
    jobId: string;
  }) => Promise<unknown>;
  failTarget: (params: {
    errorCode: string;
    errorMessage: string;
    targetId: string;
    userId: string;
  }) => Promise<unknown>;
  getErrorCode: (error: unknown) => string;
  getErrorMessage: (error: unknown) => string;
  markProviderSchedule: (params: {
    scheduleArn: string | null;
    scheduleName: string;
    targetId: string;
    userId: string;
  }) => Promise<unknown>;
  markSchedulerFallback: (params: {
    errorMessage: string;
    scheduleArn: string | null;
    scheduleName: string | null;
    schedulerDeletedAt: string | null;
    targetId: string;
    userId: string;
  }) => Promise<unknown>;
  now: () => string;
  reportError?: (
    event:
      | "compensation_failed"
      | "fallback_persistence_failed"
      | "publish_job_failure_persistence_failed",
    details: Record<string, unknown>,
  ) => void;
  reportWarning?: (
    event: "scheduler_fallback_active",
    details: Record<string, unknown>,
  ) => void;
};

export async function scheduleTargetRowsWithDependencies(
  params: {
    projectId: string | null;
    targetRows: TargetSchedulingRow[];
    userId: string;
  },
  dependencies: TargetSchedulingDependencies,
) {
  let scheduledCount = 0;
  let failedCount = 0;

  for (const target of params.targetRows) {
    let publishJob: { id: string } | null = null;

    try {
      dependencies.assertMinimumLead(target.scheduled_for);
      publishJob = await dependencies.createPublishJob({
        projectId: params.projectId,
        targetId: target.id,
        userId: params.userId,
      });
      await dependencies.attachPublishJob({
        jobId: publishJob.id,
        targetId: target.id,
        userId: params.userId,
      });
    } catch (error) {
      failedCount += 1;
      const errorMessage = dependencies.getErrorMessage(error);

      if (publishJob) {
        try {
          await dependencies.failPublishJob({
            errorMessage,
            jobId: publishJob.id,
          });
        } catch (persistenceError) {
          dependencies.reportError?.(
            "publish_job_failure_persistence_failed",
            {
              error: persistenceError,
              jobId: publishJob.id,
              targetId: target.id,
            },
          );
        }
      }

      await dependencies.failTarget({
        errorCode: dependencies.getErrorCode(error),
        errorMessage,
        targetId: target.id,
        userId: params.userId,
      });
      continue;
    }

    let schedule: { arn: string | null; name: string } | null = null;
    let schedulerDeletedAt: string | null = null;

    try {
      schedule = await dependencies.createProviderSchedule({
        jobId: publishJob.id,
        scheduledFor: target.scheduled_for,
        targetId: target.id,
      });

      try {
        await dependencies.markProviderSchedule({
          scheduleArn: schedule.arn,
          scheduleName: schedule.name,
          targetId: target.id,
          userId: params.userId,
        });
        scheduledCount += 1;
        continue;
      } catch (persistenceError) {
        try {
          await dependencies.deleteProviderSchedule(schedule.name);
          schedulerDeletedAt = dependencies.now();
        } catch (cleanupError) {
          dependencies.reportError?.("compensation_failed", {
            error: cleanupError,
            scheduleName: schedule.name,
            targetId: target.id,
          });
        }

        throw persistenceError;
      }
    } catch (error) {
      const errorMessage = dependencies.getErrorMessage(error);

      try {
        await dependencies.markSchedulerFallback({
          errorMessage,
          scheduleArn: schedule?.arn ?? null,
          scheduleName: schedule?.name ?? null,
          schedulerDeletedAt,
          targetId: target.id,
          userId: params.userId,
        });
      } catch (fallbackError) {
        dependencies.reportError?.("fallback_persistence_failed", {
          error: fallbackError,
          targetId: target.id,
        });
      }

      dependencies.reportWarning?.("scheduler_fallback_active", {
        error: errorMessage,
        targetId: target.id,
      });
      scheduledCount += 1;
    }
  }

  return {
    failedCount,
    scheduledCount,
  };
}
