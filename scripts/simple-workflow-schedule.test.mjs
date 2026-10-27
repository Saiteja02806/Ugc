import assert from "node:assert/strict";
import test from "node:test";
import { prepareSimpleWorkflowSchedule } from "../lib/explore/simple-workflow-schedule.ts";

const account = (platform, overrides = {}) => ({ id: `account-${platform}`, platform, status: "connected", platformAccountName: null, platformAccountUsername: null, supportsBackgroundRefresh: true,
  scopes: [platform === "instagram" ? "instagram_business_content_publish" : platform === "youtube" ? "https://www.googleapis.com/auth/youtube.upload" : "video.publish"], ...overrides });
const defaults = { containsSyntheticMedia: false, youtubePrivacyStatus: "unlisted", youtubeMadeForKids: true, youtubeNotifySubscribers: true, tiktokPrivacyLevel: "SELF_ONLY", tiktokAllowComments: true };
function fixture(platforms = ["instagram"], options = {}) {
  const calls = [], accounts = platforms.map(platform => account(platform, options.account));
  const draft = { platform: platforms[0], platforms, connectionIds: Object.fromEntries(accounts.map(value => [value.platform, value.id])), caption: "Exact caption", date: "2099-12-01", time: "16:30", ...options.draft };
  const load = async url => {
    calls.push(url);
    if (url === "/api/schedules?configOnly=1") return { ok: true, minimumScheduleLeadMinutes: options.lead ?? 5 };
    if (url === "/api/social/connections") return { ok: true, connections: options.accounts ?? accounts };
    if (url === "/api/account/publishing-preferences?schema=3") return { ok: true, preferences: { ...defaults, ...options.preferences } };
    return { ok: true, capabilities: { privacyLevels: ["SELF_ONLY"], directPostAudited: false, ...options.capabilities } };
  };
  return { calls, prepare: () => prepareSimpleWorkflowSchedule({ draft, timezone: "Asia/Calcutta", source: { kind: "media_asset", id: "owned-video" }, title: "Finished video", load }) };
}

test("simple scheduling keeps exact account choices, caption and zoned date/time", async () => {
  const h = fixture(), result = await h.prepare();
  assert.equal(result.scheduledFor, "2099-12-01T11:00:00.000Z");
  assert.equal(result.caption, "Exact caption"); assert.equal(result.clipSelection, "secondary_only");
  assert.deepEqual(result.targets, [{ platform: "instagram", connectionId: "account-instagram", settings: { shareToFeed: true } }]);
  assert.equal(result.openingMedia, null); assert.equal(result.useOpeningClip, false);
  assert.deepEqual(h.calls.sort(), ["/api/schedules?configOnly=1", "/api/social/connections"].sort());
});

test("the simple three-platform form applies saved publishing defaults without changing visibility", async () => {
  const result = await fixture(["instagram", "tiktok", "youtube"]).prepare();
  const tiktok = result.targets.find(value => value.platform === "tiktok").settings;
  assert.equal(tiktok.privacyLevel, "SELF_ONLY"); assert.equal(tiktok.allowComment, true);
  assert.equal(tiktok.containsSyntheticMedia, false); assert.equal(tiktok.musicUsageConfirmed, true);
  assert.deepEqual(result.targets.find(value => value.platform === "youtube").settings, { containsSyntheticMedia: false, madeForKids: true, notifySubscribers: true, privacyStatus: "unlisted" });
});

test("TikTok rejects an unavailable saved visibility rather than silently changing it", async () => {
  await assert.rejects(fixture(["tiktok"], { preferences: { tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE" } }).prepare(), /visibility available/);
  await assert.rejects(fixture(["tiktok"], { preferences: { tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE" }, capabilities: { privacyLevels: ["PUBLIC_TO_EVERYONE"] } }).prepare(), /Settings/);
});

test("Explore uses the saved promotional disclosure independently from AI disclosure, defaulting older preferences off", async () => {
  for (const value of [undefined, false, true]) {
    const result = await fixture(["tiktok"], { preferences: value === undefined ? {} : { tiktokBrandOrganic: value } }).prepare();
    const settings = result.targets[0].settings;
    assert.equal(settings.brandOrganic, value === true);
    assert.equal(settings.commercialContentDisclosureEnabled, value === true);
    assert.equal(settings.brandedContent, false);
    assert.equal(settings.containsSyntheticMedia, false);
  }
});

test("missing, expired, unpublishable and mismatched accounts are rejected", async () => {
  for (const options of [{ accounts: [] }, { account: { status: "expired" } }, { account: { scopes: [] } }, { account: { platform: "youtube" } }, { account: { platformAccountName: 123 } }]) {
    await assert.rejects(fixture(["instagram"], options).prepare());
  }
  await assert.rejects(fixture(["youtube"], { account: { supportsBackgroundRefresh: false } }).prepare(), /Reconnect YouTube/);
});

test("partial platform selections, oversized captions, past times and invalid configuration cannot submit", async () => {
  for (const options of [{ draft: { connectionIds: {} } }, { draft: { caption: "x".repeat(5001) } }, { draft: { date: "2001-01-01" } }, { draft: { time: "25:30" } }, { lead: -1 }, { lead: "5" }]) {
    await assert.rejects(fixture(["instagram"], options).prepare());
  }
});


test("automatic posting skips manual date/time but still enforces accounts and publishing defaults", async () => {
  const immediate={publishMode:"now",date:"",time:""};
  const result=await fixture(["instagram","tiktok","youtube"],{draft:immediate}).prepare();
  assert.equal(result.useDefaultScheduleTime,true);assert.equal(result.targets.length,3);
  assert.ok(Date.parse(result.scheduledFor)>Date.now());
  assert.equal(result.targets.find(target=>target.platform==="youtube").settings.privacyStatus,"unlisted");
  for (const account of [{status:"expired"},{scopes:[]}]) await assert.rejects(fixture(["instagram"],{draft:immediate,account}).prepare());
  await assert.rejects(fixture(["instagram"],{draft:immediate,accounts:[]}).prepare(),/unavailable/);
  await assert.rejects(fixture(["tiktok"],{draft:immediate,preferences:{tiktokPrivacyLevel:"PUBLIC_TO_EVERYONE"}}).prepare(),/visibility available/);
});

test("five-minute intent resolves when finally submitted, while exact manual times stay exact", async t => {
  let now = Date.parse("2026-10-26T12:00:30Z");
  t.mock.method(Date, "now", () => now);
  const selected = { publishMode: "scheduled", fiveMinutesFromSubmit: true, date: "2026-10-26", time: "17:36" };
  const h = fixture(["instagram"], { draft: selected });
  now += 20 * 60_000;
  const result = await h.prepare();
  assert.equal(result.useDefaultScheduleTime, true, "Server must calculate the accepted slot, including after transport delay");
  assert.equal(result.scheduledFor, "2026-10-26T12:26:00.000Z");
  assert.equal(result.caption, "Exact caption");
  assert.equal(result.targets[0].connectionId, "account-instagram");
  await assert.rejects(fixture(["instagram"], { draft: { ...selected, fiveMinutesFromSubmit: undefined } }).prepare(), /at least 5 minutes/);
  const manual = await fixture(["instagram"], { draft: { ...selected, fiveMinutesFromSubmit: undefined, time: "21:30" } }).prepare();
  assert.equal(manual.scheduledFor, "2026-10-26T16:00:00.000Z");
  assert.equal(manual.useDefaultScheduleTime, undefined);
  await assert.rejects(fixture(["instagram"], { draft: selected, accounts: [] }).prepare(), /unavailable/);
});
