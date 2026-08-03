import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
} from "./trending-hook-copy-contract.ts";

const workerSource = readFileSync(
  new URL(
    "../../worker/src/lib/trending-hook-copy.ts",
    import.meta.url,
  ),
  "utf8",
);

test("the app and worker share the same Hook generation contract versions", () => {
  assert.match(
    workerSource,
    new RegExp(
      `TRENDING_HOOK_PROMPT_VERSION\\s*=\\s*\\n?\\s*"${TRENDING_HOOK_PROMPT_VERSION}"`,
    ),
  );
  assert.match(
    workerSource,
    new RegExp(
      `TRENDING_HOOK_SELECTION_VERSION\\s*=\\s*\\n?\\s*"${TRENDING_HOOK_SELECTION_VERSION}"`,
    ),
  );
});

test("the Hook worker delegates reading comfort to review instead of a fixed word table", () => {
  assert.match(
    workerSource,
    /estimatedReadingSeconds[\s\S]*candidate\.durationSeconds/,
  );
  assert.match(workerSource, /no words-per-second formula/i);
  assert.doesNotMatch(
    workerSource,
    /durationSeconds\s*\*\s*(?:2|3|4|5)/,
  );
});
