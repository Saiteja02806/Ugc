import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNullableComposite } from "./nullable-composite.ts";

test("normalizes SQL NULL and the production PostgREST null-composite shape", () => {
  for (const result of [null, undefined, {
    id: null, feed_id: null, user_id: null, local_date: null,
    business_profile_id: null, business_profile_version: null,
    generation_batch_id: null, requested_count: null,
    replacement_sequence: null, superseded_at: null,
    superseded_by_batch_id: null, created_at: null, updated_at: null,
  }]) {
    assert.equal(normalizeNullableComposite(result), null);
  }
});

test("preserves real and malformed rows for the caller's ownership validation", () => {
  for (const result of [
    { id: "batch", user_id: "owner", superseded_at: null },
    { id: null, user_id: "wrong-owner" },
    { id: undefined },
    {},
  ]) {
    assert.equal(normalizeNullableComposite(result), result);
  }
});
