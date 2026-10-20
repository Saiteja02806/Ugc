// Offline handoff validation only. This module does not route requests or call MCP.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv = require("ajv");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemas = {
  hook: "ugc-hook-intelligence/schemas/hook-output.schema.json",
  director: "emotion-hook-director/schemas/director-output.schema.json",
  wallCopy: "wall-text-generation/schemas/wall-copy.schema.json",
  wallVideo: "wall-text-video-generation/schemas/video-output.schema.json",
  slideshow: "ugc-native-slideshow/references/output-schema.json",
};
const ajv = new Ajv({ allErrors: true });
const validators = Object.fromEntries(Object.entries(schemas).map(([kind, relative]) => [kind,
  ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "plugins/ugc-pilot/skills", relative), "utf8"))),
]));

function validateTimeline(timeline, duration) {
  let end = 0;
  const equal = (a, b) => Math.abs(a - b) <= 1e-7;
  for (const beat of timeline) {
    assert(equal(beat.start_seconds, end), "Timeline has a gap or overlap");
    assert(beat.end_seconds > beat.start_seconds, "Timeline beat must have positive duration");
    assert(beat.end_seconds <= duration + 1e-7, "Timeline extends past duration");
    end = beat.end_seconds;
  }
  assert(equal(end, duration), "Timeline does not cover full duration");
}

export function validateCreativeOutput(kind, output, { selectedText, expectedCount, expectedDuration } = {}) {
  const validate = validators[kind];
  assert(validate, `Unknown creative output kind: ${kind}`);
  assert(validate(output), `${kind}: ${ajv.errorsText(validate.errors)}`);
  if (expectedCount !== undefined) {
    const actual = kind === "hook" ? output.hooks?.length : kind === "slideshow" ? output.slides?.length : undefined;
    assert.equal(actual, expectedCount, "Requested output count changed");
  }
  if (kind === "director" || kind === "wallVideo") {
    const duration = kind === "director" ? output.duration_seconds : output.duration_plan.duration_seconds;
    if (expectedDuration !== undefined) assert.equal(duration, expectedDuration, "Requested duration changed");
    if (kind === "director" || output.status === "ready") validateTimeline(output.motion_timeline, duration);
    if (kind === "wallVideo" && output.overlay_render_spec !== null) {
      assert.equal(output.overlay_render_spec.end_seconds, duration, "Overlay must persist to the end");
    }
    if (selectedText !== undefined) {
      const actual = kind === "director" ? output.overlay_text : output.overlay_render_spec?.exact_text;
      assert.equal(actual, selectedText, "Selected overlay text changed or is absent");
    }
  } else if (kind === "wallCopy" && selectedText !== undefined) {
    assert.equal(output.overlay_text, selectedText, "Protected copy changed");
  }
  return { status: "passed", kind };
}
