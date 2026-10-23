import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../components/explore/format-workspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("format-workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["selectReference", "closeHookPreparation", "openHookPreparation", "useHookStartingFrame", "reuseHookStartingFrame"]);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(functions.length, names.size);
const code = ts.transpileModule(`${functions.join("\n")}\nexports.actions={${[...names].join(",")}}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const reference = { format: "hook", id: "hook-1", videoUrl: "https://example.test/original.mp4", title: "Hook" };
const draftId = "00000000-0000-4000-8000-000000000001";
function harness(overrides = {}) {
  const state = { pathname: "/explore/hook-video", search: "?refId=hook-1&hookFrameDraft=" + draftId + "&sourceUrl=old&refType=hook&exploreRecreate=1",
    reference, hookPreparation: { referenceId: reference.id, draftId }, startingFrame: null, focus: 0 };
  const exports = {};
  const context = { exports, URLSearchParams, generating: false, source: { busy: false, setMode: value => { state.mode = value; } },
    get startingFrameEnabled() { return this.hookStartingFramePreparationEnabled && this.format !== "slideshow"; },
    slideshowSaving: false, slideshowUploadBusy: false, selectedVideo: null, format: "hook", localPreview: false, hookStartingFramePreparationEnabled: true,
    reference, references: [reference, { ...reference, id: "hook-2" }], hookPreparation: state.hookPreparation, user: { uid: "owner" }, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000002" },
    get keyframeOwnerId() { return this.user?.uid ?? null; },
    isExploreUuid: value => /^[a-f0-9-]{36}$/i.test(value ?? ""),
    slideshowEditor: { current: { startNewSlide() {} } },
    setStartingFrame: value => { state.startingFrame = value; }, setSlideshowRegenerationImage() {}, setReference: value => { state.reference = value; },
    setSlideIndex() {}, setSlideSelection() {}, setReferenceSelectionRevision() {}, setStep: value => { state.step = value; },
    setView: value => { state.view = value; }, setEditExpanded() {}, setShowGenerationResults() {}, setSelectedVideo() {},
    setHookPreparation: value => { state.hookPreparation = value; }, revealOnMobile: value => { state.pane = value; },
    requestAnimationFrame: callback => callback(), mainArea: { current: { querySelectorAll: () => [{ dataset: { referenceId: reference.id },
      querySelector: () => ({ focus: () => { state.focus++; } }) }] } },
    window: { location: { get pathname() { return state.pathname; }, get search() { return state.search; } },
      history: { replaceState: (_state, _unused, url) => { state.search = new URL(url, "https://example.test").search; } } }, ...overrides };
  vm.runInNewContext(code, context);
  return { state, actions: exports.actions, params: () => new URLSearchParams(state.search) };
}

test("Hook Recreate opens focused preview and does not declare a source-video edit", () => {
  const h = harness(); h.actions.selectReference(reference);
  assert.equal(h.state.pane, "preview"); assert.equal(h.params().get("hookFrameDraft"), draftId);
  assert.equal(h.params().get("hookRecreation"), "starting_image");
  for (const key of ["sourceUrl", "refType", "exploreRecreate"]) assert.equal(h.params().has(key), false);
});
test("Local Hook preview uses the same starting-frame route instead of attaching the source video", () => {
  const h = harness({ localPreview: true }); h.actions.selectReference(reference);
  assert.equal(h.state.pane, "preview"); assert.equal(h.params().get("hookRecreation"), "starting_image");
  for (const key of ["sourceUrl", "refType", "exploreRecreate"]) assert.equal(h.params().has(key), false);
});
test("Back preserves preparation identity, removes old video declarations and focuses Recreate", () => {
  const h = harness(); h.actions.closeHookPreparation();
  assert.equal(h.state.hookPreparation, null); assert.equal(h.state.view, "references"); assert.equal(h.state.pane, "preview");
  assert.equal(h.state.focus, 1); assert.equal(h.params().get("hookFrameDraft"), draftId);
  for (const key of ["sourceUrl", "refType", "exploreRecreate", "hookRecreation"]) assert.equal(h.params().has(key), false);
  h.actions.openHookPreparation();
  assert.equal(h.state.hookPreparation.draftId, draftId); assert.equal(h.state.pane, "preview");
});
test("approved handoff keeps only starting-image intent and restores the composer", () => {
  const h = harness(); const selection = { ownerId: "owner", draftId, referenceId: reference.id, assetId: "owned-result" };
  h.actions.useHookStartingFrame(selection);
  assert.equal(h.state.startingFrame, selection); assert.equal(h.state.hookPreparation, null); assert.equal(h.state.pane, "controls");
  assert.equal(h.params().has("sourceUrl"), false);
  const foreign = harness(); foreign.actions.useHookStartingFrame({ ...selection, ownerId: "different-owner" });
  assert.equal(foreign.state.startingFrame, null);
});
test("feature-disabled source reference flows retain their explicit video contract", () => {
  for (const overrides of [{ format: "wall_text", hookStartingFramePreparationEnabled: false }, { hookStartingFramePreparationEnabled: false }]) {
    const h = harness(overrides); h.actions.selectReference(reference);
    assert.equal(h.state.pane, "controls"); assert.equal(h.params().get("sourceUrl"), reference.videoUrl);
    assert.equal(h.params().get("exploreRecreate"), "1");
  }
});


test("choosing a previous starting frame switches to its Hook and restores the image composer", () => {
  const h = harness(); const selection = { ownerId: "owner", draftId, referenceId: "hook-2", assetId: "saved-frame" };
  h.actions.reuseHookStartingFrame(selection);
  assert.equal(h.state.startingFrame, selection); assert.equal(h.state.reference.id, "hook-2");
  assert.equal(h.state.pane, "controls"); assert.equal(h.state.hookPreparation, null);
  assert.equal(h.params().get("refId"), "hook-2"); assert.equal(h.params().get("hookFrameDraft"), draftId);
  for (const key of ["sourceUrl", "refType", "exploreRecreate", "hookRecreation"]) assert.equal(h.params().has(key), false);
  for (const overrides of [{ generating: true }, { user: { uid: "other" } }, { hookStartingFramePreparationEnabled: false }]) {
    const blocked = harness(overrides); blocked.actions.reuseHookStartingFrame(selection); assert.equal(blocked.state.startingFrame, null);
  }
  assert.throws(() => harness().actions.reuseHookStartingFrame({ ...selection, referenceId: "missing" }), /no longer available/);
});
