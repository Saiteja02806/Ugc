import assert from "node:assert/strict";
import test from "node:test";
import { createWorkflowSession, parseWorkflowSession, readWorkflowSession, serializeWorkflowSession, restoreWorkflowSessionAssets, workflowSessionStorageKey } from "./workflow-session.ts";

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const video = number => ({ id: id(number), title: `Video ${number}`, url: `https://media.test/${number}.mp4`, status: "ready", collection: "video", mimeType: "video/mp4", sourceType: "generated_video", fileSizeBytes: 1000, durationSeconds: 10, width: 1080, height: 1920 });
const audio = number => ({ ...video(number), collection: "audio", mimeType: "audio/mpeg", durationSeconds: 30 });
const session = () => ({ ...createWorkflowSession("owner-a"), section: "schedule", generatedAssetId: id(2), demoAssetId: id(3), demoAudioAssetId: id(4), demoAudioPlayback: "repeat", instructions: "My talking head instructions",
  options: { subtitles: true, style: "serif-box", backgroundMusic: true, placement: "top", corrections: [{ index: 0, text: "UGCPilot" }] },
  scheduleDraft: { platform: "instagram", caption: "Saved caption", date: "2099-12-01", time: "18:45", connectionId: id(5), timezone: "Asia/Calcutta" } });

test("whole-video music survives recovery independently of demo-only audio and rejects malformed choices", () => {
  const value = session(); value.options = { ...value.options, backgroundAssetId: id(6), backgroundPlayback: "repeat" };
  const restored = readWorkflowSession(serializeWorkflowSession(value), "owner-a");
  assert.equal(restored.options.backgroundAssetId, id(6)); assert.equal(restored.demoAudioAssetId, id(4));
  assert.equal(restored.options.backgroundPlayback, "repeat");
  assert.throws(() => parseWorkflowSession({ ...value, options: { ...value.options, backgroundAssetId: "not-owned-id" } }, "owner-a"));
  assert.throws(() => parseWorkflowSession({ ...value, options: { ...value.options, backgroundPlayback: "forever" } }, "owner-a"));
});

test("owner-scoped session preserves exact selected result, demo/audio, stage, unsent schedule and finishing options", () => {
  const expected = parseWorkflowSession(session(), "owner-a");
  const restored = readWorkflowSession(serializeWorkflowSession(expected), "owner-a");
  assert.deepEqual(restored, expected); assert.equal(restored.generatedAssetId, id(2)); assert.equal(restored.section, "schedule");
  assert.equal(restored.scheduleDraft.timezone, "Asia/Calcutta"); assert.equal(restored.options.corrections[0].text, "UGCPilot");
  assert.notEqual(workflowSessionStorageKey("owner-a"), workflowSessionStorageKey("owner-b"));
  assert.throws(() => readWorkflowSession(serializeWorkflowSession(expected), "owner-b"), /could not be verified/);
});

test("serialized session rejects unsafe identities and cannot retain tokens, files or blob previews", () => {
  for (const extra of [{ token: "secret" }, { demoUrl: "blob:demo" }, { sourceUrl: "https://untrusted.test" }, { file: { name: "demo.mp4" } }]) assert.throws(() => serializeWorkflowSession({ ...session(), ...extra }));
  for (const change of [{ generatedAssetId: "blob:video" }, { sourceAssetId: "not-owned-id" }, { kind: "phone" }, { options: { ...session().options, token: "secret" } }, { demoAssetId: null, demoAudioAssetId: id(4) }]) assert.throws(() => serializeWorkflowSession({ ...session(), ...change }));
  const saved = serializeWorkflowSession(session()); assert.doesNotMatch(saved, /https?:|blob:|token|file|media\.test/);
  assert.throws(() => readWorkflowSession("{" , "owner-a")); assert.throws(() => readWorkflowSession("x".repeat(600_000), "owner-a"));
});

test("restoration only reads exact owned assets and does not substitute result one", async () => {
  const reads = [];
  const restored = await restoreWorkflowSessionAssets(session(), async assetId => { reads.push(assetId); return assetId === id(4) ? audio(4) : video(Number(assetId.slice(-1))); });
  assert.deepEqual(reads.sort(), [id(2), id(3), id(4)]); assert.equal(restored.assets.source.id, id(2)); assert.deepEqual(restored.problems, {});
  const unavailable = await restoreWorkflowSessionAssets(session(), async assetId => { if (assetId === id(2)) throw new Error("Not owned"); return assetId === id(4) ? audio(4) : video(3); });
  assert.equal(unavailable.assets.source, null); assert.match(unavailable.problems.source, /unavailable/); assert.equal(unavailable.assets.demo.id, id(3));
});

test("uploaded source restores through owner read and shared IDs read once with role validation", async () => {
  const uploaded = { ...session(), sourceMode: "upload", sourceAssetId: id(1), generatedAssetId: id(2), demoAssetId: id(1), demoAudioAssetId: null };
  const reads = [];
  const restored = await restoreWorkflowSessionAssets(uploaded, async assetId => { reads.push(assetId); return video(1); });
  assert.deepEqual(reads, [id(1)]); assert.equal(restored.assets.source.id, id(1)); assert.equal(restored.assets.demo.id, id(1));
  const malformed = await restoreWorkflowSessionAssets(session(), async assetId => assetId === id(4) ? video(4) : { ...video(2), id: id(9) });
  assert.equal(malformed.assets.source, null); assert.equal(malformed.assets.demoAudio, null); assert.ok(malformed.problems.source && malformed.problems.demoAudio);
});

test("interrupted uploads remain explicit even when earlier accepted media can still load", async () => {
  const interrupted = { ...session(), pendingSource: true, pendingDemo: true, pendingDemoAudio: true };
  const restored = await restoreWorkflowSessionAssets(interrupted, async assetId => assetId === id(4) ? audio(4) : video(Number(assetId.slice(-1))));
  assert.equal(restored.assets.source.id, id(2));
  for (const role of ["source", "demo", "demoAudio"]) assert.match(restored.problems[role], /interrupted/);
});

test("owner/session changes cancel stale reads before returning recovered media", async () => {
  let current = true, complete;
  const restored = restoreWorkflowSessionAssets({ ...session(), demoAssetId: null, demoAudioAssetId: null }, () => new Promise(resolve => { complete = resolve; }), () => { if (!current) throw new Error("Account changed"); });
  current = false; complete(video(2)); await assert.rejects(restored, /Account changed/);
});
