import RunwayML from "@runwayml/sdk";

import { downloadVideoToBuffer } from "./download-video.js";

type GenerateRunwayHookVideoParams = {
  prompt: string;
  referenceImageUrl?: string;
};

const RUNWAY_POLL_INTERVAL_MS = 5_000;
const RUNWAY_TIMEOUT_MS = 8 * 60_000;
const RUNWAY_PROMPT_LIMIT = 1_000;
const RUNWAY_DURATION_SECONDS = 4;
const RUNWAY_IMAGE_TO_VIDEO_MODEL = "gen4_turbo";
const RUNWAY_TEXT_TO_VIDEO_MODEL = "veo3.1_fast";

let runwayClient: RunwayML | null = null;

export async function generateRunwayHookVideoBuffer({
  prompt,
  referenceImageUrl,
}: GenerateRunwayHookVideoParams) {
  const client = getRunwayClient();
  const promptText = prompt.trim().slice(0, RUNWAY_PROMPT_LIMIT);
  const task = referenceImageUrl
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
        ratio: "720:1280",
      })
    : await client.textToVideo.create({
        audio: false,
        duration: RUNWAY_DURATION_SECONDS,
        model: RUNWAY_TEXT_TO_VIDEO_MODEL,
        promptText,
        ratio: "720:1280",
      });
  const outputUrl = await waitForRunwayOutput(client, task.id);

  return downloadVideoToBuffer(outputUrl);
}

function getRunwayClient() {
  if (!runwayClient) {
    runwayClient = new RunwayML({
      apiKey: getRequiredEnv("RUNWAYML_API_SECRET"),
    });
  }

  return runwayClient;
}

async function waitForRunwayOutput(client: RunwayML, taskId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= RUNWAY_TIMEOUT_MS) {
    const task = await client.tasks.retrieve(taskId);

    if (task.status === "SUCCEEDED") {
      const outputUrl = task.output[0];

      if (!outputUrl) {
        throw new Error("Runway task completed without an output URL.");
      }

      return outputUrl;
    }

    if (task.status === "FAILED") {
      throw new Error(`Runway task failed: ${task.failure}`);
    }

    if (task.status === "CANCELLED") {
      throw new Error("Runway task was cancelled.");
    }

    await sleep(RUNWAY_POLL_INTERVAL_MS);
  }

  throw new Error("Runway video generation timed out.");
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
