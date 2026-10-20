import type { BackgroundJobType } from "../jobs/background-jobs.ts";

export const GCP_CUTOVER_AUDIT_CANARY_KINDS = [
  "ai-generation",
  "carousel-generation",
] as const;

export type GcpCutoverAuditCanaryKind =
  (typeof GCP_CUTOVER_AUDIT_CANARY_KINDS)[number];

type GcpCutoverAuditCanary = {
  expectedFailure: string;
  input: Record<string, string | null>;
  jobType: BackgroundJobType;
  kind: GcpCutoverAuditCanaryKind;
  maxAttempts?: number;
};

export function resolveGcpCutoverAuditCanary(params: {
  generationId: string;
  kind: unknown;
}): GcpCutoverAuditCanary | null {
  if (params.kind === undefined || params.kind === "ai-generation") {
    return {
      expectedFailure: "generate_image requires input.prompt",
      input: {
        canary: "production-gcp-cutover-invalid-ai-generation",
        generationId: params.generationId,
      },
      jobType: "generate_image",
      kind: "ai-generation",
    };
  }

  if (params.kind === "carousel-generation") {
    return {
      // The Carousel worker rejects this before it can load a Carousel row,
      // reserve an idea, call the LLM, select an image, or write output. It
      // proves the exact app -> Cloud Tasks -> Carousel worker delivery path.
      expectedFailure: "generate_carousel requires input.carouselId.",
      input: {
        canary: "production-carousel-generation-invalid-payload",
        generationId: params.generationId,
      },
      jobType: "generate_carousel",
      kind: "carousel-generation",
      maxAttempts: 1,
    };
  }

  return null;
}
