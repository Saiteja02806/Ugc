import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyWallTextGenerationFailure,
  isWallTextRenderFitFailure,
  isWallTextGenerationFailureTerminalCode,
  WallTextLayoutFitError,
  WALL_TEXT_DEPENDENCY_UNAVAILABLE,
  WALL_TEXT_PERSISTENCE_REJECTED,
  WALL_TEXT_RENDER_FIT_REJECTED,
  WALL_TEXT_RUNTIME_CONFIGURATION_ERROR,
} from "./wall-text-generation-failure.ts";

test("marks a Wall database constraint rejection as terminal", () => {
  const error = Object.assign(
    new Error(
      "Could not save Wall-of-text generation candidate: new row violates check constraint \"wall_text_creatives_text_content_chk\"",
    ),
    { code: "23514" },
  );

  assert.deepEqual(classifyWallTextGenerationFailure(error), {
    errorCode: WALL_TEXT_PERSISTENCE_REJECTED,
    publicMessage:
      "Wall-of-text could not be saved because a required update is missing.",
    retryable: false,
  });
});

test("marks a deterministic Wall replacement-count rejection as terminal", () => {
  assert.deepEqual(
    classifyWallTextGenerationFailure(
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
    classifyWallTextGenerationFailure(new Error("Request timed out.")),
    {
      errorCode: "infrastructure_error",
      publicMessage: "Wall-of-text preparation could not finish yet.",
      retryable: true,
    },
  );
});

test("marks a final Wall render-fit rejection as terminal", () => {
  const error = Object.assign(new Error("Wall line is wider than its box."), {
    code: WALL_TEXT_RENDER_FIT_REJECTED,
  });

  assert.deepEqual(classifyWallTextGenerationFailure(error), {
    errorCode: WALL_TEXT_RENDER_FIT_REJECTED,
    publicMessage: "Wall-of-text could not be arranged safely inside the video.",
    retryable: false,
  });
});

test("marks deterministic V9 fixed-layout fit failures as terminal", () => {
  const error = new WallTextLayoutFitError(
    "Wall-of-text copy cannot fit five to eight balanced lines at the fixed 50px font size. Shorten the copy or widen the text box.",
  );

  assert.deepEqual(classifyWallTextGenerationFailure(error), {
    errorCode: WALL_TEXT_RENDER_FIT_REJECTED,
    publicMessage: "Wall-of-text could not be arranged safely inside the video.",
    retryable: false,
  });
  assert.equal(isWallTextGenerationFailureTerminalCode(error.code), true);
  assert.equal(isWallTextRenderFitFailure(error), true);
});

test("marks a missing packaged Wall font as a terminal configuration error", () => {
  assert.deepEqual(
    classifyWallTextGenerationFailure(
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
    classifyWallTextGenerationFailure(
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
