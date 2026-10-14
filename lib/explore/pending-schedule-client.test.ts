import assert from "node:assert/strict";
import test from "node:test";
import { verifyExploreScheduleReply, type SavedExploreSchedule } from "./pending-schedule-client.ts";
import { getConfirmedScheduleTargetSettings, getDefaultScheduleTargetSettings, normalizeScheduleTargetSettings } from "../scheduling/platform-settings.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const settings = getConfirmedScheduleTargetSettings("tiktok", { ...getDefaultScheduleTargetSettings("tiktok"), privacyLevel: "PUBLIC_TO_EVERYONE" });
  const saved: SavedExploreSchedule = { version: 1, owner: "owner", signature: "test", confirmed: false,
    input: { version: 1, requestKey: id(1), draft: { version: 1, kind: "hook", sourceAssetId: id(6), demoAssetId: null, demoAudioAssetId: null,
      demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null },
      schedule: { caption: "Exact caption", title: "Talking head", timezone: "UTC", scheduledFor: "2030-10-14T12:00:00Z",
        targets: [{ connectionId: id(2), platform: "tiktok", settings }] } } };
  const target = { connectionId: id(2), platform: "tiktok", settings: normalizeScheduleTargetSettings("tiktok", settings) };
  const reply = { ok: true, version: 1, requestKey: id(1), preparation: { state: "preparing", message: "saved", jobId: id(5), mediaAssetId: null },
    schedule: { id: id(3), caption: "Exact caption", title: "Talking head", timezone: "UTC", scheduledFor: saved.input.schedule.scheduledFor,
      metadata: { exploreFinishRequestKey: id(1), exploreFinishFingerprint: "a".repeat(64), exploreFinishOutputAssetId: id(4),
        plannedScheduledFor: saved.input.schedule.scheduledFor, plannedTargetsJson: JSON.stringify([target]) } } };
  return { saved, reply, target };
}
test("background TikTok confirmation verifies the canonical provider settings without the UI disclosure switch", () => {
  const { saved, reply, target } = fixture();
  assert.equal(saved.input.schedule.targets![0].settings!.commercialContentDisclosureEnabled, true);
  assert.equal(target.settings.commercialContentDisclosureEnabled, undefined);
  assert.equal(verifyExploreScheduleReply(reply, saved).preparation.state, "preparing");
});
test("canonical verification still rejects changed visibility, interactions, disclosures, destinations and timing", () => {
  for (const change of [
    { privacyLevel: "SELF_ONLY" }, { allowComment: true }, { allowDuet: true }, { allowStitch: true },
    { containsSyntheticMedia: false }, { brandOrganic: false }, { brandedContent: true }, { musicUsageConfirmed: false },
  ]) {
    const { saved, reply, target } = fixture();
    reply.schedule.metadata.plannedTargetsJson = JSON.stringify([{ ...target, settings: { ...target.settings, ...change } }]);
    assert.throws(() => verifyExploreScheduleReply(reply, saved));
  }
  for (const change of [
    (value: ReturnType<typeof fixture>) => { value.reply.schedule.caption = "Different"; },
    (value: ReturnType<typeof fixture>) => { value.reply.schedule.scheduledFor = "2030-10-14T13:00:00Z"; },
    (value: ReturnType<typeof fixture>) => { value.reply.schedule.metadata.plannedTargetsJson = JSON.stringify([{ ...value.target, connectionId: id(9) }]); },
  ]) { const value = fixture(); change(value); assert.throws(() => verifyExploreScheduleReply(value.reply, value.saved)); }
});
