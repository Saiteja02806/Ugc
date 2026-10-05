import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schedulingDraft from "../lib/explore/workflow-scheduling-draft.ts";

const read = (path) => readFileSync(new URL(`../components/explore/${path}`, import.meta.url), "utf8");
const panel = read("workflow-creation-panel.tsx");
const schedule = read("workflow-scheduling-panel.tsx");
const edit = read("workflow-composition-panel.tsx");
const workspace = read("workflow-edit-workspace.tsx");
const element = (type, props = {}) => typeof type === "function" ? type(props) : ({ type, props });
function load(source) {
  const imports = {
    react: { useId: () => "schedule-test" },
    "@base-ui/react/tabs": { Tabs: { List: "tablist", Tab: "tab" } },
    "lucide-react": { Sparkles: "sparkles", Check: "check" },
    "@/components/social/platform-icon": { SocialPlatformIcon: "platform-icon" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/input": { Input: "input" },
    "@/lib/social/platform-visibility": { isSocialPlatformVisible: (platform) => platform !== "tiktok" },
    "@/lib/explore/workflow-scheduling-draft": schedulingDraft,
    "@/components/generation/ai-studio-composer": { AiStudioSettingSelect: "select" },
    "@/components/explore/workflow-creation.module.css": { default: {} },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(source, { fileName: "sections.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  return exported;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ").replace(/\s+/g, " ").trim();
  if (!node || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return text(node.props?.children);
}
function visibleText(node) {
  if (Array.isArray(node)) return node.map(visibleText).join(" ").replace(/\s+/g, " ").trim();
  if (!node || typeof node !== "object") return text(node);
  if (node.props?.className?.split(" ").includes("sr-only")) return "";
  return visibleText(node.props?.children);
}

test("both workflows have three accessible, permanently mounted section panels", () => {
  for (const kind of ["hook", "phone"]) {
    const source = read(`${kind}-workflow-preview.tsx`);
    assert.match(source, /useState<WorkflowSection>\("create"\)/);
    assert.match(source, /<Tabs.Root[^>]*value=\{section\}/);
    for (const value of ["create", "edit", "schedule"]) assert.match(source, new RegExp(`<Tabs.Panel value="${value}" keepMounted`));
    const create = source.slice(source.indexOf('<Tabs.Panel value="create"'), source.indexOf('<Tabs.Panel value="edit"'));
    const editing = source.slice(source.indexOf('<Tabs.Panel value="edit"'), source.indexOf('<Tabs.Panel value="schedule"'));
    const scheduling = source.slice(source.indexOf('<Tabs.Panel value="schedule"'), source.indexOf("</WorkflowCreationPanel>"));
    assert.match(create, new RegExp(`<${kind === "hook" ? "Hook" : "Phone"}WorkflowComposer`));
    assert.doesNotMatch(create, /WorkflowCompositionPanel|WorkflowSchedulingPanel/);
    assert.match(editing, /<WorkflowCompositionPanel/);
    assert.doesNotMatch(editing, /WorkflowSchedulingPanel|WorkflowComposer/);
    assert.match(scheduling, /<WorkflowSchedulingPanel/);
    assert.match(source, /Object.values\(scheduleDraft\)\.some\(Boolean\)/);
    assert.match(source, /Your local changes are not saved/);
    assert.match(source, /section === "edit" \? <WorkflowEditWorkspace/);
    assert.match(source, /<WorkflowScheduleWorkspace draft=\{scheduleDraft\}/);
  }
});

test("each section shows only its own primary action and supports keyboard tab activation", () => {
  const { WorkflowCreationPanel } = load(panel);
  for (const section of ["create", "edit", "schedule"]) {
    const tree = WorkflowCreationPanel({ kind: "hook", section, children: "content" });
    const tabs = nodes(tree).filter((node) => node.type === "tab");
    assert.deepEqual(tabs.map((node) => [node.props.value, text(node)]), [["create", "Create"], ["edit", "Edited demo"], ["schedule", "Schedule"]]);
    assert.equal(nodes(tree).find((node) => node.type === "tablist").props.activateOnFocus, true);
    const actions = nodes(tree).filter((node) => node.type === "button");
    assert.equal(actions.length, 1);
    assert.equal(actions[0].props.disabled, true);
    assert.equal(tree.props["data-section"], section);
    assert.match(text(actions[0]), new RegExp(section === "create" ? "Generate video" : section === "edit" ? "Apply edits" : "Schedule post"));
  }
});

test("connected Apply edits and Schedule post forward real actions and render guarded progress/errors", () => {
  const { WorkflowCreationPanel } = load(panel);
  for (const kind of ["hook", "phone"]) for (const section of ["edit", "schedule"]) {
    let calls = 0, refreshes = 0;
    const action = { disabled: false, busy: false, message: "Ready to confirm.", error: "A response was lost.", onAction() { calls++; }, refresh() { refreshes++; } };
    const tree = WorkflowCreationPanel({ kind, section, [section]: action, children: "settings" });
    const buttons = nodes(tree).filter(n => n.type === "button");
    const primary = buttons.find(n => text(n) === (section === "edit" ? "Apply edits" : "Schedule post"));
    assert.equal(primary.props.disabled, false); primary.props.onClick(); assert.equal(calls, 1);
    assert.match(visibleText(tree), /Ready to confirm/); assert.match(text(nodes(tree).find(n => n.props.role === "alert")), /response was lost/);
    buttons.find(n => text(n) === "Refresh status").props.onClick(); assert.equal(refreshes, 1);
    const busy = WorkflowCreationPanel({ kind, section, [section]: { ...action, busy: true, disabled: true }, children: "settings" });
    assert.equal(nodes(busy).filter(n => n.type === "button").every(n => n.props.disabled), true);
  }
});

test("Schedule uses enabled named platform icons and forwards draft fields verbatim", () => {
  const { WorkflowSchedulingPanel } = load(schedule);
  const original = { platform: "", caption: "", date: "", time: "" };
  const changes = [];
  const tree = WorkflowSchedulingPanel({ draft: original, onChange: (draft) => changes.push(draft) });
  const platforms = nodes(tree).filter((node) => node.type === "button");
  assert.deepEqual(platforms.map((node) => [node.props["aria-label"], node.props["aria-pressed"]]), [["Instagram", false], ["YouTube", false]]);
  assert.equal(nodes(tree).find((node) => node.props.role === "group").props["aria-label"], "Posting platforms");
  assert.deepEqual(nodes(tree).filter((node) => node.type === "platform-icon").map((node) => node.props.platform), ["instagram", "youtube"]);
  platforms[0].props.onClick();
  nodes(tree).find((node) => node.type === "textarea").props.onChange({ target: { value: "  My caption\nunchanged  " } });
  nodes(tree).find((node) => node.props.type === "date").props.onChange({ target: { value: "2026-10-20" } });
  nodes(tree).find((node) => node.props.type === "time").props.onChange({ target: { value: "14:30" } });
  assert.deepEqual(changes.map((draft) => [draft.platform, draft.caption, draft.date, draft.time]), [["instagram", "", "", ""], ["", "  My caption\nunchanged  ", "", ""], ["", "", "2026-10-20", ""], ["", "", "", "14:30"]]);
  assert.equal(nodes(tree).filter((node) => node.type === "input").length, 2);
  assert.doesNotMatch(visibleText(tree), /Account|Select platform|device’s time zone|Local draft only|no post will be scheduled/);
  assert.match(text(tree), /not the video’s subtitles/);
  assert.equal(nodes(tree).find((node) => node.props.type === "date").props["aria-describedby"], "schedule-test-timezone");
  assert.equal(nodes(tree).find((node) => node.props.id === "schedule-test-timezone").props.className, "sr-only");
  assert.equal(original.caption, "");
  for (const platform of ["instagram", "youtube"]) {
    const selected = WorkflowSchedulingPanel({ draft: { ...original, platform }, onChange() {} });
    const pressed = nodes(selected).filter((node) => node.props["aria-pressed"] === true);
    assert.equal(pressed.length, 1);
    assert.equal(pressed[0].props["data-platform"], platform);
  }
});

test("Schedule footer stays clean without implying publishing is connected", () => {
  const { WorkflowCreationPanel } = load(panel);
  for (const kind of ["hook", "phone"]) {
    const tree = WorkflowCreationPanel({ kind, section: "schedule", children: "settings" });
    const footer = nodes(tree).find((node) => node.type === "footer");
    assert.equal(visibleText(footer), "Schedule post");
    const action = nodes(footer).find((node) => node.type === "button");
    assert.equal(action.props.disabled, true);
    assert.equal(action.props["aria-describedby"], `${kind}-preview-limits`);
    assert.match(action.props.title, /Scheduling is not connected/);
    assert.match(text(footer), /scheduling are not connected/);
  }
});

test("desktop panels share a stretching row and bottom actions without independent sticky height", () => {
  const styles = read("workflow-creation.module.css");
  const desktop = styles.slice(styles.indexOf("@media (min-width: 1024px) {"), styles.indexOf("@media (min-width: 1024px) and"));
  assert.match(desktop, /\.layout[^}]*align-items: stretch/);
  assert.match(desktop, /\.controls, \.main\s*\{\s*align-self: stretch/);
  assert.match(styles, /\.actionFooter[^}]*margin-top: auto/);
  assert.doesNotMatch(desktop, /position: sticky|position: fixed|overflow(?:-y)?:\s*(auto|scroll|hidden)/);
});

test("spare desktop Create space goes to the instructions field without stretching other inputs", () => {
  const form = read("workflow-creation-form.tsx");
  const styles = read("workflow-creation.module.css");
  const desktop = styles.slice(styles.indexOf("@media (min-width: 1024px) {"), styles.indexOf("@media (min-width: 1024px) and"));
  assert.match(form, /<div className=\{creation.instructionsField\}>/);
  assert.match(desktop, /\.controls\[data-section="create"\] \.controlContent/);
  assert.match(desktop, /\.controls\[data-section="create"\] \.sectionPanel:not\(\[hidden\]\):not\(\[data-ending-style\]\)/);
  assert.match(desktop, /\.controls\[data-section="create"\] \.instructionsField\s*\{ flex: 1/);
  assert.match(desktop, /\.instructionsField \.prompt\s*\{ flex: 1; height: auto; min-height: 72px/);
  assert.doesNotMatch(desktop, /\.scheduling \.prompt|ResizeObserver|overflow(?:-y)?:\s*(auto|scroll|hidden)/);
});

test("editing excludes scheduling and explains shared subtitle scope", () => {
  const creationCanvas = read("workflow-preview-canvas.tsx");
  assert.doesNotMatch(creationCanvas, /demo|schedule|subtitle/i);
  assert.match(creationCanvas, /Add your app screen and instructions in Create/);
  assert.doesNotMatch(edit, /Demo sound|<details|aria-label="Scheduling"|Schedule<\/Button>/);
  assert.match(edit, /Demo audio/);
  assert.match(edit, /Applies to spoken audio in the/);
  assert.match(edit, /Music-only sections have no speech captions/);
  assert.match(workspace, /demo.asset \? <><WorkflowMediaPlayer/);
  assert.match(workspace, /className=\{creation.demoPlayer\}/);
  assert.doesNotMatch(workspace, /autoPlay|\.mp4|setInstructions|onInstructionsChange/);
  assert.match(workspace, /draft.caption \|\|/);
});

test("the section implementation does not add requests, storage, prompts or affect Recreate", () => {
  for (const source of [panel, schedule, edit, workspace]) assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|use server|\.trigger\(|setInstructions|onInstructionsChange/);
  for (const path of ["recreate-workspace.tsx", "recreate-generation-panel.tsx"]) assert.doesNotMatch(read(path), /WorkflowSchedulingPanel|WorkflowEditWorkspace|WorkflowCreationPanel/);
  const styles = read("workflow-creation.module.css");
  assert.match(styles, /\.sectionPanel\[hidden\][^}]*display: none/);
  assert.match(styles, /prefers-reduced-motion: reduce[^}]*sectionPanel[^}]*animation: none/);
});

test("shared polish uses neutral disabled actions, visible focus and reduced-motion transitions", () => {
  const styles = read("workflow-creation.module.css");
  assert.match(styles, /\.primaryAction:disabled[^}]*background: var\(--card-muted\)[^}]*opacity: 1/);
  assert.match(styles, /\.controls :global\(button:focus-visible\)[^}]*outline: 2px solid var\(--focus\)/);
  assert.match(styles, /\.referenceButton\[data-state="selected"\][^}]*border-color: var\(--primary\)/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*\.referenceButton[^}]*transition: none/);
  assert.match(styles, /max-width: 1023px[^}]*height: 44px/);
  assert.doesNotMatch(panel, /disabled:opacity-75|Video rendering is not connected yet/);
  for (const source of [schedule, edit, read("workflow-creation-form.tsx")]) assert.match(source, /<h2 className="sr-only">/);
});
