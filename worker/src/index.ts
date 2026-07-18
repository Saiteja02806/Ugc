import { createServer, type Server } from "node:http";

import { loadWorkerConfig } from "./config.js";
import { getErrorMessage, logger } from "./logger.js";
import { createWorkerQueueTransport } from "./lib/queue.js";
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
import { getCarouselFontRuntimeInfo } from "./lib/carousel-font-runtime.js";
import {
  processRecoveredWorkerJob,
  processWorkerMessage,
} from "./processor.js";

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
  const healthServer = await startWorkerHealthServer();
  const queue = createWorkerQueueTransport(config);
  const store = createSupabaseJobStore({
    supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    supabaseUrl: config.supabaseUrl,
  });

  logger.info("UGC worker started", {
    allowedJobTypes: config.allowedJobTypes,
    hasWorkerQueueUrl: Boolean(config.queueUrl),
    pollMaxMessages: config.pollMaxMessages,
    pollWaitTimeSeconds: config.pollWaitTimeSeconds,
    pubsubSubscriptionName: config.pubsubSubscriptionName,
    queueName: config.queueName,
    queueProvider: queue.providerName,
    runOnce: config.workerRunOnce,
    socialReconciliationBatchSize: config.socialReconciliationBatchSize,
    socialReconciliationEnabled: config.socialReconciliationEnabled,
    socialReconciliationIntervalSeconds:
      config.socialReconciliationIntervalSeconds,
    visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
    workerGitCommit: config.workerGitCommit,
    workerId: config.workerId,
    workerVersion: config.workerVersion,
    carouselImageSafetyPolicyVersion:
      CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
    carouselBroadMatcherMode: getCarouselBroadMatcherMode(),
    carouselBroadMatcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
    carouselContentPlannerMode:
      process.env.CAROUSEL_CONTENT_PLANNER_MODE?.trim() || "llm",
    carouselContentPlannerVersion: CAROUSEL_CONTENT_PLANNER_VERSION,
    carouselFont: getCarouselFontRuntimeInfo(),
    carouselOpenAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    carouselRuntimeMatcherVersion: CAROUSEL_RUNTIME_MATCHER_VERSION,
    carouselRendererVersion: CAROUSEL_RENDERER_VERSION,
  });

  let nextSocialReconciliationAt = 0;

  try {
    while (!shouldStop) {
      try {
        if (
          config.socialReconciliationEnabled &&
          config.allowedJobTypes.includes("publish_social_post") &&
          Date.now() >= nextSocialReconciliationAt
        ) {
          nextSocialReconciliationAt =
            Date.now() + config.socialReconciliationIntervalSeconds * 1_000;
          await reconcileDueSocialPublishJobs({ config, store }).catch((error) => {
            logger.error("Social schedule reconciliation failed", {
              error: getErrorMessage(error),
            });
          });
        }

        const messages = await queue.receiveMessages();

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
            queue,
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
  } finally {
    await stopWorkerHealthServer(healthServer);
  }
}

async function reconcileDueSocialPublishJobs(params: {
  config: ReturnType<typeof loadWorkerConfig>;
  store: ReturnType<typeof createSupabaseJobStore>;
}) {
  const staleAfterSeconds = Math.max(
    60,
    Math.min(43_200, params.config.visibilityTimeoutSeconds * 2),
  );
  const normalizedCount = await params.store.reconcileSocialScheduleState({
    limit: params.config.socialReconciliationBatchSize,
    staleAfterSeconds: Math.min(staleAfterSeconds, 3_600),
  });
  const jobIds = await params.store.listDueSocialPublishJobIds({
    limit: params.config.socialReconciliationBatchSize,
    staleAfterSeconds,
  });

  if (normalizedCount > 0 || jobIds.length > 0) {
    logger.info("Social schedule reconciliation found recovery work", {
      dueJobCount: jobIds.length,
      normalizedScheduleCount: normalizedCount,
    });
  }

  for (const jobId of jobIds) {
    if (shouldStop) {
      break;
    }

    await processRecoveredWorkerJob({
      config: params.config,
      jobId,
      store: params.store,
    });
  }
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

async function startWorkerHealthServer() {
  const rawPort =
    process.env.WORKER_HTTP_PORT?.trim() || process.env.PORT?.trim();

  if (!rawPort) {
    return null;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid worker health port: ${rawPort}`);
  }

  const server = createServer((request, response) => {
    if (request.url === "/" || request.url === "/healthz") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("ok\n");
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found\n");
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });

  logger.info("Worker health server started", {
    port,
  });

  return server;
}

async function stopWorkerHealthServer(server: Server | null) {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
