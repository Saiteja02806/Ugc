import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { freeVideoPassShowsRemainingGeneration } from "./free-video-pass-badge.ts";

test("the invite badge stays up while the free generation is still unused", () => {
  assert.equal(
    freeVideoPassShowsRemainingGeneration({ status: "available", available: true }, false),
    true,
  );
  assert.equal(
    freeVideoPassShowsRemainingGeneration({ status: "reserved", available: false }, false),
    true,
  );
  assert.equal(
    freeVideoPassShowsRemainingGeneration({ status: "used", available: false }, false),
    false,
  );
  assert.equal(
    freeVideoPassShowsRemainingGeneration({ status: "available", available: true }, true),
    false,
  );
  assert.equal(freeVideoPassShowsRemainingGeneration(null, false), false);
});

test("Explore does not hide the invite badge after one empty check", () => {
  const badge = readFileSync(
    new URL("../../components/explore/explore-free-video-pass-badge.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../../app/api/billing/subscription/route.ts", import.meta.url),
    "utf8",
  );
  const hook = readFileSync(
    new URL("../../components/billing/use-billing-subscription.ts", import.meta.url),
    "utf8",
  );
  assert.equal(badge.includes("sessionStorage"), false);
  assert.equal(badge.includes("freeVideoPassShowsRemainingGeneration"), true);
  assert.equal(route.includes("freeVideoPassShowsRemainingGeneration"), true);
  assert.equal(hook.includes("freeVideoPassShowsRemainingGeneration"), true);
  assert.equal(route.includes("request.headers.get(\"cookie\")"), false);
});
