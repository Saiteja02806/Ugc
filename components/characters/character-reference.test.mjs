import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getReferenceImageFileError } from "../../lib/generation/reference-image.ts";
import { characterBatchProgress } from "../../lib/characters/batch-progress.ts";
import { characterResultGroups } from "../../lib/characters/result-groups.ts";
import { getCharacterImageModelLabel, MAX_CHARACTER_REFERENCES } from "../../lib/characters/image-models.ts";

import * as promptSkills from "../../lib/characters/prompt-skills.ts";

const assetId = "55555555-5555-4555-8555-555555555555";
const image = { kind: "image", asset: { id: assetId, url: "https://owned.test/style.png" } };
const all = (node, match) => !node || typeof node !== "object" ? [] : [
  ...(match(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, match)),
];

function runtime(file, imports, globals = {}) {
  const values = [], effects = [];
  let cursor = 0;
  const exported = {};
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === "function" ? value(values[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return values[index] ??= { current: initial }; },
    useCallback: fn => fn,
    useEffect: fn => { effects.push(fn); },
  };
  const modules = {
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_, name) => name }),
    "@/components/ui/button": { Button: "Button" }, ...imports,
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: exported, crypto, URL, Array, Error, ...globals,
    require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; },
  });
  return { exported, effects, render: fn => { cursor = 0; return fn(); } };
}

function characterHarness(skills = promptSkills.CHARACTER_PROMPT_SKILLS, clipboard = async () => {}) {
  const submitted = [];
  const builder = {
    access: { data: { access: { affordableImageCount: 3, imageCreditCost: 1, creditsRemaining: 10, isPaid: true } } },
    characters: { data: { characters: [] }, refetch() {} },
    generate: { isPending: false, mutate: request => submitted.push(request) },
    select: { isPending: false }, session: { pendingRequest: null }, selected: null,
    visibleJobs: [], historyImages: [], jobs: {}, history: {},
    touchSession() {},
    chooseCharacter(id) { builder.selected = id ? { id, url: "https://owned.test/saved.png", name: "Saved" } : null; },
    get selectedCharacters() { return builder.references ?? (builder.selected ? [builder.selected] : []); },
    chooseCharacters(ids) { builder.references = ids.map(id => ({ id, url: `https://owned.test/${id}.png`, name: "Saved" })); builder.selected = builder.references[0] ?? null; },
  };
  const h = runtime("./character-workspace.tsx", {
    "next/image": { default: "Image" }, "next/link": { default: "Link" },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
    "@/components/generation/ai-studio-composer": { AiStudioComposer: "Composer", AiStudioSetting: "Setting", AiStudioSettingSelect: "SettingSelect" },
    "@/components/generation/reference-media-upload": { ReferenceMediaUpload: "Upload" },
    "@/components/generation/reference-upload-preview": { ReferenceUploadPreview: "ReferencePreview" },
    "@/lib/characters/image-models": { CHARACTER_IMAGE_MODEL_OPTIONS: [], MAX_CHARACTER_REFERENCES, getCharacterPromptLimit: () => 32000, getCharacterImageModelLabel },
    "@/lib/characters/batch-progress": { characterBatchProgress },
    "@/lib/characters/result-groups": { characterResultGroups },
    "@/lib/characters/prompt-skills": { ...promptSkills, CHARACTER_PROMPT_SKILLS: skills, resolveCharacterPromptSkills: ids => promptSkills.resolveCharacterPromptSkills(ids, skills) },
    "@/components/ui/popover": { Popover: "Popover", PopoverContent: "PopoverContent", PopoverTitle: "PopoverTitle", PopoverTrigger: "PopoverTrigger" },
    "./use-character-builder": { useCharacterBuilder: () => builder }, "./character-history": { CharacterHistory: "History" },
    "./image-download-button": { ImageDownloadButton: "Download" },
    "./character-workspace.module.css": { default: {} },
    "@/components/ui/dialog": { Dialog: "Dialog", DialogContent: "DialogContent", DialogDescription: "DialogDescription", DialogHeader: "DialogHeader", DialogTitle: "DialogTitle" },
  }, { navigator: { clipboard: { writeText: clipboard } } });
  const render = () => h.render(() => {
    let root = h.exported.CharacterWorkspace({});
    while (typeof root.type === "function") root = root.type(root.props);
    return root;
  });
  const composer = () => all(render(), node => node.type === "Composer")[0].props;
  const upload = () => composer().leadingControl.props;
  composer().onPromptChange("Generate an influencer in a similar style to this.");
  return { builder, submitted, composer, upload, render };
}

