import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyWallTextGenerationFailure,
  isWallTextRenderFitFailure,
  isWallTextGenerationFailureTerminalCode,
  WallTextLayoutFitError,
  WALL_TEXT_CONTENT_RETRY_EXHAUSTED,
  WALL_TEXT_DEPENDENCY_UNAVAILABLE,
  WALL_TEXT_PERSISTENCE_REJECTED,
  WALL_TEXT_RENDER_FIT_REJECTED,
  WALL_TEXT_RUNTIME_CONFIGURATION_ERROR,
} from "./wall-text-generation-failure.ts";

const diagnosticsMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260912110000_add_private_wall_text_failure_diagnostics.sql",
    import.meta.url,
  ),
  "utf8",
);

test("marks a Wall database constraint rejection as terminal", () => {
  const error = Object.assign(
    new Error(
      "Could not save Wall-of-text generation candidate: new row violates check constraint \"wall_text_creatives_text_content_chk\"",
    ),
    { code: "23514" },
  );

  assert.deepEqual(publicFailure(error), {
    errorCode: WALL_TEXT_PERSISTENCE_REJECTED,
    publicMessage:
      "Wall-of-text could not be saved because a required update is missing.",
    retryable: false,
  });
});

test("marks a deterministic Wall replacement-count rejection as terminal", () => {
  assert.deepEqual(
    publicFailure(
      new Error(
        "Could not refresh Trending Wall-of-text copy: wall_text_regeneration_invalid_count",
      ),
    ),
    {
      errorCode: WALL_TEXT_PERSISTENCE_REJECTED,
      publicMessage:
        "Wall-of-text could not be saved because a required update is missing.",
      retryable: false,
    },
  );
});

test("keeps a timeout retryable", () => {
  assert.deepEqual(
    publicFailure(new Error("Request timed out.")),
    {
      errorCode: "infrastructure_error",
      publicMessage: "Wall-of-text preparation could not finish yet.",
      retryable: true,
    },
  );
});

test("does not spend more model calls on a persisted background uniqueness conflict", () => {
  for (const error of [
    { code: "23505" },
    new Error('Could not save Wall-of-text generation candidate: duplicate key value violates unique constraint "wall_text_creatives_profile_asset_key"'),
  ]) {
    const result = classifyWallTextGenerationFailure(error);
    assert.equal(result.retryable, false);
    assert.equal(result.errorCode, WALL_TEXT_PERSISTENCE_REJECTED);
  }
});

test("marks a final Wall render-fit rejection as terminal", () => {
  const error = Object.assign(new Error("Wall line is wider than its box."), {
    code: WALL_TEXT_RENDER_FIT_REJECTED,
  });

  assert.deepEqual(publicFailure(error), {
    errorCode: WALL_TEXT_RENDER_FIT_REJECTED,
    publicMessage: "Wall-of-text could not be arranged safely inside the video.",
    retryable: false,
  });
});

test("marks exhausted candidate repair as terminal so a retry reserves new plan items", () => {
  const error = Object.assign(
    new Error("Wall-of-text Writer could not repair candidates: 0:word_limit."),
    { code: WALL_TEXT_CONTENT_RETRY_EXHAUSTED },
  );

  assert.deepEqual(publicFailure(error), {
    errorCode: WALL_TEXT_CONTENT_RETRY_EXHAUSTED,
    publicMessage:
      "Wall-of-text needs a different content idea before it can be prepared.",
    retryable: false,
  });
  assert.equal(isWallTextGenerationFailureTerminalCode(error.code), true);
});

test("marks deterministic V9 fixed-layout fit failures as terminal", () => {
  const error = new WallTextLayoutFitError(
    "Wall-of-text copy cannot fit five to eight balanced lines at the fixed 50px font size. Shorten the copy or widen the text box.",
  );

  assert.deepEqual(publicFailure(error), {
    errorCode: WALL_TEXT_RENDER_FIT_REJECTED,
    publicMessage: "Wall-of-text could not be arranged safely inside the video.",
    retryable: false,
  });
  assert.equal(isWallTextGenerationFailureTerminalCode(error.code), true);
  assert.equal(isWallTextRenderFitFailure(error), true);
});

test("marks a missing packaged Wall font as a terminal configuration error", () => {
  assert.deepEqual(
    publicFailure(
      new Error(
        "The packaged Avenir Next Demi Bold font is unavailable for Wall-of-text measurement.",
      ),
    ),
    {
      errorCode: WALL_TEXT_RUNTIME_CONFIGURATION_ERROR,
      publicMessage:
        "Wall-of-text is unavailable because a required runtime dependency is not configured.",
      retryable: false,
    },
  );
});

test("marks an unavailable Wall audio dependency as terminal", () => {
  assert.deepEqual(
    publicFailure(
      new Error("No approved Wall audio can cover this video's duration."),
    ),
    {
      errorCode: WALL_TEXT_DEPENDENCY_UNAVAILABLE,
      publicMessage:
        "Wall-of-text cannot be prepared because a required audio dependency is unavailable.",
      retryable: false,
    },
  );
});

test("preserves provider billing and stage details for server-only diagnostics", () => {
  const error = Object.assign(new Error("Project spend limit reached."), {
    code: "project_spend_limit_exceeded",
    request_id: "req_private",
    status: 429,
    type: "insufficient_quota",
  });
  const failure = classifyWallTextGenerationFailure(error, "writer");

  assert.equal(failure.errorCode, "wall_text_provider_billing_limit");
  assert.equal(failure.retryable, false);
  assert.deepEqual(failure.diagnostic, {
    candidateRejections: [],
    errorName: "Error",
    finishReason: null,
    providerErrorCode: "project_spend_limit_exceeded",
    providerErrorType: "insufficient_quota",
    providerRequestId: "req_private",
    providerStatus: 429,
    stage: "writer",
  });
});

test("keeps Wall failure diagnostics service-role-only and preserves the first chunk error", () => {
  assert.match(
    diagnosticsMigration,
    /create table public\.wall_text_failure_diagnostics[\s\S]+alter table public\.wall_text_failure_diagnostics enable row level security/i,
  );
  assert.match(
    diagnosticsMigration,
    /revoke all on table public\.wall_text_failure_diagnostics from public, anon, authenticated[\s\S]+grant select, insert on table public\.wall_text_failure_diagnostics to service_role/i,
  );
  assert.match(
    diagnosticsMigration,
    /record_wall_text_failure_diagnostic_v1[\s\S]+revoke all on function[\s\S]+grant execute[\s\S]+to service_role/i,
  );
  assert.match(
    diagnosticsMigration,
    /last_error_code = coalesce\(nullif\(chunk\.last_error_code, ''\), v_code\)[\s\S]+last_error_message = coalesce/i,
  );
});

function publicFailure(error: unknown) {
  const { diagnostic: _diagnostic, ...failure } =
    classifyWallTextGenerationFailure(error);
  return failure;
}
