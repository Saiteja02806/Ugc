import { loadWorkerConfig } from "./config.js";
import { getErrorMessage, logger } from "./logger.js";
import { createWorkerSqsClient, receiveWorkerMessages } from "./lib/sqs.js";
import { createSupabaseJobStore } from "./lib/supabase.js";
import {
  CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
  CAROUSEL_RUNTIME_MATCHER_VERSION,
} from "./lib/carousel-runtime-visual-bucket-matcher.js";
import {
  CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  getCarouselBroadMatcherMode,
} from "./lib/carousel-broad-runtime-visual-matcher.js";
import { CAROUSEL_CONTENT_PLANNER_VERSION } from "./lib/carousel-llm-slide-plan.js";
import { CAROUSEL_RENDERER_VERSION } from "./lib/carousel-render-slide.js";
import { processWorkerMessage } from "./processor.js";

let shouldStop = false;

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

void main().catch((error) => {
  logger.error("Worker crashed", {
    error: getErrorMessage(error),
  });
  process.exitCode = 1;
});

async function main() {
  const config = loadWorkerConfig();
  const sqsClient = createWorkerSqsClient(config);
  const store = createSupabaseJobStore({
    supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    supabaseUrl: config.supabaseUrl,
  });

  logger.info("UGC worker started", {
    allowedJobTypes: config.allowedJobTypes,
    hasWorkerQueueUrl: Boolean(config.queueUrl),
    pollMaxMessages: config.pollMaxMessages,
    pollWaitTimeSeconds: config.pollWaitTimeSeconds,
    queueName: config.queueName,
    runOnce: config.workerRunOnce,
    visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
    workerGitCommit: config.workerGitCommit,
    workerId: config.workerId,
    workerVersion: config.workerVersion,
    carouselImageSafetyPolicyVersion:
      CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
    carouselBroadMatcherMode: getCarouselBroadMatcherMode(),
    carouselBroadMatcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
    carouselContentPlannerVersion: CAROUSEL_CONTENT_PLANNER_VERSION,
    carouselRuntimeMatcherVersion: CAROUSEL_RUNTIME_MATCHER_VERSION,
    carouselRendererVersion: CAROUSEL_RENDERER_VERSION,
  });

  while (!shouldStop) {
    try {
      const messages = await receiveWorkerMessages({
        client: sqsClient,
        config,
      });

      if (messages.length === 0) {
        logger.debug("No worker messages received");

        if (config.workerRunOnce) {
          break;
        }

        continue;
      }

      for (const message of messages) {
        if (shouldStop) {
          break;
        }

        await processWorkerMessage({
          config,
          message,
          sqsClient,
          store,
        });
      }

      if (config.workerRunOnce) {
        break;
      }
    } catch (error) {
      logger.error("Worker polling iteration failed", {
        error: getErrorMessage(error),
      });

      if (config.workerRunOnce) {
        throw error;
      }

      await sleep(5_000);
    }
  }

  logger.info("UGC worker stopped", {
    workerId: config.workerId,
  });
}

function requestShutdown(signal: string) {
  shouldStop = true;
  logger.info("Worker shutdown requested", {
    signal,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