test("skills toggle without editing the draft, submit IDs, freeze during uncertainty and render only authored result text", () => {
  const h = characterHarness();
  const draft = h.composer().prompt;
  const toggle = () => all(h.composer().settings, node => node.props?.role === "checkbox")[0];
  toggle().props.onClick();
  assert.equal(h.composer().prompt, draft);
  assert.equal(toggle().props["aria-checked"], true);
  assert.equal(all(h.composer().contextBanner, node => node.props?.["aria-label"] === "Remove Realistic Skin skill").length, 1);
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[0].skillIds), ["realistic-skin"]);
  assert.equal(h.submitted[0].prompt, draft);
  h.builder.session.pendingRequest = h.submitted[0];
  assert.equal(toggle().props.disabled, true);
  toggle().props.onClick();
  assert.equal(toggle().props["aria-checked"], true);
  h.builder.session.pendingRequest = null;
  const skill = promptSkills.CHARACTER_PROMPT_SKILLS[0];
  h.builder.visibleJobs = [{ jobId: "skill-job" }];
  h.builder.visibleStatuses = [{ id: "skill-job", prompt: promptSkills.composeCharacterPrompt(draft, [skill]), displayPrompt: draft, skills: [{ id: skill.id, name: skill.name }] }];
  const paragraphs = all(h.render(), node => node.type === "p");
  assert.equal(paragraphs.some(node => node.props.children === draft), true);
  assert.equal(paragraphs.some(node => typeof node.props.children === "string" && node.props.children.includes(skill.instruction)), false);
  all(h.composer().contextBanner, node => node.type === "button")[0].props.onClick();
  assert.equal(toggle().props["aria-checked"], false);
  assert.equal(h.composer().prompt, draft);
  h.composer().onSubmit();
  assert.equal(h.submitted[1].skillIds, undefined);
});

test("adding a second config entry needs no UI change and allows independent multi-selection", () => {
  const h = characterHarness([...promptSkills.CHARACTER_PROMPT_SKILLS, { id: "lighting-fixture", name: "Lighting", description: "Fixture", instruction: "Dim background" }]);
  const options = () => all(h.composer().settings, node => node.props?.role === "checkbox");
  options()[1].props.onClick(); options()[0].props.onClick();
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[0].skillIds), ["lighting-fixture", "realistic-skin"]);
  options()[0].props.onClick();
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[1].skillIds), ["lighting-fixture"]);
  assert.equal(options()[1].props["aria-checked"], true);
});

test("the character composer submits the attached asset ID with the prompt and never a browser or signed URL", () => {
  const h = characterHarness();
  assert.equal(h.upload().expectedUserId, "owner");
  assert.deepEqual(Array.from(h.upload().allowedKinds), ["image"]);
  h.upload().onChange(image);
  assert.equal(h.composer().generateDisabled, false);
  h.composer().onSubmit();
  assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].referenceImageAssetId, assetId);
  assert.equal(h.submitted[0].prompt, "Generate an influencer in a similar style to this.");
  assert.equal(h.submitted[0].referenceImageUrl, undefined);
  assert.equal(h.submitted[0].referenceCharacterId, undefined);
});

