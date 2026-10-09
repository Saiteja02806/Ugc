import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readSavedFinish, finishStorageKey, parseFinishStatus, requestFinish } from "../lib/explore/workflow-finishing-client.ts";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage } from "../lib/explore/workflow-schedule-client.ts";
import { readAudioSubmission, audioSubmissionStorageKey, audioSubmissionResolved } from "../lib/audio/submission-client.ts";

const draft = { version: 1, kind: "hook", sourceAssetId: randomUUID(), demoAssetId: randomUUID(), demoAudioAssetId: randomUUID(), demoAudioPlayback: "repeat", backgroundAssetId: null, backgroundPlayback: "once", subtitles: { language: "en", style: "clean", placement: "bottom" } };
const saved = { version: 1, ownerId: "owner-a", kind: "hook", requestKey: randomUUID(), draft };
const receipt = (outcome = "pending") => ({ ok: true, receiptVersion: 1, requestKey: saved.requestKey, outcome, mediaAssetId: outcome === "completed" ? randomUUID() : null, message: "Saved." });
const json = value => JSON.stringify(value);

test("finishing recovery records retain every edit and are isolated by account/workflow", () => {
  assert.deepEqual(readSavedFinish(json(saved), "owner-a", "hook"), saved);
  assert.notEqual(finishStorageKey("owner-a", "hook"), finishStorageKey("owner-b", "hook"));
  assert.notEqual(finishStorageKey("owner-a", "hook"), finishStorageKey("owner-a", "phone"));
  assert.equal(readSavedFinish(null, "owner-a", "hook"), null);
  for (const raw of ["null", "[]", "broken", "x".repeat(16385), json({ ...saved, ownerId: "other" }), json({ ...saved, kind: "phone" }), json({ ...saved, requestKey: "bad" }), json({ ...saved, draft: { ...draft, demoAssetId: null } }), json({ ...saved, draft: { ...draft, url: "https://untrusted.test/video.mp4" } })]) assert.throws(() => readSavedFinish(raw, "owner-a", "hook"));
});

test("only a versioned exact-key finishing receipt can expose a completed output", () => {
  for (const outcome of ["pending", "completed", "failed", "cancelled", "uncertain", "unconfirmed"]) assert.equal(parseFinishStatus(receipt(outcome), saved.requestKey).outcome, outcome);
  for (const bad of [null, {}, { ...receipt(), ok: false }, { ...receipt(), receiptVersion: 2 }, { ...receipt(), requestKey: randomUUID() }, { ...receipt(), outcome: "invented" }, { ...receipt("completed"), mediaAssetId: null }, { ...receipt(), mediaAssetId: "blob:local" }]) assert.throws(() => parseFinishStatus(bad, saved.requestKey));
});

test("finishing hydration only reads; an explicit retry uses the original draft/key", async () => {
  const calls = [];
  const deps = { token: async () => "owner-token", assertActive() {}, fetch: async (url, init) => { calls.push({ url, ...init }); return Response.json(receipt()); } };
  await requestFinish(deps, saved);
  assert.equal(calls[0].method, "GET"); assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].headers.Authorization, "Bearer owner-token"); assert.equal(calls[0].cache, "no-store");
  const lost = { ...deps, fetch: async (url, init) => { calls.push({ url, ...init }); throw new Error("lost response"); } };
  await assert.rejects(requestFinish(lost, saved, true), /lost response/);
  await requestFinish(deps, saved, true);
  assert.equal(calls[1].body, calls[2].body); assert.equal(calls[1].headers["Idempotency-Key"], calls[2].headers["Idempotency-Key"]);
  assert.deepEqual(JSON.parse(calls[2].body), { requestKey: saved.requestKey, draft });
});

