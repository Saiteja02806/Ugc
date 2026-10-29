import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual workspace mapper, rather than a copy of its status logic.
const source = readFileSync(new URL("../../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "getDraftStatusFromScheduledPost",
  "getString",
  "hasPlannedFinalScheduleMetadata",
  "getTargetStatusHelpText",
  "getAccountTodayDateKey",
  "getOtherScheduleDateSummaries",
  "getNearestScheduleDateForDrafts",
  "getSettingsPublishingHref",
  "parseDateKey",
  "toDateKey",
]);
const functions = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(parsed)).join("\n");
assert.equal(parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).length, names.size);
const context = vm.createContext({
  Date,
  Map,
  Math,
  Number,
  Set,
  String,
  formatShortDateTime: value => value,
  getZonedDateTimeParts: (now, timezone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(typeof now === "number" ? new Date(now) : now);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return { date: `${map.year}-${map.month}-${map.day}`, time: "12:00" };
  },
});
vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test("cancellation wins over stale Wall and combined render metadata", () => {
  for (const renderStatus of ["queued", "rendering", "not_requested", "failed", "ready"]) {
    for (const wall of [true, false]) {
      const metadata = wall
        ? {wallTextAssignmentId: "wall", wallTextRenderStatus: renderStatus, finalScheduleStatus: "failed"}
        : {combinedRenderStatus: renderStatus, finalScheduleStatus: "scheduling"};
      assert.equal(context.getDraftStatusFromScheduledPost({status: "cancelled", metadata}), "cancelled");
      assert.equal(context.getDraftStatusFromScheduledPost({status: "cancelled", metadata}, "demo"), "cancelled");
    }
  }
});

test("retry help distinguishes upcoming from overdue times and never promises a retry for failed posts", () => {
  assert.equal(context.getTargetStatusHelpText({ status: "publishing", nextRetryAt: "2099-10-17T05:46:00Z" }, "Asia/Calcutta"), "Retry scheduled for 2099-10-17T05:46:00Z.");
  assert.equal(context.getTargetStatusHelpText({ status: "publishing", nextRetryAt: "2000-10-17T05:46:00Z" }, "Asia/Calcutta"), "Retry pending since 2000-10-17T05:46:00Z.");
  assert.equal(context.getTargetStatusHelpText({ status: "failed", nextRetryAt: "2000-10-17T05:46:00Z" }, "Asia/Calcutta"), "Publishing did not complete for this account.");
  assert.equal(context.getTargetStatusHelpText({ status: "publishing", nextRetryAt: null }, "Asia/Calcutta"), "The worker is publishing this post now.");
});

test("published, partial, pending and failure outcomes keep their existing meaning", () => {
  for (const status of ["published", "partially_failed", "scheduled", "publishing", "failed", "draft"]) {
    assert.equal(context.getDraftStatusFromScheduledPost({status, metadata: {}}), status);
  }
  assert.equal(context.getDraftStatusFromScheduledPost({status:"draft", metadata:{combinedRenderStatus:"queued"}}), "rendering");
  assert.equal(context.getDraftStatusFromScheduledPost({status:"draft", metadata:{combinedRenderStatus:"failed"}}), "render_failed");
});

test("future calendar date selection disables postNow default while Today keeps postNow default", () => {
  assert.match(
    source,
    /initialUseDefaultScheduleTime=\{\s*editingSchedule === null &&\s*newScheduleInitialDate === accountTodayDateKey\s*\}/,
  );
});

test("List view items expose post actions and recover when posts exist on other dates", () => {
  assert.match(source, /function ScheduleDayListItem[\s\S]*<ScheduleTargetStatusList[\s\S]*<ScheduleDraftActions/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getOtherScheduleDateSummaries([
      { scheduledDate: "2026-10-28" },
      { scheduledDate: "2026-10-30" },
      { scheduledDate: "2026-10-30" },
      { scheduledDate: "2026-10-25" },
    ], "2026-10-28"))),
    [
      { count: 2, dateKey: "2026-10-30" },
      { count: 1, dateKey: "2026-10-25" },
    ],
  );
  assert.equal(
    context.getNearestScheduleDateForDrafts(
      [{ scheduledDate: "2026-10-20" }, { scheduledDate: "2026-10-30" }],
      "2026-10-28",
    ),
    "2026-10-30",
  );
});

test("platform settings hrefs route Instagram, TikTok, and YouTube to platform-specific anchors", () => {
  assert.equal(context.getSettingsPublishingHref("instagram"), "/settings#instagram-publishing");
  assert.equal(context.getSettingsPublishingHref("tiktok"), "/settings#tiktok-publishing");
  assert.equal(context.getSettingsPublishingHref("youtube"), "/settings#youtube-publishing");
  assert.equal(context.getSettingsPublishingHref(undefined), "/settings#instagram-publishing");
});

test("account-timezone Today resolves date in the account IANA timezone", () => {
  // 2026-10-29T01:30:00Z is Oct 29 in Asia/Tokyo (+09:00) and Oct 28 in America/Los_Angeles (-07:00)
  const sampleInstant = new Date("2026-10-29T01:30:00Z");
  assert.equal(context.getAccountTodayDateKey("Asia/Tokyo", sampleInstant), "2026-10-29");
  assert.equal(context.getAccountTodayDateKey("America/Los_Angeles", sampleInstant), "2026-10-28");
});

test("calendar pills, day list items, and day draft cards format scheduledTime with displayScheduleTime", () => {
  assert.match(source, /function ScheduleDayListItem[\s\S]*displayScheduleTime\(draft\.scheduledTime,\s*hour12\)/);
  assert.match(source, /function CalendarDraftPill[\s\S]*displayScheduleTime\(draft\.scheduledTime,\s*hour12\)/);
  assert.match(source, /function SelectedDayDraftCard[\s\S]*displayScheduleTime\(draft\.scheduledTime,\s*hour12\)/);
});