test("saved image copy uses its own full prompt, preserves selection and hides missing prompts", async () => {
  const writes = [];
  const h = characterHarness(undefined, async text => { writes.push(text); });
  h.builder.characters.data.characters = [
    { id: "one", name: "Same name", prompt: "Portrait one\nSkin instructions" },
    { id: "two", name: "Same name", prompt: "Portrait two" },
    { id: "legacy", name: "Legacy image" },
    { id: "blank", name: "Blank", prompt: "  " },
  ];
  const copy = index => all(h.render(), node => node.props?.["aria-label"] === `Copy prompt for saved image ${index}`)[0];
  assert.equal(copy(3), undefined); assert.equal(copy(4), undefined);
  copy(2).props.onClick(); await flush();
  assert.deepEqual(writes, ["Portrait two"]);
  assert.equal(copy(2).props.title, "Copied");
  copy(1).props.onClick(); await flush();
  assert.deepEqual(writes, ["Portrait two", "Portrait one\nSkin instructions"]);
  assert.equal(copy(1).props.title, "Copied");
  assert.equal(copy(2).props.title, "Copy prompt");
  assert.equal(h.builder.selectedCharacters.length, 0);
  assert.equal(h.submitted.length, 0);
});

test("My influencers hides visible names and labels the Download and Copy Prompt footer actions", () => {
  const h = characterHarness();
  h.builder.characters.data.characters = [{ id: "one", name: "My AI influencer", prompt: "Specific stored prompt" }];
  const tree = h.render();
  assert.equal(all(tree, node => node.type === "span" && node.props.children === "My AI influencer").length, 0);
  const select = all(tree, node => node.props?.["aria-label"] === "Select saved image 1: My AI influencer")[0];
  assert.equal(select.props["aria-pressed"], false);
  const download = all(tree, node => node.type === "Download" && node.props.name === "saved image 1")[0];
  assert.equal(download.props.label, "Download");
  const copy = all(tree, node => node.props?.["aria-label"] === "Copy prompt for saved image 1")[0];
  assert.equal(all(copy, node => node.type === "span" && node.props.children === "Copy Prompt").length, 1);
});

test("clipboard rejection remains visible inside My influencers and never claims a successful copy", async () => {
  const h = characterHarness(undefined, async () => { throw Error("Denied"); });
  h.builder.characters.data.characters = [{ id: "one", name: "Saved", prompt: "My prompt" }];
  const copy = () => all(h.render(), node => node.props?.["aria-label"] === "Copy prompt for saved image 1")[0];
  copy().props.onClick(); await flush();
  assert.equal(copy().props.title, "Copy prompt");
  assert.equal(all(h.render(), node => node.props?.role === "alert" && /Allow clipboard access/.test(node.props.children)).length, 1);
});

test("submitted prompts stay beside their batch when the draft changes, including history results", () => {
  const h = characterHarness();
  h.builder.visibleJobs = [{ jobId: "one", generationId: "generation-one" }, { jobId: "two", generationId: "generation-two" }];
  h.builder.visibleStatuses = h.builder.visibleJobs.map(job => ({ id: job.jobId, batchId: "same-batch", prompt: "The exact submitted prompt\nwith its original lines.", isTerminal: false }));
  h.composer().onPromptChange("An unsent draft");
  const copyButtons = all(h.render(), node => node.type === "button" && node.props["aria-label"] === "Copy prompt");
  assert.equal(copyButtons.length, 1);
  assert.equal(all(h.render(), node => node.type === "details").length, 0);
  assert.equal(all(h.render(), node => node.type === "p" && node.props.children === "The exact submitted prompt\nwith its original lines.").length, 1);
  h.builder.historyImage = { jobId: "one", saved: true };
  h.builder.visibleJobs = h.builder.visibleJobs.slice(0, 1);
  h.builder.visibleStatuses = [{ ...h.builder.visibleStatuses[0], prompt: "Prompt from history" }];
  assert.equal(all(h.render(), node => node.type === "p" && node.props.children === "Prompt from history").length, 1);
});

