import "server-only";
import { localStartingFrameConfig, localStartingFrameMode, localStartingFramePath, localStartingFramePort } from "../../worker/src/lib/local-starting-frame.ts";
import { FirebaseAuthRequestError, type VerifiedFirebaseUser } from "../firebase/server-auth";
import type { BackgroundJobRecord } from "./background-jobs";

export function startingFrameLocalDelivery(user: VerifiedFirebaseUser) {
  if (process.env.LOCAL_APP_WORKER === "true" || process.env.LOCAL_STARTING_FRAME_WORKER !== "true") return null;
  if (!user.emailVerified || user.email?.trim().toLowerCase() !== "vtu19403@veltech.edu.in") {
    throw new FirebaseAuthRequestError("Local starting-frame generation is restricted to the verified tester account.", 403);
  }
  try {
    const secret = localStartingFrameConfig(process.env)?.secret;
    if (!secret) throw new Error("Local configuration missing.");
    const url = `http://127.0.0.1:${localStartingFramePort}${localStartingFramePath}`;
    async function send(job?: BackgroundJobRecord) {
      try {
        const response = await fetch(url, {
          method: job ? "POST" : "GET",
          headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
          body: job ? JSON.stringify({ jobId: job.id, ownerId: user.uid }) : undefined,
          redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
        });
        if (response.status !== (job ? 202 : 204)) throw new Error("Local worker rejected delivery.");
      } catch {
        throw new FirebaseAuthRequestError(job
          ? "The local job is saved. Start the worker and check this request again."
          : "The local starting-frame worker is unavailable. Start it and try again.", 503);
      }
    }
    return { mode: localStartingFrameMode, check: () => send(), dispatch: (job: BackgroundJobRecord) => send(job) };
  } catch {
    throw new FirebaseAuthRequestError("Local starting-frame mode requires local Supabase and a matching worker secret.", 503);
  }
}

export async function checkLocalAppWorker(user: VerifiedFirebaseUser) {
  if (process.env.LOCAL_APP_WORKER !== "true") return;
  if (!user.emailVerified || user.email?.trim().toLowerCase() !== "vtu19403@veltech.edu.in" ||
      user.uid !== process.env.LOCAL_APP_WORKER_OWNER_ID?.trim()) {
    throw new FirebaseAuthRequestError("Local generation is restricted to the verified tester account.", 403);
  }
  try {
    await sendLocalAppWorker();
  } catch {
    throw new FirebaseAuthRequestError("The local worker or isolated test database is unavailable.", 503);
  }
}

export async function sendLocalAppWorker(job?: BackgroundJobRecord) {
  const config = localStartingFrameConfig(process.env);
  if (!config?.ownerId || (job && job.userId !== config.ownerId)) {
    throw new Error("Local worker owner or configuration mismatch.");
  }
  const response = await fetch(`http://127.0.0.1:${localStartingFramePort}${localStartingFramePath}`, {
    method: job ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${config.secret}`, "content-type": "application/json",
      "x-local-worker-owner": config.ownerId,
      "x-local-worker-publish": String(config.publish),
    },
    body: job ? JSON.stringify({ jobId: job.id, ownerId: config.ownerId }) : undefined,
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (response.status !== (job ? 202 : 204)) throw new Error("The local worker is unavailable or rejected the job.");
}
