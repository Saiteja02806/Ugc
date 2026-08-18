import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHookEndSeconds,
  getInstagramReelShortcode,
  normalizeHookEndSeconds,
  ViralHookTimingInputError,
} from "./hook-review.ts";

test("converts reviewer-entered seconds to integer milliseconds", () => {
  assert.equal(normalizeHookEndSeconds(5.27), 5_270);
  assert.equal(normalizeHookEndSeconds(2.4), 2_400);
  assert.equal(normalizeHookEndSeconds(6.13), 6_130);
  assert.equal(normalizeHookEndSeconds(0.001), 1);
});

test("rounds sub-millisecond precision deterministically", () => {
  assert.equal(normalizeHookEndSeconds(1.2344), 1_234);
  assert.equal(normalizeHookEndSeconds(1.2345), 1_235);
});

test("rejects unsafe hook ending values", () => {
  for (const value of [null, "5.27", Number.NaN, Infinity, 0, -1, 3_601]) {
    assert.throws(
      () => normalizeHookEndSeconds(value),
      ViralHookTimingInputError,
    );
  }
});

test("formats stored milliseconds for the review input", () => {
  assert.equal(formatHookEndSeconds(5_270), "5.27");
  assert.equal(formatHookEndSeconds(2_400), "2.4");
  assert.equal(formatHookEndSeconds(1_000), "1");
  assert.equal(formatHookEndSeconds(1), "0.001");
});

test("extracts a short, reviewer-friendly Reel identifier", () => {
  assert.equal(
    getInstagramReelShortcode("https://www.instagram.com/reel/DZYQrk7Rzkd/"),
    "DZYQrk7Rzkd",
  );
  assert.equal(getInstagramReelShortcode("not-a-url"), "Instagram Reel");
});
