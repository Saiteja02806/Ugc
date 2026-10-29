import assert from "node:assert/strict";
import test from "node:test";
import { ReferenceTextSchema, RemixRequestSchema, validateRemixDraft, validateRemixOutput, type ReferenceText } from "./reference-text.ts";
import { applyVideoTextRemix } from "./remix-text-edit.ts";
import { readRemixTextDraft } from "./remix-text-draft.ts";
import { remixTextPrompt, remixTextSystemPrompt, remixTextPromptVersion, REMIX_TEXT_SYSTEM_PROMPT } from "./remix-text-prompt.ts";
import { remixInputSource } from "./remix-text-input.ts";
import { parseExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { automaticHookEdit } from "../../worker/src/lib/automatic-hook-text.ts";
import { formatTextLayout } from "../../worker/src/lib/explore-format-edit.ts";
import { wallTextProfile } from "../../worker/src/lib/wall-initial-text-layout.ts";
import referenceCatalog from "./reference-text-catalog.json" with { type: "json" };

const source: ReferenceText = { referenceId: "hook-a", slideId: null, sourceSha256: "a".repeat(64), format: "hook", status: "ready", blocks: [{ text: "The first hook\nwith two lines", startMs: 0, endMs: 2000 }, { text: "The second hook", startMs: 3000, endMs: 4000 }], extractedAt: "2026-10-10T12:00:00Z", model: "reviewed-local-ocr", notes: "" };
const output = { blocks: ["Our first hook\nwith two lines", "Our second hook"], heading: "", body: "" };

test("applying a remix changes only copy on existing overlays and scales new timing", () => {
  const original = parseExploreFormatEdit({ version: 1, format: "hook", trimStartMs: 1000, trimEndMs: 9000, originalVolume: .2, musicVolume: .7, text: { value: "User draft", width: .6, y: .5, fontSize: 60, color: "#ff00ff", startMs: 100, endMs: 1500 } });
  const result = applyVideoTextRemix(original, output, source);
  assert.equal(original.text?.value, "User draft", "input is never mutated");
  assert.deepEqual(result.textOverlays?.[0], { ...original.text, value: output.blocks[0] });
  assert.equal(result.textOverlays?.[1].startMs, 6000); assert.equal(result.textOverlays?.[1].endMs, 8000);
  assert.equal(result.trimStartMs, 1000); assert.equal(result.originalVolume, .2); assert.equal(result.musicVolume, .7);
  assert.throws(() => applyVideoTextRemix({ ...original, format: "wall_text" }, output, source));
});

test("new unstyled Hook remix shares automatic fitting while saved style and Wall defaults stay intact",()=>{
  const value="You're telling me this is\nwhat the cool girls use for\ntheir Pinterest??";
  const s={...source,blocks:[{text:value,startMs:0,endMs:3000}]};
  const o={blocks:[value],heading:"",body:""};
  const empty=parseExploreFormatEdit({version:1,format:"hook",trimStartMs:0,trimEndMs:3000,originalVolume:1,musicVolume:.2,text:null});
  const manual=applyVideoTextRemix(empty,o,s);
  const automatic=automaticHookEdit(o,{version:1,requestKey:"fixture",model:"fixture",systemPrompt:"",userPrompt:"",promptVersion:8,layoutVersion:1,textStyleVersion:1,source:s,businessProfileId:"fixture",businessProfileVersion:1,businessContext:{}},3,"9:16");
  assert.deepEqual(manual,automatic);
  const custom={...manual,textOverlays:manual.textOverlays!.map(t=>({...t,width:.5,x:.3,y:.4,fontSize:30,font:"poppins" as const,fontWeight:700 as const}))};
  const saved=applyVideoTextRemix(custom,{...o,blocks:["Exact new words"]},s);
  assert.deepEqual(saved.textOverlays![0],{...custom.textOverlays[0],value:"Exact new words"});
  assert.equal(custom.textOverlays[0].value,value);
  const wall=applyVideoTextRemix({...empty,format:"wall_text"},o,{...s,format:"wall_text"});
  assert.equal(wall.textOverlays![0].width,.84);assert.equal(wall.textOverlays![0].fontSize,36);
  const landscape=applyVideoTextRemix(empty,o,s,{width:1920,height:1080});
  assert.equal(formatTextLayout(landscape.textOverlays![0],1920,1080).fits,true);
  assert.ok(landscape.textOverlays![0].y*1080+formatTextLayout(landscape.textOverlays![0],1920,1080).lines.length*formatTextLayout(landscape.textOverlays![0],1920,1080).lineHeight<=1080*.72);
});

test("new manual Wall remix uses the reviewed source layout without changing saved styles or clip duration", () => {
  const wall = ReferenceTextSchema.parse(referenceCatalog.items.find(item => item.referenceId === "explore-wall-text-02"));
  const profile = wallTextProfile(wall.referenceId, wall.sourceSha256)!;
  const words = wall.blocks.map(block => block.text);
  const value = { blocks: words, heading: "", body: "" };
  const edit = parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: 12000, originalVolume: .4, musicVolume: .2, text: null });
  const result = applyVideoTextRemix(edit, value, wall);
  assert.equal(result.textOverlays![0].width, profile.width);
  assert.equal(result.textOverlays![0].y, profile.y);
  assert.equal(result.textOverlays![0].color, profile.color);
  assert.equal(result.textOverlays![0].value, words[0]);
  assert.equal(result.textOverlays![0].endMs, 12000);
  assert.equal(result.trimEndMs, 12000);
  const delayed = { ...wall, blocks: wall.blocks.map(block => ({ ...block, startMs: 1000, endMs: 4000 })) };
  assert.equal(applyVideoTextRemix(edit, value, delayed).textOverlays![0].startMs, 3000);
  const custom = { ...result, textOverlays: result.textOverlays!.map(t => ({ ...t, width: .5, y: .3, fontSize: 35 })) };
  assert.deepEqual(applyVideoTextRemix(custom, value, wall).textOverlays, custom.textOverlays);
  const mismatch = { ...wall, sourceSha256: "f".repeat(64) };
  assert.equal(applyVideoTextRemix(edit, value, mismatch).textOverlays![0].width, .84);
  assert.equal(edit.text, null);
});
test("invalid, empty, overlong and cross-format output cannot enter the editor", () => {
  for (const value of [{ ...output, blocks: ["Only one"] }, { ...output, heading: "Unexpected" }, { ...output, blocks: ["", "second"] }, { ...output, blocks: ["x".repeat(100), "y".repeat(100)] }, { ...output, blocks: ["bad\u0001copy", "second"] }]) assert.throws(() => validateRemixOutput(value, source));
  const slide = { ...source, slideId: "slide-1", format: "slideshow" as const, blocks: [{ text: "Original heading\nOriginal body", startMs: null, endMs: null }] };
  assert.throws(() => validateRemixOutput(output, slide));
  assert.deepEqual(validateRemixOutput({ blocks: [], heading: "New heading", body: "New body" }, slide), { blocks: [], heading: "New heading", body: "New body" });
  assert.throws(() => ReferenceTextSchema.parse({ ...source, slideId: "wrong-slide" }));
});