test("results remove summary copy and enlarge only completed images without selecting or generating", () => {
  const h = characterHarness();
  h.builder.visibleJobs = ["one", "pending", "failed", "two"].map(jobId => ({ jobId }));
  h.builder.visibleStatuses = [
    { id: "one", isTerminal: true, output: { mediaAssetId: "one", url: "https://owned.test/full-one.png" } },
    { id: "pending", isTerminal: false }, { id: "failed", isTerminal: true, error: "Generation failed" },
    { id: "two", isTerminal: true, output: { mediaAssetId: "two", url: "https://owned.test/full-two.png" } },
  ];
  const button = label => all(h.render(), node => node.type === "button" && node.props["aria-label"] === label)[0];
  assert.equal(all(h.render(), node => node.type === "article").length, 4);
  assert.equal(all(h.render(), node => node.type === "button" && node.props["aria-label"]?.startsWith("Enlarge influencer")).length, 2);
  assert.equal(button("Enlarge influencer image 2"), undefined);
  assert.equal(button("Enlarge influencer image 3"), undefined);
  const text = JSON.stringify(h.render());
  assert.doesNotMatch(text, /still processing|image created|Select images to use as references in your next prompt/);
  button("Enlarge influencer image 1").props.onClick();
  const lightbox = () => all(h.render(), node => node.type === "Dialog")[0];
  const fullImage = () => all(lightbox(), node => node.type === "img")[0];
  assert.equal(lightbox().props.open, true);
  assert.equal(fullImage().props.src, "https://owned.test/full-one.png");
  all(lightbox(), node => node.type === "Button" && node.props["aria-label"] === "Next image")[0].props.onClick();
  assert.equal(fullImage().props.src, "https://owned.test/full-two.png");
  all(lightbox(), node => node.type === "DialogContent")[0].props.onKeyDown({ key: "ArrowRight", preventDefault() {} });
  assert.equal(fullImage().props.src, "https://owned.test/full-one.png");
  assert.equal(h.builder.selectedCharacters.length, 0);
  assert.equal(h.submitted.length, 0);
  lightbox().props.onOpenChange(false);
  assert.equal(lightbox().props.open, false);
  button("Enlarge influencer image 4").props.onClick();
  h.builder.visibleJobs = h.builder.visibleJobs.slice(0, 1);
  assert.equal(lightbox().props.open, false, "removed images cannot remain open in a stale lightbox");
});

test("successive pasted references append in order and individual removal keeps the other image", () => {
  const h = characterHarness(), secondId = "66666666-6666-4666-8666-666666666666";
  assert.equal(h.upload().append, true);
  assert.equal(h.upload().maxReferences, MAX_CHARACTER_REFERENCES);
  h.upload().onChange(image);
  h.upload().onChange({ ...image, asset: { id: secondId, url: "https://owned.test/second.png" } });
  const previews = all(h.upload().referencePreview, node => node.type === "ReferencePreview");
  assert.deepEqual(Array.from(previews, node => node.props.url), [image.asset.url, "https://owned.test/second.png"]);
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[0].referenceImageAssetIds), [assetId, secondId]);
  assert.equal(h.submitted[0].referenceImageAssetId, undefined);
  previews[0].props.onRemove(); h.composer().onSubmit();
  assert.equal(h.submitted[1].referenceImageAssetId, secondId);
});

test("upload pending and failed states block button, Enter and stale submit callbacks until explicitly cleared", () => {
  const h = characterHarness();
  const beforeUpload = h.composer();
  h.upload().onPendingChange(true);
  beforeUpload.onSubmit();
  assert.equal(h.composer().generateDisabled, true);
  h.composer().onTextareaKeyDown({ key: "Enter", shiftKey: false, nativeEvent: {}, preventDefault() {} });
  assert.equal(h.submitted.length, 0);
  h.upload().onErrorChange("Upload failed"); h.upload().onPendingChange(false);
  beforeUpload.onSubmit(); h.composer().onSubmit();
  assert.equal(h.composer().generateDisabled, true);
  assert.equal(h.submitted.length, 0);
  h.upload().onErrorChange(null);
  assert.equal(h.composer().generateDisabled, false);
  h.composer().onSubmit();
  assert.equal(h.submitted.length, 1);
});

