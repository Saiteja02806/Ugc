import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkerConfig } from "../config.js";
import { processRecoveredWorkerJob } from "../processor.js";
import { getErrorMessage, logger } from "../logger.js";
import type { createSupabaseJobStore } from "./supabase.js";
import { localStartingFrameMode } from "./local-starting-frame.js";
import { parseHookKeyframeGenerationReceipt } from "./hook-keyframe-generation-contract.js";

export function createLocalStartingFrameReceiver(params: {
  secret: string;
  ownerId?: string;
  publish?: boolean;
  config: WorkerConfig;
  store: ReturnType<typeof createSupabaseJobStore>;
}) {
  const expected = Buffer.from(`Bearer ${params.secret}`);
  const pending = new Set<string>();
  return async (request: IncomingMessage, response: ServerResponse) => {
    const reply = (status: number) => response.writeHead(status, { "cache-control": "no-store" }).end();
    const actual = Buffer.from(request.headers.authorization ?? "");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(403);
    if (request.headers["x-local-worker-owner"] !== params.ownerId ||
        (params.ownerId && request.headers["x-local-worker-publish"] !== String(params.publish))) return reply(403);
    if (request.method === "GET") {
      await params.store.getJobById("00000000-0000-0000-0000-000000000000");
      return reply(204);
    }
    if (request.method !== "POST") return reply(405);

    let body = "";
    let input: { jobId?: unknown; ownerId?: unknown };
    try {
      for await (const chunk of request) {
        body += String(chunk);
        if (body.length > 512) return reply(400);
      }
      input = JSON.parse(body);
      if (!input || typeof input.jobId !== "string" ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.jobId) ||
          typeof input.ownerId !== "string") return reply(400);
    } catch {
      return reply(400);
    }

    const jobId = input.jobId;
    const job = await params.store.getJobById(jobId);
    const saved = job?.input_json;
    if (!job || job.user_id !== input.ownerId) return reply(404);
    if (params.ownerId) {
      if (job.user_id !== params.ownerId || job.job_type === "publish_social_post" ||
          !params.config.allowedJobTypes.includes(job.job_type)) return reply(404);
    } else if (job.job_type !== "generate_image" || job.project_id !== "hook-starting-frame" ||
        !saved || typeof saved !== "object" || Array.isArray(saved) ||
        saved.localStartingFrameMode !== localStartingFrameMode ||
        parseHookKeyframeGenerationReceipt(saved.hookKeyframe)?.ownerId !== job.user_id) return reply(404);
    if (job.status !== "queued" || pending.has(jobId)) return reply(202);
    pending.add(jobId);
    reply(202);

    async function run() {
      try {
        const current = await params.store.getJobById(jobId);
        if (current?.status !== "queued") {
          pending.delete(jobId);
          return;
        }
        const wait = Date.parse(current.next_attempt_at ?? "") - Date.now();
        if (wait > 0) {
          setTimeout(() => void run(), Math.min(wait, 60_000)).unref();
          return;
        }
        await processRecoveredWorkerJob({ ...params, jobId });
        const latest = await params.store.getJobById(jobId);
        if (latest?.status === "queued" && latest.next_attempt_at && latest.next_attempt_at !== current.next_attempt_at) {
          setTimeout(() => void run(), 1000).unref();
          return;
        }
      } catch (error) {
        logger.error("Local starting-frame execution failed", { jobId, error: getErrorMessage(error) });
      }
      pending.delete(jobId);
    }
    void run();
  };
}
