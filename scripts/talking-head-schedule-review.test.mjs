import * as timeDisplay from "../lib/scheduling/time-display.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schedulingDraft from "../lib/explore/workflow-scheduling-draft.ts";

const source = readFileSync(new URL("../components/explore/talking-head-schedule-review.tsx", import.meta.url), "utf8");
const element = (type, props) => ({ type, props });
const nodes = value => value == null ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const text = value => value == null || typeof value === "boolean" ? "" : Array.isArray(value) ? value.map(text).join("") : typeof value === "object" ? text(value.props?.children) : String(value);
const styles = new Proxy({}, { get: (_, name) => name });
const exported = {};
const imports = {
    "@/components/scheduling/use-device-time-format": { useDeviceTimeFormat: () => false },
    "@/lib/scheduling/time-display": timeDisplay,
  "react": { useEffect() {}, useRef: initial => ({ current: initial }), useState: initial => [initial, () => {}] },
  "react/jsx-runtime": { jsx: element, jsxs: element },
  "lucide-react": { ArrowLeft: "arrow-left", ArrowRight: "arrow-right" },
  "@/components/ui/button": { Button: "button" },
  "@/lib/explore/workflow-scheduling-draft": schedulingDraft,
  "@/components/explore/workflow-schedule-review.module.css": { default: styles, __esModule: true },
};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
  exports: exported, require(name) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
});

test("schedule summary describes the current platforms, selected accounts and exact date without changing its draft", () => {
  const draft = { platform: "instagram", caption: "Keep my caption", date: "2026-10-13", time: "16:30", platforms: ["instagram", "youtube"], connectionIds: { instagram: "instagram-account", youtube: "youtube-account" } };
  const before = JSON.stringify(draft);
  const tree = exported.TalkingHeadScheduleSummary({ draft, timezone: "Asia/Calcutta" });
  assert.equal(tree.props["aria-label"], "Schedule summary");
  assert.match(text(tree), /Instagram Reels \+ YouTube/);
  assert.match(text(tree), /2 accounts selected/);
  assert.match(text(tree), /13 Oct 2026, 16:30/);
  assert.match(text(tree), /Asia\/Calcutta/);
  assert.equal(JSON.stringify(draft), before);
  const missingAccount = exported.TalkingHeadScheduleSummary({ draft: { ...draft, connectionIds: { instagram: "instagram-account" } } });
  assert.match(text(missingAccount), /Choose an account for each platform/);
});

test("invalid or unfinished schedule details produce guidance instead of a misleading completed summary", () => {
  for (const [date, time] of [["", ""], ["2026-02-31", "16:30"], ["2026-10-13", "25:30"]]) {
    const tree = exported.TalkingHeadScheduleSummary({ draft: { platform: "", caption: "", date, time } });
    assert.match(text(tree), /Choose where to publish/);
    assert.match(text(tree), !date && !time ? /Earliest available/ : /Choose date and time/);
    assert.match(text(tree), /Your device’s time zone/);
  }
});

test("the Schedule action always schedules and never swaps to preparation", () => {
  let scheduled = 0, returned = 0;
  const action = { busy: false, disabled: false, message: "Choose your accounts and time, then click Schedule post.", error: null, onAction() { scheduled++; }, refresh() {} };
  const tree = exported.TalkingHeadScheduleActions({ action, enabled: true, onBackToEdit() { returned++; } });
  const buttons = nodes(tree).filter(node => node.type === "button");
  assert.equal(buttons.some(button => text(button) === "Prepare final video"), false, "Schedule no longer offers a preparation action");
  const schedule = buttons.find(button => text(button) === "Schedule post");
  assert.equal(schedule.props.disabled, false);
  schedule.props.onClick(); assert.equal(scheduled, 1);
  buttons.find(button => text(button) === "Back to Edit").props.onClick(); assert.equal(returned, 1);
  assert.match(text(tree), /Choose your accounts and time/);
  const helped = exported.TalkingHeadScheduleActions({ action, enabled: true, help: "Choose Schedule video in Demo to prepare your video.", onBackToEdit() {} });
  assert.match(text(helped), /Choose Schedule video in Demo/);
});

test("Post now prepares the video first when no finished output exists", () => {
  let prepared = 0, scheduled = 0;
  const action = { busy: false, disabled: true, label: "Post now", message: "Choose your accounts and time, then click Post now.", error: null, onAction() { scheduled++; }, refresh() {} };
  const preparation = { busy: false, disabled: false, message: "Apply edits", error: null, onAction() { prepared++; }, refresh() {} };
  const tree = exported.TalkingHeadScheduleActions({ action, preparation, outputReady: false, enabled: true, help: "Choose your accounts and time, then click Post now.", onBackToEdit() {} });
  const button = nodes(tree).find(node => node.type === "button" && text(node) === "Post now");
  assert.equal(button.props.disabled, false, "Post now is available without a finished output");
  button.props.onClick();
  assert.equal(prepared, 1);
  assert.equal(scheduled, 0);
});