test("adding and removing an upload preserves the selected saved influencer", () => {
  const h = characterHarness();
  const savedId = "44444444-4444-4444-8444-444444444444";
  h.builder.chooseCharacter(savedId);
  h.upload().onChange(image);
  assert.equal(h.builder.selected.id, savedId);
  assert.equal(h.composer().contextBanner, undefined);
  h.composer().onSubmit();
  assert.equal(h.submitted[0].referenceCharacterId, savedId);
  assert.equal(h.submitted[0].referenceImageAssetId, assetId);
  h.upload().onChange(null); h.composer().onSubmit();
  assert.equal(h.submitted[1].referenceImageAssetId, undefined);
  assert.equal(h.submitted[1].referenceCharacterId, savedId);
  h.builder.chooseCharacter(null); h.composer().onSubmit();
  assert.equal(h.submitted[2].referenceCharacterId, undefined);
});

test("three saved references and two uploads remain visible and submit together", () => {
  const h = characterHarness();
  const savedIds = Array.from({ length: 3 }, () => crypto.randomUUID());
  h.builder.chooseCharacters(savedIds);
  h.upload().onChange(image);
  h.upload().onChange({ ...image, asset: { id: crypto.randomUUID(), url: "https://owned.test/second.png" } });
  assert.equal(h.upload().referenceCount, 5);
  let previews = all(h.upload().referencePreview, node => node.type === "ReferencePreview");
  assert.equal(previews.length, 5);
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[0].referenceCharacterIds), savedIds);
  assert.equal(h.submitted[0].referenceImageAssetIds.length, 2);
  previews[1].props.onRemove();
  previews = all(h.upload().referencePreview, node => node.type === "ReferencePreview");
  assert.equal(previews.length, 4);
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[1].referenceCharacterIds), [savedIds[0], savedIds[2]]);
  assert.deepEqual(Array.from(h.submitted[1].referenceImageAssetIds), Array.from(h.submitted[0].referenceImageAssetIds));
});

test("uncertain admissions freeze attachment changes and retry the original request", () => {
  const h = characterHarness();
  h.builder.session.pendingRequest = { mode: "custom", model: "gpt_image", prompt: "Same style", referenceImageAssetId: assetId, idempotencyKey: "original-key" };
  assert.equal(h.upload().disabled, true);
  assert.equal(h.composer().generateDisabled, true);
  h.composer().onSubmit(); assert.equal(h.submitted.length, 0);
  all(h.render(), node => node.type === "Button" && node.props.children === "Retry request")[0].props.onClick();
  assert.equal(h.submitted[0], h.builder.session.pendingRequest);
});

test("a saved reference cannot unmount an active upload or change during an uncertain admission", () => {
  const h = characterHarness();
  h.builder.chooseCharacter("44444444-4444-4444-8444-444444444444");
  const remove = () => h.upload().referencePreview.props;
  assert.equal(remove().disabled, false);
  h.upload().onPendingChange(true);
  assert.equal(remove().disabled, true);
  h.upload().onPendingChange(false);
  h.builder.session.pendingRequest = { mode: "custom", referenceCharacterId: h.builder.selected.id };
  assert.equal(remove().disabled, true);
});

test("the influencer composer keeps its identity thumbnail inline and credit status beside Generate", () => {
  const h = characterHarness();
  h.builder.chooseCharacter("44444444-4444-4444-8444-444444444444");
  assert.equal(h.composer().contextBanner, undefined);
  assert.equal(h.upload().inline, true);
  assert.equal(h.upload().referencePreview.props.url, "https://owned.test/saved.png");
  assert.equal(h.composer().inlineReferences, true);
  assert.equal(h.composer().quiet, true);
  assert.equal(h.composer().showPromptHint, false);
  const status = all(h.composer().secondaryActions, node => node.props?.role === "status")[0];
  assert.match(status.props.children, /1 image · 1 credit · 10 available/);
});

