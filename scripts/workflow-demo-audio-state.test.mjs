import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schedulingDraft from "../lib/explore/workflow-scheduling-draft.ts";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const element = (type, props) => typeof type === "function" ? type(props) : ({ type, props });
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object") return [];
  return [value, ...nodes(value.props?.children)];
}

/** Execute each real parent and its attachment callbacks, without requests or DOM media. */
function layout(kind) {
  let cursor = 0, mediaCursor = 0;
  const generationInputs = [];
  const recoveryInputs = [];
  const generationSettings = {aspectRatio:"9:16"};
  let generated = null;
  let generationDraft;
  let finishingInputs;
  let finishedOutput = null;
  const prepareAction = { disabled: false, busy: false, message: "Prepare final video", error: null, onAction() {}, refresh() {} };
  const scheduleAction = { disabled: true, busy: false, message: "Wait for the saved final file", error: null, onAction() {}, refresh() {} };
  const slots = [];
  const attachments = Array.from({ length: 5 }, () => ({
    asset: { name: "selected", url: "blob:fixture", duration: 5 }, loading: false, error: null,
    accepted: true, removed: 0,
    async choose() { return this.accepted; },
    remove() { this.removed++; },
    cancelPending() {},
  }));
  attachments[0].assets = [attachments[0].asset];
  const appScreen = { asset: null, loading: false, error: null };
  const css = { default: new Proxy({}, { get: (_, key) => key }) };
  const recovery = {
    session: {
      section: "create", scheduleDraft: {}, sourceMode: "generate", instructions: "",
      generationSettings: { model: "seedance_2_5", duration: 5, quantity: 1, resolution: "720p", aspectRatio: "9:16" },
      localReferences: false, demoAudioPlayback: "once", demoFraming: null,
      sourceAssetId: null, generatedAssetId: null, generatedSelectionCleared: false, pendingSource: false,
      demoAssetId: null, demoAudioAssetId: null, pendingDemo: false, pendingDemoAudio: false, options: {},
    },
    assets: { source: null, demo: null, demoAudio: null }, problems: {}, loaded: true, error: null, recoveryRevision: 0,
  };
  recovery.update = (change) => { recovery.session = change(recovery.session); return true; };
  recovery.acceptAsset = (role, asset, sourceMode) => {
    recovery.assets[role] = asset;
    if (role === "source") recovery.update(previous => ({ ...previous, sourceMode: sourceMode ?? previous.sourceMode, sourceAssetId: sourceMode === "generate" ? previous.sourceAssetId : asset.id ?? null, generatedAssetId: sourceMode === "generate" ? asset.id ?? null : previous.generatedAssetId, generatedSelectionCleared: false, pendingSource: false }));
    if (role === "demo") {
      recovery.assets.demoAudio = null;
      recovery.update(previous => ({ ...previous, demoAssetId: asset.id ?? null, demoAudioAssetId: null, pendingDemo: false, pendingDemoAudio: false, demoAudioPlayback: "once", demoFraming: null }));
    }
    if (role === "demoAudio") recovery.update(previous => ({ ...previous, demoAudioAssetId: asset.id ?? null, pendingDemoAudio: false }));
    return true;
  };
  recovery.clearProblem = (role) => { delete recovery.problems[role]; };
  recovery.clearMedia = (role) => {
    recovery.assets[role] = null;
    if (role === "source") recovery.update(previous => ({ ...previous, sourceAssetId: null, generatedAssetId: null, generatedSelectionCleared: true, pendingSource: false }));
    if (role === "demo") { recovery.assets.demoAudio = null; recovery.update(previous => ({ ...previous, demoAssetId: null, demoAudioAssetId: null, pendingDemo: false, pendingDemoAudio: false, demoAudioPlayback: "once", demoFraming: null })); }
    if (role === "demoAudio") recovery.update(previous => ({ ...previous, demoAudioAssetId: null, pendingDemoAudio: false, demoAudioPlayback: "once" }));
  };
  recovery.markPending = (role) => recovery.update(previous => ({ ...previous, [role === "source" ? "pendingSource" : role === "demo" ? "pendingDemo" : "pendingDemoAudio"]: true }));
  recovery.retry = () => {};
  recovery.reset = () => {};
  const sourceSelection = {
    mode: "generate", source: null, preview: null, dirty: false, ready: false, busy: false, error: null,
    restoreOwned() {}, ownedForMode() { return null; }, setMode() {}, chooseUpload: async () => true,
    removeUpload() {}, clearUploadError() {}, clearSelection() {},
  };
  const imports = {
    "./pending-schedule-panel": { PendingExploreSchedulePanel: "pending-schedule", useBackgroundScheduleAvailability: () => ({ data: false }) },
    react: {
      useState(initial) { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, (value) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
      useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
      useEffect() {},
      useLayoutEffect() {},
      useCallback: callback => callback,
    },
    "@base-ui/react/tabs": { Tabs: { Root: "tabs", Panel: "tabpanel" } },
    "@/components/ui/button": { Button: "button" },
    "@/components/layout/workflow-navigation": { WorkflowNavigationButton: "navigation-button" },
    "@/components/ui/quiet-scrollbar.module.css": css,
    "@/components/explore/workflow-section-navigation": { WorkflowSectionNavigation: "section-nav", WorkflowSectionHeading: "section-heading", useWorkflowSectionOrientation: () => "vertical" },
    "lucide-react": { ArrowLeft: "arrow", BookOpen: "book" },
    "next/link": { default: "link" },
    "next/navigation": { useSearchParams: () => new URLSearchParams() },
    "@/components/providers/account-timezone-provider": { useAccountTimeZone: () => "Asia/Calcutta" },
    "@/components/explore/use-workflow-session": { useWorkflowSession: (inputs) => { recoveryInputs.push(inputs); return recovery; } },
    "@/lib/explore/workflow-generation-settings": {
      createWorkflowGenerationSettings: (duration, model) => ({ model: model ?? "seedance_2_5", duration, quantity: 1, resolution: "720p", aspectRatio: "9:16" }),
      normalizeWorkflowGenerationSettings: value => value,
    },
    "@/lib/trending/hook-video-client-upload": { uploadHookVideoDemo: async () => { throw Error("Unexpected demo upload"); } },
      "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async () => { throw new Error("Unexpected reference upload in a local workflow fixture"); } },
    "@/components/explore/hook-workflow-composer": { HookWorkflowComposer: "composer" },
    "@/components/explore/phone-workflow-composer": { PhoneWorkflowComposer: "composer", AppScreenPicker: "app-screen" },
    "@/components/explore/workflow-composition-panel": { WorkflowCompositionPanel: "composition" },
    "@/components/explore/talking-head-clip-editing": { TalkingHeadClipEditing: ({ children, source, demo, demoFraming }) => children({ source, demo: demo.asset, demoSource: null, demoFraming, editing: false, busy: false, error: null, controls: null, preview: null }) },
    "@/components/explore/talking-head-schedule-review": { TalkingHeadScheduleSummary: "schedule-summary", TalkingHeadScheduleActions: "schedule-actions" },
    "@/components/explore/workflow-schedule-review.module.css": css,
    "@/components/explore/talking-head-schedule-preview.module.css": css,
    "@/components/explore/workflow-creation-panel": { WorkflowCreationPanel: "controls" },
    "@/components/explore/workflow-edit-workspace": { WorkflowEditWorkspace: "editing", WorkflowScheduleWorkspace: "scheduling" },
    "@/components/explore/workflow-scheduling-panel": { EMPTY_SCHEDULE_DRAFT: {}, WorkflowSchedulingPanel: "schedule-settings" },
    "@/components/explore/workflow-connected-accounts": { WorkflowConnectedAccounts: "accounts" },
    "@/lib/explore/workflow-scheduling-draft": schedulingDraft,
    "@/components/explore/workflow-preview-canvas": { WorkflowPreviewCanvas: "canvas" },
    "@/components/explore/use-local-app-screen": { useLocalAppScreen: () => appScreen },
    "@/components/explore/use-workflow-source-video": { useWorkflowSourceVideo: () => sourceSelection },
    "@/components/explore/workflow-video-source-section": { WorkflowVideoSourceSection: "source-section" },
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => attachments[mediaCursor++] },
    "@/components/explore/use-local-workflow-images": { useLocalWorkflowImages: () => attachments[0] },
    "@/components/explore/use-workflow-generation-settings": { useWorkflowGenerationSettings: (initialDuration, initialModel) => {
      generationInputs.push({ initialDuration, initialModel });
      return { settings: generationSettings, dirty: false, changeSettings(patch) { Object.assign(generationSettings,patch); } };
    } },
    "@/components/explore/workflow-generation-boundary": { WorkflowAccountBoundary: ({ children }) => children("owner"), WorkflowGenerationBoundary: ({ children, draft }) => { generationDraft = draft; return children(generated); } },
    "@/components/explore/workflow-finishing-boundary": { WorkflowFinishingBoundary: ({ children, ...inputs }) => { finishingInputs=inputs; return children({ edit: prepareAction, schedule: scheduleAction, output: finishedOutput, captions: { transcript: null }, music: { source: null, playback: "repeat", selectionError: null }, options: { subtitles: false, style: "clean" }, setOptions() {} }); } },
    "@/components/explore/workflow-studio.module.css": css,
    "@/components/explore/workflow-creation.module.css": css,
    "@/components/explore/workflow-section-layout.module.css": css,
    "@/components/explore/workflow-video-asset-picker": { WorkflowVideoAssetPicker: "WorkflowVideoAssetPicker" },
    "@/components/explore/workflow-clip-source-actions": { WorkflowClipSourceActions: "WorkflowClipSourceActions" },
    "@/lib/utils": { cn: (...values) => values.join(" ") },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  };
  const exported = {};
  const compiled = ts.transpileModule(read(`components/explore/${kind}-workflow-preview.tsx`), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports: exported, URLSearchParams, window: { location: { pathname: "/explore/create-hook", search: "" }, history: { replaceState() {} }, requestAnimationFrame(callback) { callback(); } }, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  const component = exported[kind === "hook" ? "HookWorkflowPreview" : "PhoneWorkflowPreview"];
  return {
    render(props = {}) {
      cursor = 0; mediaCursor = 1;
      const tree = component({ generationEnabled: false, demoFramingEnabled:true, ...props });
      return {
        tree,
        composition: nodes(tree).find((node) => node.type === "composition").props,
        tabs: nodes(tree).find((node) => node.type === "tabs").props,
        composer: nodes(tree).find((node) => node.type === "composer").props,
        finishing: finishingInputs,
        generationDraft,
      };
    },
    demo: attachments[3], audio: attachments[4], references: attachments.slice(0, 3), appScreen, generationInputs, recoveryInputs, scheduleAction, prepareAction,
    selectVideo(video) { generated = video ? {selected:video, results:[video]} : null; },
    setFinishedOutput(output) { finishedOutput = output; },
  };
}

test("both Create layouts carry failed image, video and audio selections into generation validation", () => {
  for (const kind of ["hook", "phone"]) {
    const actual = layout(kind);
    assert.equal(actual.render().generationDraft.referencesError, null);
    for (const [index, reference] of actual.references.entries()) {
      reference.error = `Failed reference ${index}`;
      const rendered = actual.render();
      assert.equal(rendered.generationDraft.referencesError, reference.error);
      assert.equal(rendered.generationDraft.referencesPending, false);
      assert.equal(rendered.generationDraft[index === 0 ? "creator" : index === 1 ? "videoReference" : "audioReference"].url, "blob:fixture", "The previous preview remains visible, while validation receives the failed replacement");
      reference.error = null;
      assert.equal(actual.render().generationDraft.referencesError, null);
    }
    actual.demo.error = "Failed demo upload";
    actual.audio.error = "Failed demo audio";
    assert.equal(actual.render().generationDraft.referencesError, null, "Demo failures belong to finishing and cannot rewrite generation inputs");
    if (kind === "phone") {
      actual.appScreen.error = "This screen recording could not be previewed.";
      assert.equal(actual.render().generationDraft.referencesError, actual.appScreen.error);
    }
  }
});

test("both Create layouts pass every chosen image to the visible picker and generation draft in the same order", () => {
  for (const kind of ["hook", "phone"]) {
    const actual = layout(kind);
    const images = [actual.references[0].asset, { name: "Second image", url: "blob:second", duration: null }, { name: "Third image", url: "blob:third", duration: null }];
    actual.references[0].assets = images;
    const rendered = actual.render();
    assert.equal(rendered.composer.imageReferences, actual.references[0]);
    assert.equal(rendered.generationDraft.referenceImages, images);
    assert.equal(rendered.generationDraft.creator, images[0], "The original creator field remains the first selected image");
    assert.equal(rendered.finishing.demo.url, "blob:fixture", "Generation images cannot replace editor/demo footage");
  }
});

test("both finishing layouts block pending or failed demo soundtrack changes while keeping the previous preview", () => {
  for (const kind of ["hook", "phone"]) {
    const actual = layout(kind);
    actual.audio.loading = true;
    let rendered = actual.render();
    assert.match(rendered.finishing.demoFramingError, /selected demo media to finish loading/);
    assert.equal(rendered.finishing.demoAudio.url, "blob:fixture");
    actual.audio.loading = false; actual.audio.error = "Could not download the selected soundtrack.";
    rendered = actual.render();
    assert.equal(rendered.finishing.demoFramingError, actual.audio.error);
    actual.audio.error = null;
    assert.equal(actual.render().finishing.demoFramingError, null);
  }
});

test("Talking Head preview always remains visible and its removed toggle cannot hide selected media", () => {
  const actual = layout("hook");
  const preview = rendered => nodes(rendered.tree).find(node => node.props?.id === "hook-workflow-preview");
  let rendered = actual.render();
  assert.equal(preview(rendered).props.hidden, false);
  assert.equal(nodes(rendered.tree).find(node => node.type === "controls").props.heading, undefined);
  actual.selectVideo({ id: "selected-preview-clip", title: "Selected clip", url: "blob:fixture", width: 720, height: 1280 });
  rendered = actual.render();
  assert.equal(preview(rendered).props.hidden, false);
  assert.equal(rendered.finishing.source.id, "selected-preview-clip");
});

test("Hook quick-start model and duration seed the recovered settings owner through the actual layout", () => {
  const actual = layout("hook");
  actual.render({ initialModel: "kling_3_0", initialDuration: 10 });
  assert.deepEqual(actual.recoveryInputs.map(({ defaults }) => ({ model: defaults.model, duration: defaults.duration })), [{ model: "kling_3_0", duration: 10 }]);
  assert.equal(actual.demo.removed, 0);
  assert.equal(actual.audio.removed, 0);
});

test("Talking Head Schedule keeps its guarded actions inside the settings panel without changing preview inputs", () => {
  const actual = layout("hook");
  actual.render().tabs.onValueChange("schedule");
  const view = actual.render(), all = nodes(view.tree);
  const settings = all.find(node => node.type === "schedule-settings");
  const summary = all.find(node => node.type === "schedule-summary");
  const actions = settings.props.footer;
  assert.equal(settings.props.presentation, "review");
  assert.equal(summary.props.draft, settings.props.draft);
  assert.equal(summary.props.timezone, settings.props.timezone);
  assert.equal(actions.props.action, actual.scheduleAction);
  assert.equal(actions.props.preparation, actual.prepareAction);
  assert.equal(actions.props.enabled, false, "The local preview cannot schedule");
  assert.equal(actions.type, "schedule-actions");
  assert.equal(all.filter(node => node.type === "footer" && node.props?.["aria-label"] === "Schedule actions").length, 0);
  assert.equal(view.finishing.scheduleDraft, settings.props.draft, "The finishing boundary and the visible schedule controls share one posting draft");
  assert.equal(view.finishing.scheduleTimezone, settings.props.timezone, "The finishing boundary uses the account-aware timezone shown by schedule controls");
  assert.ok(all.find(node => node.type === "controls").props.actionContent, "The in-card default action is replaced");
  assert.equal(all.find(node => node.type === "scheduling").props.demoAudio, actual.audio.asset);
  actions.props.onBackToEdit();
  assert.equal(actual.render().tabs.value, "edit");
});

test("Talking Head Schedule forwards preparation only until a finished file exists and preserves the posting draft", () => {
  const actual = layout("hook");
  actual.render().tabs.onValueChange("schedule");
  let view = actual.render({ generationEnabled: true });
  let settings = nodes(view.tree).find(node => node.type === "schedule-settings").props;
  const draft = { platform: "instagram", caption: "Keep this caption", date: "2026-10-20", time: "16:30", timezone: "Asia/Calcutta", connectionIds: { instagram: "selected-account" } };
  settings.onChange(draft);
  view = actual.render({ generationEnabled: true });
  settings = nodes(view.tree).find(node => node.type === "schedule-settings").props;
  assert.equal(settings.footer.props.preparation, actual.prepareAction);
  assert.equal(settings.footer.props.enabled, true);
  assert.equal(settings.draft, draft);
  actual.setFinishedOutput({ id: "finished-file", url: "https://example.test/finished.mp4" });
  view = actual.render({ generationEnabled: true });
  settings = nodes(view.tree).find(node => node.type === "schedule-settings").props;
  assert.equal(settings.footer.props.preparation, undefined, "A verified file returns the card to schedule review");
  assert.equal(settings.footer.props.action, actual.scheduleAction);
  assert.equal(settings.draft, draft, "Preparation status must not reset posting settings");
  assert.equal(settings.timezone, draft.timezone);
});

for (const kind of ["hook", "phone"]) {
  test(`${kind}: incompatible output shape never reaches finishing; reset and a new saved frame clear the error`, () => {
    const actual=layout(kind), framing={version:1,width:.5,height:1,points:[[0,0,0]]};
    actual.render({demoFramingEnabled:true}).composition.onDemoFramingChange(framing);
    actual.render({demoFramingEnabled:true}).composer.onGenerationSettingsChange({aspectRatio:"16:9"});
    let view=actual.render({demoFramingEnabled:true});
    assert.equal(view.composition.demoFraming,null);
    assert.match(view.composition.demoFramingError,/Video shape changed/);
    assert.equal(view.finishing.demoFraming,null);
    assert.match(view.finishing.demoFramingError,/Record framing again/);
    view.composition.onDemoFramingChange(framing);
    view=actual.render({demoFramingEnabled:true});
    assert.equal(view.finishing.demoFraming,framing);assert.equal(view.finishing.demoFramingError,null);
    actual.selectVideo({width:720,height:1280});
    view=actual.render({demoFramingEnabled:true});
    assert.equal(view.finishing.demoFraming,null);assert.match(view.finishing.demoFramingError,/shape changed/);
    view.composition.onDemoFramingChange(null);
    assert.equal(actual.render({demoFramingEnabled:true}).finishing.demoFramingError,null);
  });
  test(`${kind}: replacing the demo clears its recorded path; failed replacements and tab changes preserve it`, async () => {
    const actual = layout(kind), framing = { version: 1, width: .5, height: 1, points: [[0, 0, 0], [12000, .5, 0]] };
    actual.render({ demoFramingEnabled: true }).composition.onDemoFramingChange(framing);
    actual.render().tabs.onValueChange("schedule");
    assert.equal(actual.render().composition.demoFraming, framing);
    actual.demo.accepted = false;
    await actual.render().composition.demo.choose({});
    assert.equal(actual.render().composition.demoFraming, framing);
    actual.demo.accepted = true;
    await actual.render().composition.demo.choose({});
    assert.equal(actual.render().composition.demoFraming, null);
    actual.render().composition.onDemoFramingChange(framing);
    actual.render().composition.demo.remove();
    assert.equal(actual.render().composition.demoFraming, null);
  });
  test(`${kind}: audio replacement resets repeat only after successful selection`, async () => {
    const actual = layout(kind);
    let { composition } = actual.render();
    assert.equal(composition.demoAudioPlayback, "once");
    composition.onDemoAudioPlaybackChange("repeat");
    composition = actual.render().composition;
    assert.equal(composition.demoAudioPlayback, "repeat");
    actual.audio.accepted = false;
    assert.equal(await composition.demoAudio.choose({}), false);
    assert.equal(actual.render().composition.demoAudioPlayback, "repeat", "A failed replacement keeps the prior selection and preference");
    actual.audio.accepted = true;
    assert.equal(await actual.render().composition.demoAudio.choose({}), true);
    assert.equal(actual.render().composition.demoAudioPlayback, "once", "A new recording cannot inherit repeat");
    assert.equal(actual.demo.removed, 0);
  });

  test(`${kind}: audio removal and accepted demo changes clear repeat; failed demo changes preserve it`, async () => {
    const actual = layout(kind);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    actual.render().composition.demoAudio.remove();
    assert.equal(actual.render().composition.demoAudioPlayback, "once");
    assert.equal(actual.audio.removed, 1);
    assert.equal(actual.demo.removed, 0);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    actual.demo.accepted = false;
    assert.equal(await actual.render().composition.demo.choose({}), false);
    assert.equal(actual.render().composition.demoAudioPlayback, "repeat");
    assert.equal(actual.audio.removed, 1);
    actual.demo.accepted = true;
    assert.equal(await actual.render().composition.demo.choose({}), true);
    assert.equal(actual.render().composition.demoAudioPlayback, "once");
    assert.equal(actual.audio.removed, 2);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    actual.render().composition.demo.remove();
    assert.equal(actual.render().composition.demoAudioPlayback, "once");
    assert.equal(actual.audio.removed, 3);
    assert.equal(actual.demo.removed, 1);
  });

  test(`${kind}: changing sections retains the audio timing preference and does not clear sources`, () => {
    const actual = layout(kind);
    actual.render().composition.onDemoAudioPlaybackChange("repeat");
    for (const section of ["edit", "schedule", "create", "edit"]) {
      actual.render().tabs.onValueChange(section);
      const current = actual.render();
      assert.equal(current.tabs.value, section);
      assert.equal(current.composition.demoAudioPlayback, "repeat");
    }
    assert.equal(actual.audio.removed, 0);
    assert.equal(actual.demo.removed, 0);
  });
}