test("Post now stays disabled with the missing-account reason before preparing", () => {
  const tree = exported.TalkingHeadScheduleActions({ action: { busy: false, disabled: true, label: "Post now", message: "Choose an account", error: null, onAction() {} }, preparation: { busy: false, disabled: false, onAction() {} }, outputReady: false, prepareDisabled: true, enabled: true, help: "Choose at least one connected account for Instagram, or deselect Instagram above.", onBackToEdit() {} });
  const button = nodes(tree).find(node => node.type === "button" && text(node) === "Post now");
  assert.equal(button.props.disabled, true);
  assert.match(text(tree), /Choose at least one connected account for Instagram/);
});

test("Schedule keeps disabled, busy and preview guards on the scheduling action", () => {
  for (const props of [
    { enabled: false },
    { enabled: true },
    { enabled: true, action: { disabled: true, busy: false, message: "Prepare your video in Demo first" } },
    { enabled: true, action: { disabled: false, busy: true, message: "Checking" } },
  ]) {
    const tree = exported.TalkingHeadScheduleActions({ ...props, onBackToEdit() {} });
    const review = nodes(tree).find(node => node.type === "button" && ["Schedule post", "Scheduling…"].includes(text(node)));
    assert.equal(review.props.disabled, true);
    if (!props.enabled) assert.match(text(tree), /Preview · scheduling disabled/);
    if (props.action?.busy) assert.equal(nodes(tree).find(node => text(node) === "Back to Edit").props.disabled, true);
  }
});

test("Schedule shows the scheduling error and keeps the saved-request resume label", () => {
  const failed = exported.TalkingHeadScheduleActions({ enabled: true, onBackToEdit() {}, action: { busy: false, disabled: true, message: "Wait for the file", error: "Could not verify the saved scheduling request.", onAction() {}, refresh() {} } });
  assert.match(text(nodes(failed).find(node => node.props?.role === "alert")), /Could not verify/);
  let resumedCalls = 0;
  const resumable = { busy: false, disabled: false, label: "Try again", message: "Scheduling was interrupted. Try again to finish scheduling your post.", error: null, onAction() { resumedCalls++; } };
  const resumed = exported.TalkingHeadScheduleActions({ action: resumable, enabled: true, onBackToEdit() {} });
  const resumeButton = nodes(resumed).find(node => node.type === "button" && text(node) === "Try again");
  resumeButton.props.onClick(); assert.equal(resumedCalls, 1);
  assert.doesNotMatch(text(resumed), /saved request|Confirm the same/);
  assert.equal(nodes(resumed).some(node => node.type === "button" && text(node) === "Prepare final video"), false);
});

test("a confirmed schedule shows the repeat action and Scheduling link with no recovery controls", () => {
  const tree = exported.TalkingHeadScheduleActions({ enabled: true, onBackToEdit() {},
    action: { busy: false, disabled: false, completed: true, label: "Schedule post", message: "Post scheduled", error: null, onAction() {}, refresh() {} } });
  assert.match(text(tree), /Post scheduled/);
  assert.ok(nodes(tree).find(node => node.type === "button" && text(node) === "Schedule post"));
  assert.equal(nodes(tree).find(node => node.type === "a" && text(node) === "View in Scheduling").props.href, "/scheduling");
  const confirmation = nodes(tree).find(node => node.props?.className?.includes("confirmation"));
  assert.ok(confirmation);
  assert.equal(nodes(confirmation).filter(node => node.type === "a").length, 1);
  assert.match(nodes(confirmation).find(node => node.type === "a").props.className, /compactSchedulingLink/);
  assert.equal(nodes(tree).filter(node => node.type === "a").length, 1);
  assert.match(text(confirmation), /Post scheduled.*View in Scheduling/);
  assert.doesNotMatch(text(tree), /Check saved|Confirm the same|Resume|Refresh status/);
});

test("unconfirmed, busy and failed Talking Head schedules never show a success link", () => {
  for (const action of [undefined, { busy: true, disabled: true, message: "Scheduling…" }, { busy: false, disabled: false, error: "Could not confirm", message: "Try again" }]) {
    const tree = exported.TalkingHeadScheduleActions({ enabled: true, action, onBackToEdit() {} });
    assert.equal(nodes(tree).some(node => node.type === "a"), false);
  }
});

test("schedule actions scroll with the form rather than covering timezone content", () => {
  const css = readFileSync(new URL("../components/explore/workflow-schedule-review.module.css", import.meta.url), "utf8");
  assert.match(css, /\.actions\s*\{[^}]*position:\s*static/);
  assert.doesNotMatch(css, /position:\s*(?:fixed|sticky)/);
  assert.match(css, /\.reviewButton\s*\{[^}]*white-space:\s*nowrap/);
});

test("schedule actions sit plainly in the workflow footer without a nested container", () => {
  const css = readFileSync(new URL("../components/explore/workflow-schedule-review.module.css", import.meta.url), "utf8");
  const block = css.match(/\.actions\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(block, "the actions layout rule exists");
  assert.doesNotMatch(block, /border(?:\s|:|-)|background|backdrop-filter|box-shadow|padding|margin/);
  assert.match(block, /display:\s*grid/);
  assert.match(block, /gap:\s*12px/);
});
