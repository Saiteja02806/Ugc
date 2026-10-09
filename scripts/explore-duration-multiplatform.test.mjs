import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { customWorkflowDuration, workflowDurationPresets } from "../lib/explore/workflow-duration.ts";
import { selectWorkflowAccount, toggleWorkflowPlatform, workflowScheduleTargets, workflowSelectedPlatforms } from "../lib/explore/workflow-scheduling-draft.ts";
import { readScheduleReceipt, verifySavedSchedule } from "../lib/explore/workflow-schedule-client.ts";
import { getPostSignInDestination } from "../lib/billing/purchase-intent.ts";

test("duration presets stay compact and within each model's existing contract", () => {
  assert.deepEqual(workflowDurationPresets("seedance_2_5"), [5, 10, 15, 20, 30]);
  assert.deepEqual(workflowDurationPresets("kling_3_0"), [5, 10, 15]);
  assert.deepEqual(workflowDurationPresets("google_omni"), [5, 10]);
  for (const model of ["seedance_2_5", "kling_3_0", "google_omni"]) for (const raw of ["", "0", "-1", "5.5", "31", "NaN", "5e0", " 5 "]) assert.equal(customWorkflowDuration(model, raw), null);
  for (let seconds = 4; seconds <= 30; seconds++) assert.equal(customWorkflowDuration("seedance_2_5", String(seconds)), seconds);
  assert.equal(customWorkflowDuration("google_omni", "11"), null);
  assert.equal(customWorkflowDuration("kling_3_0", "11"), null);
  assert.equal(customWorkflowDuration("kling_3_0", "15"), 15);
});

test("selecting two platforms preserves account choices and requires one account for each", () => {
  const initial = { platform: "", caption: "Keep this caption", date: "2026-10-10", time: "10:00" };
  const instagram = randomUUID(), youtube = randomUUID();
  let draft = selectWorkflowAccount(toggleWorkflowPlatform(initial, "instagram"), "instagram", instagram);
  draft = toggleWorkflowPlatform(draft, "youtube");
  assert.deepEqual(workflowSelectedPlatforms(draft), ["instagram", "youtube"]);
  assert.deepEqual(workflowScheduleTargets(draft), []);
  draft = selectWorkflowAccount(draft, "youtube", youtube);
  assert.deepEqual(workflowScheduleTargets(draft), [{ platform: "instagram", connectionId: instagram }, { platform: "youtube", connectionId: youtube }]);
  assert.equal(draft.caption, initial.caption);
  const removed = toggleWorkflowPlatform(draft, "instagram");
  assert.deepEqual(workflowScheduleTargets(removed), [{ platform: "youtube", connectionId: youtube }]);
  assert.equal(removed.connectionIds.instagram, undefined);
  assert.equal(initial.platform, "");
});

test("multi-platform receipts recover both targets and reject partial, duplicate or substituted responses", () => {
  for (const kind of ["hook", "phone"]) {
    const targets = [{ connectionId: randomUUID(), platform: "instagram" }, { connectionId: randomUUID(), platform: "youtube" }];
    const saved = { version: 1, owner: "owner", kind, input: { source: { kind: "media_asset", id: randomUUID() }, targets, scheduledFor: "2026-10-10T10:00:00Z", timezone: "UTC", caption: "Mine", idempotencyKey: `explore:${randomUUID()}` } };
    assert.deepEqual(readScheduleReceipt(JSON.stringify(saved), "owner", kind), saved);
    const schedule = { id: randomUUID(), mediaAssetId: saved.input.source.id, idempotencyKey: saved.input.idempotencyKey, status: "scheduled", targets: targets.map(t => ({ socialConnectionId: t.connectionId, platform: t.platform })).reverse() };
    assert.equal(verifySavedSchedule({ ok: true, schedule }, saved), schedule);
    assert.throws(() => verifySavedSchedule({ ok: true, schedule: { ...schedule, targets: schedule.targets.slice(0, 1) } }, saved));
    assert.throws(() => verifySavedSchedule({ ok: true, schedule: { ...schedule, targets: [schedule.targets[0], schedule.targets[0]] } }, saved));
    assert.throws(() => readScheduleReceipt(JSON.stringify({ ...saved, input: { ...saved.input, targets: [targets[0], targets[0]] } }), "owner", kind));
    assert.throws(() => readScheduleReceipt(JSON.stringify(saved), "other", kind));
  }
});

test("landing Explore destination is allowlisted and does not override paid checkout intent", () => {
  assert.equal(getPostSignInDestination(new URLSearchParams("next=explore")), "/explore");
  assert.equal(getPostSignInDestination(new URLSearchParams("next=https://example.com")), "/dashboard");
  assert.equal(getPostSignInDestination(new URLSearchParams("plan=starter&next=explore")), "/pricing?checkout=continue&plan=starter");
  const landing = readFileSync(new URL("../components/marketing/landing-auth-actions.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(landing, /\/dashboard/);
  assert.match(landing, /\/sign-in\?next=explore/);
});

test("all authenticated users can browse references while paid generation policy stays intact", () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const workspace = read("components/explore/recreate-workspace.tsx");
  assert.match(workspace, /filtered\.map\(\(reference\)/);
  assert.match(workspace, /export function ProReferenceGate/);
  assert.match(read("app/api/explore/recreate-references/route.ts"), /await requireFirebaseUser\(request\)/);
  for (const file of ["components/workspace/ugc-chat-workspace.tsx", "components/video/video-generation-workspace.tsx"]) assert.match(read(file), /accessState !== "pro"/);
});
