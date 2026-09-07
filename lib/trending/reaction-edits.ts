import "server-only";

import { randomUUID } from "node:crypto";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { SchedulingRequestError } from "@/lib/scheduling/errors";
import { getReactionClient, type ReactionCreativeRow } from "./reaction-feed";
import { getReactionTextEditState, getReactionUserTextEdit, type ReactionTextEditRecord } from "./reaction-edit-contract";

type Scope = { assignmentId: string; creativeId: string; userId: string };

async function loadCreative(scope: Scope) {
  const client = getReactionClient();
  const { data: assignment, error } = await client.from("user_reaction_assignments")
    .select("id").eq("id", scope.assignmentId).eq("reaction_creative_id", scope.creativeId)
    .eq("user_id", scope.userId).in("state", ["active", "selected"]).maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) throw new SchedulingRequestError("This Reaction Reel is no longer available to edit.", 404);
  const result = await client.from("reaction_creatives").select("*")
    .eq("id", scope.creativeId).eq("user_id", scope.userId).eq("render_status", "preview_ready").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new SchedulingRequestError("This Reaction Reel is no longer available to edit.", 404);
  return result.data;
}

function serialize(scope: Scope, creative: ReactionCreativeRow): ReactionTextEditRecord {
  const edit = getReactionUserTextEdit(creative.content_json);
  const lines = Array.isArray(creative.content_json.lines) ? creative.content_json.lines : [creative.caption];
  return {
    assignmentId: scope.assignmentId,
    creativeId: creative.id,
    expectedUpdatedAt: creative.updated_at,
    mediaAssetId: creative.rendered_media_asset_id,
    previewUrl: creative.preview_url,
    state: getReactionTextEditState(creative.content_json),
    text: (edit?.lines ?? lines).join("\n"),
  };
}

export async function loadReactionTextEdit(scope: Scope): Promise<ReactionTextEditRecord> {
  const creative = await loadCreative(scope);
  // A worker can terminate before its handler catches the failure. Reconcile
  // terminal job state so the text editor always offers a way to retry.
  if (getReactionTextEditState(creative.content_json) === "preparing" && creative.render_job_id) {
    const job = await getBackgroundJobForUser({ jobId: creative.render_job_id, userId: scope.userId });
    if (job && ["failed", "cancelled"].includes(job.status)) {
      const content = { ...creative.content_json, userTextEdit: { ...getReactionUserTextEdit(creative.content_json)!, status: "failed" } };
      const { data, error } = await getReactionClient().from("reaction_creatives")
        .update({ content_json: content }).eq("id", creative.id).eq("user_id", scope.userId)
        .eq("updated_at", creative.updated_at).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return serialize(scope, data ?? await loadCreative(scope));
    }
  }
  return serialize(scope, creative);
}

export async function saveReactionTextEdit(scope: Scope & { expectedUpdatedAt: string; text: string }) {
  const creative = await loadCreative(scope);
  if (creative.updated_at !== scope.expectedUpdatedAt) {
    throw new SchedulingRequestError("This Reaction Reel changed in another tab. Reopen Edit and try again.", 409);
  }
  const current = getReactionUserTextEdit(creative.content_json);
  if (current?.status === "queued") {
    throw new SchedulingRequestError("Preparing video. Wait for this edit to finish.", 409);
  }
  const lines = scope.text.split(/\r?\n/u).map((line) => line.trim().replace(/\s+/gu, " ")).filter(Boolean);
  const revision = (current?.revision ?? 0) + 1;
  await createAndDispatchBackgroundJob({
    // Each candidate save owns its job. Only the optimistic creative update
    // below can win; a losing tab must never mark the winner's job failed.
    idempotencyKey: `reaction-text-edit:${creative.id}:${randomUUID()}`,
    input: { creativeId: creative.id, format: "reaction", revision, userId: scope.userId },
    jobType: "final_render",
    maxAttempts: 3,
    projectId: "reaction-text-edit",
    userId: scope.userId,
  }, {
    beforeDispatch: async (job) => {
      const { data, error } = await getReactionClient().from("reaction_creatives")
        .update({
          content_json: { ...creative.content_json, userTextEdit: { lines, revision, status: "queued" } },
          render_job_id: job.id,
        }).eq("id", creative.id).eq("user_id", scope.userId)
        .eq("updated_at", scope.expectedUpdatedAt).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new SchedulingRequestError("This Reaction Reel changed in another tab. Reopen Edit and try again.", 409);
    },
  });
  return loadReactionTextEdit(scope);
}
