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
    assert.match(text(tree), /Choose date and time/);
    assert.match(text(tree), /Your device’s time zone/);
  }
});

test("in-card Review forwards the existing guarded controller and Back returns to editing", () => {
  let reviewed = 0, refreshed = 0, returned = 0;
  const action = { busy: false, disabled: false, message: "Ready to review", error: "Connection lost", onAction() { reviewed++; }, refresh() { refreshed++; } };
  const tree = exported.TalkingHeadScheduleActions({ action, enabled: true, onBackToEdit() { returned++; } });
  const buttons = nodes(tree).filter(node => node.type === "button");
  const review = buttons.find(button => text(button) === "Review schedule");
  assert.equal(review.props.disabled, false);
  assert.equal(review.props.onClick, action.onAction);
  review.props.onClick(); assert.equal(reviewed, 1);
  buttons.find(button => text(button) === "Back to Edit").props.onClick(); assert.equal(returned, 1);
  buttons.find(button => text(button) === "Refresh status").props.onClick(); assert.equal(refreshed, 1);
  assert.match(text(nodes(tree).find(node => node.props?.role === "alert")), /Connection lost/);
});

test("Schedule offers explicit preparation without calling either controller during render", () => {
  let prepared = 0, scheduled = 0;
  const action = { busy: false, disabled: true, message: "Wait for the saved final file", error: null, onAction() { scheduled++; }, refresh() {} };
  const preparation = { busy: false, disabled: false, message: "Prepare your publishing file while keeping these settings.", error: null, onAction() { prepared++; }, refresh() {} };
  const tree = exported.TalkingHeadScheduleActions({ action, preparation, enabled: true, onBackToEdit() {} });
  assert.equal(prepared, 0, "Mounting the Schedule controls must not submit a render");
  assert.equal(scheduled, 0, "Mounting the Schedule controls must not publish");
  const button = nodes(tree).find(node => node.type === "button" && text(node) === "Prepare final video");
  assert.equal(button.props.disabled, false);
  assert.equal(button.props.onClick, preparation.onAction);
  button.props.onClick();
  assert.equal(prepared, 1);
  assert.equal(scheduled, 0);
  assert.match(text(tree), /Prepare your publishing file/);
  assert.equal(nodes(tree).some(node => node.type === "button" && text(node) === "Review schedule"), false);
});

test("preparation retains disabled, busy and pending guards and exposes its existing recovery actions", () => {
  const action = { disabled: true, busy: false, error: null, message: "Wait for the file" };
  for (const props of [
    { enabled: false, preparation: { busy: false, disabled: false } },
    { enabled: true, preparation: { busy: false, disabled: true } },
    { enabled: true, preparation: { busy: true, disabled: false } },
  ]) {
    const tree = exported.TalkingHeadScheduleActions({ action, ...props, onBackToEdit() {} });
    const button = nodes(tree).find(node => node.type === "button" && ["Prepare final video", "Preparing video…"].includes(text(node)));
    assert.equal(button.props.disabled, true);
    if (!props.enabled) assert.match(text(tree), /Preview · scheduling disabled/);
  }
  let refreshed = 0, cancelled = 0;
  const preparation = { busy: false, disabled: true, error: null, message: "Waiting for the video processor", refresh() { refreshed++; }, cancel() { cancelled++; } };
  const tree = exported.TalkingHeadScheduleActions({ action, preparation, enabled: true, onBackToEdit() {} });
  const buttons = nodes(tree).filter(node => node.type === "button");
  const prepare = buttons.find(button => text(button) === "Preparing video…");
  assert.equal(prepare.props.disabled, true);
  assert.equal(prepare.props["aria-busy"], true);
  assert.match(text(tree), /Waiting for the video processor/);
  buttons.find(button => text(button) === "Refresh status").props.onClick();
  buttons.find(button => text(button) === "Cancel preparation").props.onClick();
  assert.equal(refreshed, 1);
  assert.equal(cancelled, 1);
});

test("failed preparation displays the error and forwards explicit retry, while saved-request resume keeps scheduling", () => {
  const preparation = { busy: false, disabled: false, message: "Finishing failed", error: "The selected demo could not load", onAction() {}, refresh() {} };
  const blockedSchedule = { busy: false, disabled: true, message: "Wait for the file", error: null, onAction() {}, refresh() {} };
  const failed = exported.TalkingHeadScheduleActions({ action: blockedSchedule, preparation, enabled: true, onBackToEdit() {} });
  assert.equal(nodes(failed).find(node => node.type === "button" && text(node) === "Retry final video").props.onClick, preparation.onAction);
  assert.match(text(nodes(failed).find(node => node.props?.role === "alert")), /selected demo could not load/);
  const resumable = { ...blockedSchedule, disabled: false, message: "Resume the saved scheduling request" };
  const resumed = exported.TalkingHeadScheduleActions({ action: resumable, preparation, enabled: true, onBackToEdit() {} });
  assert.equal(nodes(resumed).find(node => node.type === "button" && text(node) === "Review schedule").props.onClick, resumable.onAction);
  assert.equal(nodes(resumed).some(node => node.type === "button" && text(node) === "Retry final video"), false);
  const sending = { ...resumable, disabled: true, busy: true };
  const busyResume = exported.TalkingHeadScheduleActions({ action: sending, preparation, enabled: true, onBackToEdit() {} });
  const checking = nodes(busyResume).find(node => node.type === "button" && text(node) === "Checking…");
  assert.equal(checking.props.onClick, sending.onAction);
  assert.equal(checking.props.disabled, true, "A saved schedule submission cannot expose a concurrent preparation action");
  const blockedReceipt = { ...blockedSchedule, error: "The saved schedule needs review" };
  const recovering = exported.TalkingHeadScheduleActions({ action: blockedReceipt, preparation: { ...preparation, error: null }, enabled: true, onBackToEdit() {} });
  assert.equal(nodes(recovering).find(node => node.type === "button" && text(node) === "Refresh status").props.onClick, blockedReceipt.refresh, "Scheduling recovery errors retain their own refresh controller");
});

test("local preview, controller guards and busy requests retain disabled Review behavior", () => {
  for (const props of [
    { enabled: false },
    { enabled: true },
    { enabled: true, action: { disabled: true, busy: false, message: "Wait for the final file" } },
    { enabled: true, action: { disabled: false, busy: true, message: "Checking" } },
  ]) {
    const tree = exported.TalkingHeadScheduleActions({ ...props, onBackToEdit() {} });
    const review = nodes(tree).find(node => node.type === "button" && ["Review schedule", "Checking…"].includes(text(node)));
    assert.equal(review.props.disabled, true);
    if (!props.enabled) assert.match(text(tree), /Preview · scheduling disabled/);
    if (props.action?.busy) assert.equal(nodes(tree).find(node => text(node) === "Back to Edit").props.disabled, true);
  }
});
