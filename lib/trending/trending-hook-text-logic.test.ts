import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_SELECTION_VERSION,
} from "./trending-hook-copy-contract.ts";
import {
  HOOK_TEXT_FONT_WEIGHT,
  HOOK_TEXT_LAYOUT_VERSION,
  HOOK_TEXT_OUTLINE_WIDTH,
} from "./hook-text-layout.ts";

const workerSource = readFileSync(
  new URL(
    "../../worker/src/lib/trending-hook-copy.ts",
    import.meta.url,
  ),
  "utf8",
);
const workerRenderSpec = readFileSync(
  new URL(
    "../../worker/src/lib/edit-overlay-render-spec.ts",
    import.meta.url,
  ),
  "utf8",
);
const workerRenderer = readFileSync(
  new URL(
    "../../worker/src/lib/render-engine.ts",
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

test("the app and worker share the authoritative Hook layout version", () => {
  assert.match(
    workerRenderSpec,
    new RegExp(`HOOK_TEXT_LAYOUT_VERSION\\s*=\\s*"${HOOK_TEXT_LAYOUT_VERSION}"`),
  );
});

test("the app previews share the worker Hook font weight and outline width", () => {
  assert.match(
    workerRenderSpec,
    new RegExp(`EDIT_OVERLAY_FONT_WEIGHT\\s*=\\s*${HOOK_TEXT_FONT_WEIGHT}`),
  );
  assert.match(
    workerRenderer,
    new RegExp(`style === "hook"[\\s\\S]+stroke-width="${HOOK_TEXT_OUTLINE_WIDTH}"`),
  );
});

test("the Hook worker allows one targeted repair without a hard fallback loop", () => {
  assert.match(workerSource, /const MAX_REPAIR_ROUNDS = 1/);
  assert.match(workerSource, /repairMode: "single_targeted_repair"/);
  assert.doesNotMatch(workerSource, /final_evidence_recovery/);
});
