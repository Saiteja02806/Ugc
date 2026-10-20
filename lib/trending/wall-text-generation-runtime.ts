import "server-only";

import type { BackgroundJobType } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";

const WALL_TEXT_GENERATION_JOB_TYPES = [
  "wall_text_content_plan_generation",
  "wall_text_generation",
] as const satisfies readonly BackgroundJobType[];

type WallTextGenerationRuntimeDependencies = {
  getMissingBackgroundJobStorageEnvVars: () => string[];
  getMissingJobQueueEnvVars: (jobTypes: BackgroundJobType[]) => string[];
};

const runtimeDependencies: WallTextGenerationRuntimeDependencies = {
  getMissingBackgroundJobStorageEnvVars,
  getMissingJobQueueEnvVars,
};

export function getMissingWallTextGenerationRuntimeEnvVars(
  dependencies: WallTextGenerationRuntimeDependencies = runtimeDependencies,
) {
  return Array.from(
    new Set([
      ...dependencies.getMissingBackgroundJobStorageEnvVars(),
      ...dependencies.getMissingJobQueueEnvVars([
        ...WALL_TEXT_GENERATION_JOB_TYPES,
      ]),
    ]),
  );
}

export class WallTextGenerationConfigurationError extends Error {
  readonly missingEnvVars: string[];

  constructor(missingEnvVars: string[]) {
    super(
      `Wall-of-text generation is unavailable because required queue configuration is missing: ${missingEnvVars.join(", ")}.`,
    );
    this.name = "WallTextGenerationConfigurationError";
    this.missingEnvVars = missingEnvVars;
  }
}

/**
 * Queue configuration is deployment state, not a generation failure. Check it
 * before creating a plan, reserving a daily slot, or creating a durable job;
 * otherwise a missing AI-generation URL leaves customer work marked failed
 * even though no worker was ever able to receive it.
 */
export function assertWallTextGenerationRuntimeConfigured() {
  const missingEnvVars = getMissingWallTextGenerationRuntimeEnvVars();

  if (missingEnvVars.length > 0) {
    throw new WallTextGenerationConfigurationError(missingEnvVars);
  }
}
