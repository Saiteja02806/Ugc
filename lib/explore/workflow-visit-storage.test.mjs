import assert from "node:assert/strict";
import test from "node:test";
import { workflowVisitStorage } from "./workflow-visit-storage.ts";

test("compatibility storage retains refresh work without treating elapsed time as intent", () => {
  const values = new Map([["draft", "legacy-yesterday"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let now = 1000;
  let visit = workflowVisitStorage(storage, () => now);
  assert.equal(visit.getItem("draft"), null);
  visit.setItem("draft", "current");
  visit = workflowVisitStorage(storage, () => now);
  assert.equal(visit.getItem("draft"), "current");
  now += 48 * 60 * 60 * 1000;
  assert.equal(visit.getItem("draft"), "current");
  assert.equal(values.get("draft"), "legacy-yesterday", "Durable history is not deleted");
  visit.setItem("draft", "new"); assert.equal(visit.getItem("draft"), "new");
  visit.removeItem("draft"); assert.equal(visit.getItem("draft"), null);
});
