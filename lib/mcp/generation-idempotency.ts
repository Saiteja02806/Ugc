import "server-only";

import { createHash } from "node:crypto";

export type McpGenerationKind = "image" | "video";

export type McpGenerationRequest = {
  kind: McpGenerationKind;
  prompt: string;
  aspectRatio: string;
  count: 1 | 2 | 4;
  referenceAssetId?: string | null;
  durationSeconds?: number | null;
};

/** Stable semantic input for rejecting a reused request ID with different work. */
export function generationRequestFingerprint(request: McpGenerationRequest) {
  return sha256(JSON.stringify({
    kind: request.kind,
    prompt: request.prompt.trim(),
    aspect_ratio: request.aspectRatio,
    count: request.count,
    reference_asset_id: request.referenceAssetId?.toLowerCase() ?? null,
    duration_seconds: request.durationSeconds ?? null,
  }));
}

/** Keeps raw user and client identifiers out of billing and job idempotency keys. */
export function generationChildIdempotencyKey(params: {
  userId: string;
  kind: McpGenerationKind;
  clientRequestId: string;
  childIndex: number;
}) {
  if (!params.userId.trim() || !params.clientRequestId.trim() ||
      !Number.isSafeInteger(params.childIndex) || params.childIndex < 1 || params.childIndex > 4) {
    throw new Error("Invalid generation idempotency key input.");
  }
  const group = sha256(JSON.stringify([params.userId, params.kind, params.clientRequestId.trim()]));
  return `mcp:${params.kind}:${group}:${params.childIndex}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