test("a user can expand the generated draft while preserving editor bounds and their chosen preset", () => {
  const expanded = { ...output, blocks: ["a".repeat(150), "b".repeat(150)] };
  assert.throws(() => validateRemixOutput(expanded, source), /too long/);
  assert.deepEqual(validateRemixDraft(expanded, source), expanded);
  assert.throws(() => validateRemixDraft({ ...expanded, blocks: ["a".repeat(601), "b"] }, source));
  const original = parseExploreFormatEdit({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 8000, originalVolume: .2, musicVolume: .7,
    text: { value: "User draft", width: .94, y: .075, fontSize: 56, color: "#ffffff", startMs: 0, endMs: 2000, preset: "snapchat-classic", backgroundOpacity: .4 } });
  const result = applyVideoTextRemix(original, expanded, source);
  assert.ok(result.textOverlays);
  assert.equal(result.textOverlays[0].value, expanded.blocks[0]);
  assert.equal(result.textOverlays[1].preset, "snapchat-classic");
  assert.equal(result.textOverlays[1].backgroundOpacity, .4);
  assert.equal(result.textOverlays[1].startMs, 6000);
});
test("recovery state validates identities and preserves the original request exactly", () => {
  const draft = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, instructions: "Keep the opening", outcome: "uncertain" };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(draft)), draft);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...draft, requestKey: "invalid" })), null);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...draft, businessContext: "foreign client data" })), null);
  assert.equal(readRemixTextDraft("{broken"), null);
  assert.equal(readRemixTextDraft("x".repeat(64001)), null);
});

test("editable prose keeps reference timing, while a custom idea is scoped to one clip", () => {
  const request = { requestKey: "00000000-0000-4000-8000-000000000001", referenceId: "hook-a", slideId: null, format: "hook" as const, instructions: "", referenceBlocks: ["A single revised opening for our business"] };
  const edited = remixInputSource(request, source);
  assert.deepEqual(edited.blocks, [{ text: request.referenceBlocks[0], startMs: 0, endMs: 4000 }]);
  assert.equal(edited.referenceId, source.referenceId); assert.notEqual(edited.sourceSha256, source.sourceSha256);
  const unchanged = remixInputSource({ ...request, referenceBlocks: source.blocks.map(block => block.text) }, source);
  assert.equal(unchanged.sourceSha256, source.sourceSha256);
  assert.deepEqual(unchanged.blocks.map(({ startMs, endMs }) => ({ startMs, endMs })), source.blocks.map(({ startMs, endMs }) => ({ startMs, endMs })));
  const custom = remixInputSource({ ...request, referenceId: null }, null);
  assert.equal(custom.referenceId, "manual:hook"); assert.equal(custom.blocks.length, 1);
  assert.throws(() => remixInputSource({ ...request, referenceId: null, referenceBlocks: undefined }, null));
  assert.throws(() => remixInputSource({ ...request, format: "wall_text" }, source));
});