test("multiple saved references appear inline, submit ordered IDs and can be removed individually", () => {
  const h = characterHarness();
  const ids = [assetId, "44444444-4444-4444-8444-444444444444"];
  h.builder.chooseCharacters(ids);
  assert.equal(h.composer().hasAttachments, true);
  const previews = all(h.upload().referencePreview, node => node.type === "ReferencePreview");
  assert.equal(previews.length, 2);
  h.composer().onSubmit();
  assert.deepEqual(Array.from(h.submitted[0].referenceCharacterIds), ids);
  assert.equal(h.submitted[0].referenceCharacterId, undefined);
  assert.equal(h.submitted[0].referenceImageAssetId, undefined);
  previews[0].props.onRemove();
  h.composer().onSubmit();
  assert.equal(h.submitted[1].referenceCharacterId, ids[1]);
});

test("a partially restored reference selection cannot silently submit a prompt with fewer images", () => {
  const h = characterHarness();
  const ids = [assetId, "44444444-4444-4444-8444-444444444444"];
  h.builder.session.selectedCharacterIds = ids;
  h.builder.chooseCharacters(ids.slice(0, 1));
  assert.equal(h.composer().generateDisabled, true);
  h.composer().onSubmit();
  assert.equal(h.submitted.length, 0);
  h.builder.chooseCharacters(ids);
  assert.equal(h.composer().generateDisabled, false);
});

test("candidate selection toggles references independently and dismissal never deletes a saved image", () => {
  const h = characterHarness();
  const ids = [assetId, "44444444-4444-4444-8444-444444444444"];
  h.builder.visibleJobs = ids.map((id) => ({ jobId: id }));
  h.builder.visibleStatuses = ids.map(id => ({ id, isTerminal: true, output: { mediaAssetId: id, url: `https://owned.test/${id}.png` } }));
  h.builder.characters.data.characters = ids.map(id => ({ id }));
  const click = label => all(h.render(), node => node.type === "button" && node.props["aria-label"] === label)[0].props.onClick();
  click("Select influencer image 1"); click("Select influencer image 2");
  assert.deepEqual(Array.from(h.builder.selectedCharacters, image => image.id), ids);
  click("Select influencer image 1");
  assert.deepEqual(Array.from(h.builder.selectedCharacters, image => image.id), [ids[1]]);
  let dismissed;
  h.builder.dismissImage = id => { dismissed = id; };
  click("Remove image 1 from workspace");
  assert.equal(dismissed, ids[0]);
  assert.equal(h.builder.characters.data.characters.length, 2);
  assert.equal(all(h.render(), node => node.type === "Download").length, 4);
});

function uploadHarness(upload, options = {}) {
  const changes = [], pending = [], errors = [], calls = [], events = new Map();
  const h = runtime("../generation/reference-media-upload.tsx", {
    "@/components/generation/reference-upload-preview": { ReferenceUploadPreview: "Preview" },
    "@/lib/generation/reference-image": { getReferenceImageFileError },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: (...args) => { calls.push(args); return upload(...args); } },
  });
  const render = () => h.render(() => h.exported.ReferenceMediaUpload({ allowedKinds: ["image"], expectedUserId: "owner",
    selection: null, onChange: value => changes.push(value), onPendingChange: value => pending.push(value), onErrorChange: value => errors.push(value), ...options }));
  const tree = render();
  all(tree, node => node.type === "input")[0].props.ref.current = { closest: () => ({
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
  }) };
  const cleanup = h.effects.map(effect => effect()).filter(Boolean);
  return { changes, pending, errors, calls, events, render, cleanup: () => cleanup.forEach(fn => fn()),
    choose: file => all(tree, node => node.type === "input")[0].props.onChange({ currentTarget: { files: [file], value: "chosen" } }),
  };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const file = () => new File(["fixture"], "style.png", { type: "image/png" });

