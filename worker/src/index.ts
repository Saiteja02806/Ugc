import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { loadWorkerConfig } from "./config.js";
import { getErrorMessage, logger } from "./logger.js";
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
} from "./processor.js";
import { parseWorkerDeliveryMessage } from "./lib/queue-message.js";

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
  const store = createSupabaseJobStore({
    supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    supabaseUrl: config.supabaseUrl,
  });
  const oneShotJobId = process.env.BACKGROUND_JOB_ID?.trim();

  if (oneShotJobId) {
    await runOneShotBackgroundJob({ config, jobId: oneShotJobId, store });
    return;
  }

  if (config.workerRunOnce) {
    throw new Error("WORKER_RUN_ONCE requires BACKGROUND_JOB_ID.");
  }

  const healthServer = await startWorkerHttpServer({ config, store });

  logger.info("UGC worker started", {
    allowedJobTypes: config.allowedJobTypes,
    queueName: config.queueName,
    queueProvider: "cloud-tasks",
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

  try {
    await waitForShutdown();

    logger.info("UGC worker stopped", {
      workerId: config.workerId,
    });
  } finally {
    await stopWorkerHealthServer(healthServer);
  }
}

async function runOneShotBackgroundJob(params: {
  config: ReturnType<typeof loadWorkerConfig>;
  jobId: string;
  store: ReturnType<typeof createSupabaseJobStore>;
}) {
  const expectedJobType = process.env.BACKGROUND_JOB_TYPE?.trim();
  const job = await params.store.getJobById(params.jobId);

  if (!job) {
    logger.warn("Cloud Run Job referenced a missing background job", {
      jobId: params.jobId,
    });
    return;
  }

  if (expectedJobType && job.job_type !== expectedJobType) {
    throw new Error(
      `Cloud Run Job type ${expectedJobType} does not match stored type ${job.job_type}.`,
    );
  }

  await processRecoveredWorkerJob({
    config: params.config,
    jobId: job.id,
    store: params.store,
  });

  const latestJob = await params.store.getJobById(job.id);

  if (
    latestJob &&
    !["cancelled", "completed", "failed", "queued"].includes(latestJob.status)
  ) {
    throw new Error(
      `Cloud Run Job exited while durable job remained ${latestJob.status}.`,
    );
  }

  logger.info("Cloud Run Job execution finished", {
    jobId: job.id,
    status: latestJob?.status ?? "missing",
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

async function startWorkerHttpServer(params: {
  config: ReturnType<typeof loadWorkerConfig>;
  store: ReturnType<typeof createSupabaseJobStore>;
}) {
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

    if (request.url === "/tasks/jobs" && request.method === "POST") {
      void handleBackgroundJobTask(request, response, params).catch((error) => {
        logger.error("Unhandled Cloud Tasks request error", {
          error: getErrorMessage(error),
        });

        if (!response.headersSent) {
          writeJsonResponse(response, 500, {
            error: "Background job task failed.",
            ok: false,
          });
        } else if (!response.writableEnded) {
          response.end();
        }
      });
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

  logger.info("Worker HTTP server started", {
    port,
  });

  return server;
}

async function handleBackgroundJobTask(
  request: IncomingMessage,
  response: ServerResponse,
  params: {
    config: ReturnType<typeof loadWorkerConfig>;
    store: ReturnType<typeof createSupabaseJobStore>;
  },
) {
  const body = await readRequestBody(request);
  const taskName = getHeader(request.headers["x-cloudtasks-taskname"]);
  let payload;

  try {
    payload = parseWorkerDeliveryMessage({
      body,
      id: taskName || "cloud-task",
      providerName: "gcp",
    });
  } catch (error) {
    writeJsonResponse(response, 400, {
      error: getErrorMessage(error),
      ok: false,
    });
    return;
  }

  if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1) {
    writeJsonResponse(response, 400, {
      error: "Unsupported background job task schema version.",
      ok: false,
    });
    return;
  }

  const job = await params.store.getJobById(payload.jobId);

  if (!job) {
    logger.warn("Cloud Task referenced a missing background job", {
      jobId: payload.jobId,
      taskName,
    });
    writeJsonResponse(response, 200, { dropped: true, ok: true });
    return;
  }

  if (job.job_type !== payload.jobType) {
    writeJsonResponse(response, 400, {
      error: "Task job type does not match the durable job record.",
      ok: false,
    });
    return;
  }

  const completed = await processRecoveredWorkerJob({
    config: params.config,
    jobId: job.id,
    store: params.store,
  });
  const latestJob = await params.store.getJobById(job.id);

  if (
    completed ||
    !latestJob ||
    ["cancelled", "completed", "failed"].includes(latestJob.status)
  ) {
    writeJsonResponse(response, 200, {
      jobId: job.id,
      ok: true,
      status: latestJob?.status ?? "missing",
    });
    return;
  }

  writeJsonResponse(response, 503, {
    error: "The durable job is not ready to execute yet.",
    jobId: job.id,
    ok: false,
    status: latestJob.status,
  });
}

function readRequestBody(
  request: IncomingMessage,
) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;

    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;

      if (bytes > 1_000_000) {
        reject(new Error("Background job task body is too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });
    request.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.once("error", reject);
  });
}

function writeJsonResponse(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function getHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function waitForShutdown() {
  while (!shouldStop) {
    await sleep(1_000);
  }
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