test("finishing never submits when signed out or if the account changes while reading the token", async () => {
  let submitted = false, active = true;
  const deps = { token: async () => null, fetch: async () => { submitted = true; }, assertActive() { if (!active) throw new Error("account changed"); } };
  await assert.rejects(requestFinish(deps, saved, true), /Sign in/);
  await assert.rejects(requestFinish({ ...deps, token: async () => { active = false; return "old-token"; } }, saved, true), /account changed/);
  assert.equal(submitted, false);
});

const schedule = { version: 1, owner: "owner-a", kind: "hook", input: { source: { kind: "media_asset", id: randomUUID() }, targets: [{ connectionId: randomUUID(), platform: "instagram" }], scheduledFor: "2026-10-06T10:00:00.000Z", timezone: "Asia/Calcutta", caption: "My post", idempotencyKey: `explore:${randomUUID()}` } };
const scheduleResponse = () => ({ ok: true, schedule: { id: randomUUID(), mediaAssetId: schedule.input.source.id, idempotencyKey: schedule.input.idempotencyKey, status: "scheduled", targets: [{ socialConnectionId: schedule.input.targets[0].connectionId, platform: "instagram" }] } });
test("schedule recovery retains the selected finished video, account, caption, time and original identity", () => {
  assert.deepEqual(readScheduleReceipt(json(schedule), "owner-a", "hook"), schedule);
  for (const value of [null, [], {}, { ...schedule, owner: "other" }, { ...schedule, kind: "phone" }, { ...schedule, input: { ...schedule.input, targets: [] } }, { ...schedule, input: { ...schedule.input, source: { kind: "hook_video", id: randomUUID() } } }, { ...schedule, input: { ...schedule.input, idempotencyKey: "explore:bad" } }, { ...schedule, input: { ...schedule.input, scheduledFor: "bad" } }]) assert.throws(() => readScheduleReceipt(json(value), "owner-a", "hook"));
});
test("a success message requires the exact server schedule, finished output and single connected account", () => {
  const response = scheduleResponse();
  assert.equal(verifySavedSchedule(response, schedule).id, response.schedule.id);
  assert.match(scheduleReceiptMessage(response.schedule), /is scheduled/);
  assert.doesNotMatch(scheduleReceiptMessage({ ...response.schedule, status: "scheduling" }), /is scheduled/);
  assert.match(scheduleReceiptMessage({ ...response.schedule, status: "failed" }), /needs review/);
  for (const change of [{ mediaAssetId: randomUUID() }, { idempotencyKey: `explore:${randomUUID()}` }, { status: "made_up" }, { targets: [] }, { targets: [{ socialConnectionId: randomUUID(), platform: "instagram" }] }, { targets: [...response.schedule.targets, ...response.schedule.targets] }]) assert.throws(() => verifySavedSchedule({ ...response, schedule: { ...response.schedule, ...change } }, schedule));
  assert.throws(() => verifySavedSchedule(response, { ...schedule, scheduleId: randomUUID() }));
});

test("Audio retains the complete original submission across reload and does not clear an uncertain paid call", () => {
  const entry = { version: 1, owner: "owner-a", key: randomUUID(), payload: { script: "Hello from my app", voiceId: "my-voice", modelId: "eleven_flash_v2_5", speed: 1, name: "My voiceover" } };
  assert.deepEqual(readAudioSubmission(json(entry), "owner-a"), entry);
  assert.notEqual(audioSubmissionStorageKey("owner-a"), audioSubmissionStorageKey("owner-b"));
  for (const value of [null, {}, { ...entry, owner: "other" }, { ...entry, key: "bad" }, { ...entry, payload: { ...entry.payload, speed: 5 } }, { ...entry, payload: { ...entry.payload, script: "" } }]) assert.throws(() => readAudioSubmission(json(value), "owner-a"));
  for (const status of ["queued", "processing", "uncertain", "pending", "cancel_requested"]) assert.equal(audioSubmissionResolved(status), false);
  for (const status of ["completed", "failed", "cancelled"]) assert.equal(audioSubmissionResolved(status), true);
});
