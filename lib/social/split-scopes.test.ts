import assert from "node:assert/strict";
import test from "node:test";

import { splitScopes } from "./split-scopes.ts";

test("splits comma-separated scopes", () => {
  assert.deepEqual(
    splitScopes("instagram_basic,instagram_content_publish"),
    ["instagram_basic", "instagram_content_publish"],
  );
});

test("splits space-separated scopes", () => {
  assert.deepEqual(splitScopes("scope.one scope.two"), [
    "scope.one",
    "scope.two",
  ]);
});

test("accepts string arrays", () => {
  assert.deepEqual(
    splitScopes(["instagram_basic", "instagram_content_publish"]),
    ["instagram_basic", "instagram_content_publish"],
  );
});

test("removes duplicate scopes while preserving order", () => {
  assert.deepEqual(
    splitScopes(["instagram_basic,instagram_content_publish", "instagram_basic"]),
    ["instagram_basic", "instagram_content_publish"],
  );
});

test("returns an empty array for null", () => {
  assert.deepEqual(splitScopes(null), []);
});

test("returns an empty array for undefined", () => {
  assert.deepEqual(splitScopes(undefined), []);
});

test("returns an empty array for numbers", () => {
  assert.deepEqual(splitScopes(123), []);
});

test("returns an empty array for objects", () => {
  assert.deepEqual(splitScopes({ scope: "instagram_basic" }), []);
});
