import assert from "node:assert/strict";
import test from "node:test";
import { validateCreativeOutput } from "./validate-ugc-creative-output.mjs";

const exact = "First line 😅\nSecond line — keep punctuation. café e\u0301";
const wall = () => ({
  status: "ready", production_mode: "clean_plate_plus_overlay",
  visual_direction: { format_mode: "environment_only", scene: "A bakery counter in morning light." },
  ready_video_prompt: "Seven-second vertical smartphone footage of a bakery counter. Gentle drift, consistent objects. No baked-in words or audio.",
  negative_prompt: "No fake UI, captions or warped objects.",
  motion_timeline: [{ start_seconds: 0, end_seconds: 7, action: "Slow continuous drift across the counter." }],
  overlay_render_spec: { exact_text: exact, start_seconds: 0, end_seconds: 7, position: "upper", baked_into_generated_footage: false, screen_anchored: true, fixed_across_cuts: true },
  duration_plan: { duration_seconds: 7, reading_note: "Check final contrast and reading time in the editor." },
  audio_plan: "Silent footage; no final soundtrack requested.", quality_notes: ["Separate exact-text composition required."],
});
const director = () => ({ ready_video_prompt: "Three seconds, natural smartphone close-up. The creator looks at a phone, lifts one brow, tilts their head and holds a small smile. Silent, no baked-in words.", duration_seconds: 3,
  motion_timeline: [{ start_seconds: 0, end_seconds: 0.7, action: "Focused gaze at phone." }, { start_seconds: 0.7, end_seconds: 3, action: "Lift one brow, small head tilt, hold a curious smile." }], overlay_text: exact, audio_plan: "No dialogue, music, voiceover or effects." });
const slideshow = () => ({format: "quick_tips", slides: [
  {role:"cover", presentation_mode:"cover", hook:"Keep each student's notes together", visual_intent:"A tutor reviewing lesson notes."},
  {role:"body", presentation_mode:"numbered_shift", headline:"1. Group notes by student", body_1:"Use a separate group for each student's lessons.", visual_intent:"Real supplied app note groups, if available."},
  {role:"body", presentation_mode:"minimal_statement", headline:"Review the group before the next lesson.", visual_intent:"Tutor preparing a lesson."},
  {role:"cta", presentation_mode:"cta", headline:"Try organizing one student's notes today.", visual_intent:"A notebook and tablet on a simple desk."},
]});

test("all five structured drafting outputs validate with the requested counts", () => {
  validateCreativeOutput("hook", {mode:"generate",hooks:[{text:"Your morning pastry, planned before you leave?",family:"ASK",evidence_status:"user_stated"}]}, {expectedCount:1});
  validateCreativeOutput("wallCopy", {overlay_text:"Keep your lesson notes together by student, so you have a place to review them when preparing the next lesson.", format:"paragraph",evidence_status:"user_stated"});
  validateCreativeOutput("director", director(), {selectedText:exact,expectedDuration:3});
  validateCreativeOutput("wallVideo", wall(), {selectedText:exact,expectedDuration:7});
  validateCreativeOutput("slideshow", slideshow(), {expectedCount:4});
});

test("selected text preserves emoji, punctuation, newlines and Unicode normalization", () => {
  for (const changed of [exact.replace("😅", ""), exact.replace("\n", " "), exact.replace("—", "-"), exact.normalize("NFC")]) {
    const value = wall(); value.overlay_render_spec.exact_text = changed;
    assert.throws(() => validateCreativeOutput("wallVideo", value, {selectedText:exact}), /Selected overlay text/);
    const hook = director(); hook.overlay_text = changed;
    assert.throws(() => validateCreativeOutput("director", hook, {selectedText:exact}), /Selected overlay text/);
  }
});