test("append mode queues rapid pastes, keeps one pending lock and respects remaining capacity", async () => {
  const finishes = [], h = uploadHarness(() => new Promise(resolve => finishes.push(resolve)), { append: true, referenceCount: 8, maxReferences: 10 });
  const paste = files => h.events.get("paste")({ clipboardData: { files }, preventDefault() {} });
  const first = file(), second = file();
  paste([first]); paste([second]); paste([file()]);
  assert.equal(h.calls.length, 1); assert.match(h.errors.at(-1), /up to 10/);
  finishes[0](image); await flush();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1][0], second);
  assert.deepEqual(h.pending, [true]);
  finishes[1]({ ...image, asset: { ...image.asset, id: "second" } }); await flush();
  assert.deepEqual(h.changes.map(r => r.asset.id), [assetId, "second"]);
  assert.deepEqual(h.pending, [true, false]); h.cleanup();
});

test("a failed later append retains success and unmount stops queued files and late changes", async () => {
  let calls = 0;
  const failed = uploadHarness(async () => { if (++calls === 2) throw Error("Second image failed"); return image; }, { append: true });
  failed.events.get("drop")({ dataTransfer: { files: [file(), file()] }, preventDefault() {} }); await flush();
  assert.deepEqual(failed.changes, [image]); assert.equal(failed.errors.at(-1), "Second image failed"); failed.cleanup();
  let finish;
  const late = uploadHarness(() => new Promise(resolve => { finish = resolve; }), { append: true });
  late.events.get("paste")({ clipboardData: { files: [file(), file()] }, preventDefault() {} });
  late.cleanup(); finish(image); await flush(); assert.equal(late.calls.length, 1); assert.deepEqual(late.changes, []);
});

test("choosing, pasting and dropping an image upload the file for the original owner and expose pending state", async () => {
  for (const input of ["choose", "paste", "drop"]) {
    let resolve;
    const h = uploadHarness(() => new Promise(done => { resolve = done; }));
    const attached = file(); let prevented = false;
    if (input === "choose") h.choose(attached);
    else h.events.get(input)({ ...(input === "paste" ? { clipboardData: { files: [attached] } } : { dataTransfer: { files: [attached] } }), preventDefault() { prevented = true; } });
    assert.equal(h.calls[0][0], attached); assert.equal(h.calls[0][3], "owner");
    assert.deepEqual(h.pending, [true]); assert.deepEqual(h.changes, []);
    if (input !== "choose") assert.equal(prevented, true);
    resolve(image); await flush();
    assert.deepEqual(h.changes, [image]); assert.deepEqual(h.pending, [true, false]); h.cleanup();
  }
});

test("upload failure remains explicit, invalid files never upload, and late results from an unmounted composer are ignored", async () => {
  const failed = uploadHarness(async () => { throw new Error("Storage failed"); });
  failed.choose(file()); await flush();
  assert.equal(failed.errors.at(-1), "Storage failed"); assert.deepEqual(failed.changes, []);
  all(failed.render(), node => node.type === "Button" && node.props.children === "Remove failed reference")[0].props.onClick();
  assert.equal(failed.errors.at(-1), null); failed.cleanup();
  const invalid = uploadHarness(async () => { throw new Error("Must not upload"); });
  invalid.choose(new File(["svg"], "invalid.svg", { type: "image/svg+xml" }));
  assert.equal(invalid.calls.length, 0); assert.match(invalid.errors.at(-1), /JPG, PNG, or WebP/); invalid.cleanup();
  let resolve;
  const late = uploadHarness(() => new Promise(done => { resolve = done; }));
  late.choose(file()); late.cleanup(); resolve(image); await flush();
  assert.deepEqual(late.changes, []);
});
