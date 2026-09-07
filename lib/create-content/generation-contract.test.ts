import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATE_CONTENT_DEFAULT_OPTION_COUNT,
  CREATE_CONTENT_MAX_OPTION_COUNT,
  CREATE_CONTENT_WALL_TEXT_LINE_RANGE,
  CREATE_CONTENT_WALL_TEXT_WORD_RANGE,
  resolveCreateContentOptionCount,
} from "./generation-contract.ts";
import { selectCreateContentHookFormats } from "./hook-format-library.ts";

test("Create Content returns four copy options when the chat request has no count", () => {
  assert.equal(
    resolveCreateContentOptionCount({
      request: "Create Wall-of-Text copy for my post.",
    }),
    CREATE_CONTENT_DEFAULT_OPTION_COUNT,
  );
});

test("Create Content reads a count connected to the requested Hook or Wall copy", () => {
  assert.equal(
    resolveCreateContentOptionCount({ request: "Give me 20 hook texts." }), 20);
  assert.equal(
    resolveCreateContentOptionCount({ request: "Create 6 Wall-of-Text options." }),
    6,
  );
  assert.equal(
    resolveCreateContentOptionCount({ request: "Copy for my 6-second video." }),
    CREATE_CONTENT_DEFAULT_OPTION_COUNT,
  );
  assert.equal(
    resolveCreateContentOptionCount({ request: "Give me 99 hooks." }),
    CREATE_CONTENT_MAX_OPTION_COUNT,
  );
});

test("Hook format selection uses first formats, then rotates when more are requested", () => {
  const formats = selectCreateContentHookFormats(22);

  assert.deepEqual(
    formats.slice(0, 4).map((format) => format.id),
    ["GF_001", "GF_002", "GF_003", "GF_004"],
  );
  assert.equal(formats[20]?.id, "GF_001");
  assert.equal(formats[21]?.id, "GF_002");
});

test("Wall copy uses one standard line and word range for every video", () => {
  assert.deepEqual(CREATE_CONTENT_WALL_TEXT_LINE_RANGE, { max: 8, min: 5 });
  assert.deepEqual(CREATE_CONTENT_WALL_TEXT_WORD_RANGE, { max: 40, min: 25 });
});
