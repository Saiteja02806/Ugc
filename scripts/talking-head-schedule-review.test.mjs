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

test("bottom Review forwards the existing guarded controller and Back returns to editing", () => {
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
