import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyWallTextGenerationFailure,
  WALL_TEXT_PERSISTENCE_REJECTED,
  WALL_TEXT_RENDER_FIT_REJECTED,
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