test("timeline rejects gaps, overlaps, reversed beats and early or late endings", () => {
  for (const timeline of [
    [{start_seconds:1,end_seconds:7,action:"Drift"}],
    [{start_seconds:0,end_seconds:4,action:"Drift"},{start_seconds:3,end_seconds:7,action:"Hold"}],
    [{start_seconds:0,end_seconds:3,action:"Drift"},{start_seconds:3,end_seconds:2,action:"Hold"}],
    [{start_seconds:0,end_seconds:6,action:"Drift"}],
    [{start_seconds:0,end_seconds:8,action:"Drift"}],
  ]) {
    const value=wall(); value.motion_timeline=timeline;
    assert.throws(() => validateCreativeOutput("wallVideo",value), /Timeline/);
  }
});

test("overlay cannot end early, be baked in or contain empty text", () => {
  for (const mutate of [x=>{x.end_seconds=6;},x=>{x.baked_into_generated_footage=true;},x=>{x.exact_text="  ";},x=>{x.start_seconds=1;}]) {
    const value=wall();mutate(value.overlay_render_spec);
    assert.throws(() => validateCreativeOutput("wallVideo",value));
  }
});

test("footage-only draft may omit copy, while a full ready handoff may not", () => {
  const value=wall();value.production_mode="footage_prompt_only";value.overlay_render_spec=null;
  validateCreativeOutput("wallVideo",value);
  value.production_mode="clean_plate_plus_overlay";
  assert.throws(() => validateCreativeOutput("wallVideo",value));
  value.status="needs_upstream_copy";value.ready_video_prompt=null;value.motion_timeline=[];
  validateCreativeOutput("wallVideo",value);
  value.ready_video_prompt="Invented footage prompt";
  assert.throws(() => validateCreativeOutput("wallVideo",value));
});

test("requested duration and number of hooks/slides cannot be silently changed", () => {
  assert.throws(() => validateCreativeOutput("wallVideo",wall(),{expectedDuration:6}), /duration changed/);
  assert.throws(() => validateCreativeOutput("slideshow",slideshow(),{expectedCount:5}), /count changed/);
  assert.throws(() => validateCreativeOutput("hook",{mode:"generate",hooks:[{text:"A grounded question?",family:"ASK",evidence_status:"illustrative"}]},{expectedCount:2}), /count changed/);
});

test("slideshow requires one first cover and populated mode-specific copy", () => {
  for (const mutate of [
    x=>{delete x.slides[0].hook;},
    x=>{x.slides[0].hook="  ";},
    x=>{x.slides.shift();},
    x=>{x.slides.push(structuredClone(x.slides[0]));},
    x=>{delete x.slides[1].body_1;},
    x=>{x.slides[1].presentation_mode="cover";},
    x=>{x.slides[2].role="cta";},
    x=>{x.slides[2].visual_intent="";},
  ]) {const value=slideshow();mutate(value);assert.throws(() => validateCreativeOutput("slideshow",value));}
});

test("routine and educational slides require their explanatory fields", () => {
  const value=slideshow();value.format="goal_based_routine";
  value.slides[1]={role:"body",presentation_mode:"routine_explanation",headline:"Review previous notes",why:"Use the previous lesson as context",cue:"Open that student's note group before planning",visual_intent:"Tutor reviewing a notebook"};
  validateCreativeOutput("slideshow",value);
  for (const field of ["headline","why","cue"]) {const invalid=structuredClone(value);delete invalid.slides[1][field];assert.throws(() => validateCreativeOutput("slideshow",invalid));}
  value.slides[1]={role:"body",presentation_mode:"educational_method",headline:"Group by student",body_1:"Keep related lessons together",example:"One group contains one student's lessons",visual_intent:"Supplied note-group screen"};
  validateCreativeOutput("slideshow",value);
  delete value.slides[1].example;
  assert.throws(() => validateCreativeOutput("slideshow",value));
});

test("unknown payload fields and blank copy are rejected", () => {
  const value=wall();value.duration_seconds=7;
  assert.throws(() => validateCreativeOutput("wallVideo",value));
  assert.throws(() => validateCreativeOutput("wallCopy",{overlay_text:"\n",format:"paragraph",evidence_status:"user_stated"}));
  assert.throws(() => validateCreativeOutput("unknown",{}), /Unknown creative output/);
});
