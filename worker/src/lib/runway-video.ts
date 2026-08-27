import RunwayML from "@runwayml/sdk";

import { downloadVideoToBuffer } from "./download-video.js";
import {
  assertRunwayDailyCreditBudget,
  estimateRunwayVideoCredits,
} from "./runway-credit-budget.js";
import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

type GenerateRunwayHookVideoParams = {
  aspectRatio?: RunwayAspectRatio;
  onOperationCreated?: (operationId: string) => Promise<void>;
  onOperationSucceeded?: (
    operationId: string,
    outputUrl: string,
  ) => Promise<void>;
  prompt: string;
  providerOperationId?: string;
  referenceImageUrl?: string;
  referenceVideoDurationSeconds?: number;
  referenceVideoUrl?: string;
};

export type RunwayAspectRatio = "9:16" | "16:9";

const RUNWAY_POLL_INTERVAL_MS = 5_000;
const RUNWAY_TIMEOUT_MS = 8 * 60_000;
const RUNWAY_PROMPT_LIMIT = 1_000;
const RUNWAY_DURATION_SECONDS = 4;
const RUNWAY_IMAGE_TO_VIDEO_MODEL = "gen4_turbo";
const RUNWAY_TEXT_TO_VIDEO_MODEL = "veo3.1_fast";
const RUNWAY_VIDEO_TO_VIDEO_MODEL = "aleph2";

let runwayClient: RunwayML | null = null;

export async function generateRunwayHookVideoBuffer({
  aspectRatio = "9:16",
  onOperationCreated,
  onOperationSucceeded,
  prompt,
  providerOperationId,
  referenceImageUrl,
  referenceVideoDurationSeconds,
  referenceVideoUrl,
}: GenerateRunwayHookVideoParams) {
  if (referenceImageUrl && referenceVideoUrl) {
    throw new ProviderRequestNotSubmittedError(
      "Choose either a reference image or reference video, not both.",
    );
  }

  const client = getRunwayClient();
  const promptText = prompt.trim().slice(0, RUNWAY_PROMPT_LIMIT);
  let operationId = providerOperationId;

  if (!operationId) {
    const estimatedCredits = referenceVideoUrl
      ? estimateRunwayVideoCredits(
          RUNWAY_VIDEO_TO_VIDEO_MODEL,
          referenceVideoDurationSeconds ?? RUNWAY_DURATION_SECONDS,
        )
      : referenceImageUrl
      ? estimateRunwayVideoCredits(
          RUNWAY_IMAGE_TO_VIDEO_MODEL,
          RUNWAY_DURATION_SECONDS,
        )
      : estimateRunwayVideoCredits(
          RUNWAY_TEXT_TO_VIDEO_MODEL,
          RUNWAY_DURATION_SECONDS,
        );

    await assertRunwayDailyCreditBudget(
      client.organization,
      estimatedCredits,
    );

    const task = referenceVideoUrl
      ? await client.videoToVideo.create({
          model: RUNWAY_VIDEO_TO_VIDEO_MODEL,
          promptText,
          targetAspectRatio: aspectRatio,
          videoUri: referenceVideoUrl,
        })
      : referenceImageUrl
      ? await client.imageToVideo.create({
          duration: RUNWAY_DURATION_SECONDS,
          model: RUNWAY_IMAGE_TO_VIDEO_MODEL,
          promptImage: [
            {
              position: "first",
              uri: referenceImageUrl,
            },
          ],
          promptText,
          ratio: getRunwayRatio(aspectRatio),
        })
      : await client.textToVideo.create({
          audio: false,
          duration: RUNWAY_DURATION_SECONDS,
          model: RUNWAY_TEXT_TO_VIDEO_MODEL,
          promptText,
          ratio: getRunwayRatio(aspectRatio),
        });
    operationId = task.id;
    await onOperationCreated?.(operationId);
  }

  const outputUrl = await waitForRunwayOutput(client, operationId);
  await onOperationSucceeded?.(operationId, outputUrl);

  return downloadVideoToBuffer(outputUrl);
}

function getRunwayRatio(aspectRatio: RunwayAspectRatio) {
  return aspectRatio === "16:9" ? ("1280:720" as const) : ("720:1280" as const);
}

function getRunwayClient() {
  if (!runwayClient) {
    runwayClient = new RunwayML({
      apiKey: getRequiredProviderEnv("RUNWAYML_API_SECRET"),
      maxRetries: 0,
    });
  }

  return runwayClient;
}

async function waitForRunwayOutput(client: RunwayML, taskId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= RUNWAY_TIMEOUT_MS) {
    let task;

    try {
      task = await client.tasks.retrieve(taskId);
    } catch (error) {
      throw new ProviderOperationPollingError(
        "Runway task status could not be read.",
        { cause: error },
      );
    }

    if (task.status === "SUCCEEDED") {
      const outputUrl = task.output[0];

      if (!outputUrl) {
        throw new Error("Runway task completed without an output URL.");
      }

      return outputUrl;
    }

    if (task.status === "FAILED") {
      throw new ProviderOperationTerminalError(
        `Runway task failed: ${task.failure}`,
        task,
      );
    }

    if (task.status === "CANCELLED") {
      throw new ProviderOperationTerminalError(
        "Runway task was cancelled.",
        task,
      );
    }

    await sleep(RUNWAY_POLL_INTERVAL_MS);
  }

  throw new ProviderOperationPollingError(
    "Runway video generation is still processing.",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