test("a reviewed draft survives reloads, including unfinished edits, without changing the source identity", () => {
  const saved = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, format: "hook", instructions: "", referenceBlocks: source.blocks.map(block => block.text), outcome: "completed", source, reviewedDraft: output };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(saved)), saved);
  const unfinished = { ...saved, reviewedDraft: { ...output, blocks: ["", "Still editing"] } };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(unfinished)), unfinished);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, source: { ...source, referenceId: "other-hook" } })), null);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, reviewedDraft: { ...output, blocks: ["Wrong block count"] } })), null);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, source: undefined })), null);
});

test("Wall reviewed drafts restore 6000 characters while Hook and Slideshow limits remain unchanged", () => {
  const wallSource = { ...source, referenceId: "manual:wall_text", format: "wall_text", blocks: [{ text: "Reference text", startMs: 0, endMs: 12000 }] };
  const saved = { version: 1, requestKey: "00000000-0000-4000-8000-000000000001", referenceId: null, slideId: null, format: "wall_text", instructions: "", referenceBlocks: ["Reference text"], outcome: "completed", source: wallSource, reviewedDraft: { blocks: ["x".repeat(6000)], heading: "", body: "" } };
  assert.deepEqual(readRemixTextDraft(JSON.stringify(saved)), saved);
  assert.equal(readRemixTextDraft(JSON.stringify({ ...saved, reviewedDraft: { ...saved.reviewedDraft, blocks: ["x".repeat(6001)] } })), null);
  const hook = { ...saved, format: "hook", source: { ...wallSource, referenceId: "manual:hook", format: "hook" } };
  assert.equal(readRemixTextDraft(JSON.stringify({ ...hook, reviewedDraft: { ...hook.reviewedDraft, blocks: ["x".repeat(601)] } })), null);
  assert.ok(readRemixTextDraft(JSON.stringify({ ...hook, reviewedDraft: { ...hook.reviewedDraft, blocks: ["x".repeat(600)] } })));
  const slideshow = { ...saved, format: "slideshow", source: { ...wallSource, referenceId: "manual:slideshow", slideId: "manual-slide", format: "slideshow", blocks: [{ text: "Reference text", startMs: null, endMs: null }] }, reviewedDraft: { blocks: [], heading: "Heading", body: "x".repeat(601) } };
  assert.equal(readRemixTextDraft(JSON.stringify(slideshow)), null);
  assert.ok(readRemixTextDraft(JSON.stringify({ ...slideshow, reviewedDraft: { ...slideshow.reviewedDraft, body: "x".repeat(600) } })));
  assert.ok(readRemixTextDraft(JSON.stringify({ ...saved, reviewedDraft: { blocks: [""], heading: "", body: "" } })));
});
test("provider payload includes verbatim source blocks and server business facts", () => {
  const context = { businessName: "Acme", productSummary: "Helpful product" };
  assert.deepEqual(JSON.parse(remixTextPrompt(source, context, "Keep the structure")), { format: "hook", referenceText: source.blocks.map(b => b.text), businessContext: context, additionalInstructions: "Keep the structure" });
});

test("the retained experimental Hook prompt has source budgets; it is not the application prompt", () => {
  const short = { ...source, blocks: [{ text: "A short hook", startMs: 0, endMs: 3000 }] };
  const longer = { ...source, blocks: [{ text: "a".repeat(100), startMs: 0, endMs: 3000 }] };
  assert.match(remixTextSystemPrompt("hook", short), /^Hard output budget for this request: at most 80 total characters/);
  assert.match(remixTextSystemPrompt("hook", longer), /^Hard output budget for this request: at most 130 total characters/);
  for (const format of ["wall_text", "slideshow"] as const) {
    assert.equal(remixTextSystemPrompt(format, source), format === "wall_text" ? REMIX_TEXT_SYSTEM_PROMPT.replace("each at most 600 characters", "each at most 6000 characters") : REMIX_TEXT_SYSTEM_PROMPT);
    assert.equal(remixTextPromptVersion(format), format === "wall_text" ? 5 : 2);
  }
  assert.equal(remixTextPromptVersion("hook"), 4);
});


test("the single editable remix box accepts copy and guidance up to its shared 6,000-character limit", () => {
  const combined = "Source copy and wording preferences. ".repeat(100);
  const request = { requestKey: "00000000-0000-4000-8000-000000000001", referenceId: source.referenceId, slideId: null, instructions: combined, referenceBlocks: [combined], format: "hook" };
  const parsed = RemixRequestSchema.parse(request);
  assert.equal(parsed.instructions, combined.trim());
  assert.equal(JSON.parse(remixTextPrompt(source, { businessName: "Acme" }, parsed.instructions)).additionalInstructions, combined.trim());
  assert.equal(readRemixTextDraft(JSON.stringify({ version: 1, ...parsed, outcome: "uncertain" }))?.instructions, combined.trim());
  assert.throws(() => RemixRequestSchema.parse({ ...request, instructions: "x".repeat(6001) }));
});
