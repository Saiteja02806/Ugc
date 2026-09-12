import assert from "node:assert/strict";
import test from "node:test";

import { resolveGcpCutoverAuditCanary } from "./gcp-cutover-audit-canary.ts";

test("keeps the existing AI-generation audit as the default", () => {
  assert.deepEqual(
    resolveGcpCutoverAuditCanary({ generationId: "generation-1", kind: undefined }),
    {
      expectedFailure: "generate_image requires input.prompt",
      input: {
        canary: "production-gcp-cutover-invalid-ai-generation",
        generationId: "generation-1",
      },
      jobType: "generate_image",
      kind: "ai-generation",
    },
  );
});

test("builds a bounded media-free Create Content render canary", () => {
  assert.deepEqual(
    resolveGcpCutoverAuditCanary({
      generationId: "generation-2",
      kind: "create-content-render",
    }),
    {
      expectedFailure: "overlay must be an object.",
      input: {
        canary: "production-create-content-render-invalid-payload",
        generationId: "generation-2",
        overlay: null,
      },
      jobType: "render_create_content_video",
      kind: "create-content-render",
      maxAttempts: 1,
    },
  );
});

test("builds a bounded Carousel delivery canary", () => {
  assert.deepEqual(
    resolveGcpCutoverAuditCanary({
      generationId: "generation-carousel",
      kind: "carousel-generation",
    }),
    {
      expectedFailure: "generate_carousel requires input.carouselId.",
      input: {
        canary: "production-carousel-generation-invalid-payload",
        generationId: "generation-carousel",
      },
      jobType: "generate_carousel",
      kind: "carousel-generation",
      maxAttempts: 1,
    },
  );
});

test("rejects a canary kind outside the fixed allowlist", () => {
  assert.equal(
    resolveGcpCutoverAuditCanary({ generationId: "generation-3", kind: "anything" }),
    null,
  );
});
