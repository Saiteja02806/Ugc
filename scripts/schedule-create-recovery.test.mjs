import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as scheduleTime from "../lib/scheduling/schedule-time.ts";
import * as settings from "../lib/scheduling/platform-settings.ts";
import * as requirement from "../lib/scheduling/schedule-target-requirement.ts";
import * as metadata from "../lib/scheduling/schedule-metadata.ts";
import * as errors from "../lib/scheduling/errors.ts";
import * as social from "../lib/social/types.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { source: { kind: "media_asset", id: id(1) }, targets: [{ connectionId: id(2), platform: "instagram" }],
  caption: "Exact saved post", timezone: "Asia/Calcutta", scheduledDate: "2026-10-14", scheduledTime: "04:10",
  scheduledFor: "2026-10-13T22:40:00.000Z", idempotencyKey: `explore:${id(3)}` };

function fixture(existing = null) {
  const calls = [];
  const imports = {
    "node:crypto": { createHash }, "@/lib/scheduling/schedule-time": scheduleTime,
    "@/lib/scheduling/platform-settings": settings, "@/lib/scheduling/errors": errors,
    "@/lib/scheduling/schedule-target-requirement": requirement, "@/lib/scheduling/schedule-metadata": metadata,
    "@/lib/social/types": social,
    "@/lib/scheduling/db": new Proxy({
      getScheduledPostByIdempotency: async args => { calls.push({ name: "lookup", ...args }); return existing; },
      getSchedulableMediaAsset: async () => { calls.push({ name: "source" }); throw new Error("Source resolution reached"); },
    }, { get(target, name) { return target[name] ?? (() => { calls.push({ name }); throw new Error(`Unexpected mutation: ${String(name)}`); }); } }),
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../lib/scheduling/service.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Error, console, process: { env: { SOCIAL_SCHEDULING_MIN_LEAD_MINUTES: "5" } }, require: name => imports[name] ?? {} });
  return { calls, create: value => exports.createUserSchedule({ userId: "owner-a", input: value }) };
}

test("accepted requests recover after their original time expires without creating another post", async t => {
  t.mock.method(Date, "now", () => Date.parse("2026-10-13T23:38:00Z"));
  for (const kind of ["media_asset", "library_item"]) {
    const existing = { id: id(4), status: "published" }, h = fixture(existing);
    const result = await h.create({ ...input, source: { ...input.source, kind } });
    assert.equal(result.created, false); assert.equal(result.schedule, existing);
    assert.deepEqual(h.calls, [{ name: "lookup", userId: "owner-a", idempotencyKey: input.idempotencyKey }]);
  }
});

test("a new request below five minutes still rejects before source resolution or mutations", async t => {
  t.mock.method(Date, "now", () => Date.parse("2026-10-13T22:38:00Z"));
  const h = fixture();
  await assert.rejects(h.create(input), error => error.code === "schedule_time_too_soon" && error.status === 409);
  assert.deepEqual(h.calls.map(call => call.name), ["lookup"]);
});

test("04:18 at 04:08 passes lead validation and proceeds to owned source resolution", async t => {
  t.mock.method(Date, "now", () => Date.parse("2026-10-13T22:38:00Z"));
  const h = fixture();
  await assert.rejects(h.create({ ...input, scheduledTime: "04:18", scheduledFor: "2026-10-13T22:48:00.000Z" }), /Source resolution reached/);
  assert.deepEqual(h.calls.map(call => call.name), ["lookup", "source"]);
});

test("recovery still validates the date, owner-bound source and required targets", async () => {
  for (const change of [{ scheduledDate: "2026-02-31" }, { scheduledDate: "", scheduledTime: "", scheduledFor: "" }, { source: { kind: "media_asset", id: "bad" } }, { targets: [] }]) {
    const h = fixture({ id: id(4), status: "published" });
    await assert.rejects(h.create({ ...input, ...change })); assert.equal(h.calls.length, 0);
  }
});
