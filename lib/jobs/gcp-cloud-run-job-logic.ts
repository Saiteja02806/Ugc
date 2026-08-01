import type { BackgroundJobType } from "./background-jobs.ts";

const CLOUD_RUN_RESOURCE_PATTERN = /^[a-z](?:[-a-z0-9]{0,61}[a-z0-9])?$/;

export function buildCloudRunJobExecutionRequest(params: {
  jobId: string;
  jobName: string;
  jobType: BackgroundJobType;
  location: string;
  projectId: string;
  timeoutSeconds: number;
}) {
  for (const [label, value] of [
    ["project", params.projectId],
    ["location", params.location],
    ["job", params.jobName],
  ] as const) {
    if (!CLOUD_RUN_RESOURCE_PATTERN.test(value)) {
      throw new Error(`Invalid Cloud Run ${label} name.`);
    }
  }

  const timeoutSeconds = Math.max(
    60,
    Math.min(Math.trunc(params.timeoutSeconds), 86_400),
  );
  const jobPath = `projects/${params.projectId}/locations/${params.location}/jobs/${params.jobName}`;

  return {
    endpoint: `https://run.googleapis.com/v2/${jobPath}:run`,
    jobPath,
    requestBody: {
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: "BACKGROUND_JOB_ID", value: params.jobId },
              { name: "BACKGROUND_JOB_TYPE", value: params.jobType },
              { name: "WORKER_RUN_ONCE", value: "true" },
            ],
          },
        ],
        taskCount: 1,
        timeout: `${timeoutSeconds}s`,
      },
    },
  };
}
