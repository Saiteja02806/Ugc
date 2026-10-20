import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as contract from "../worker/dist/lib/explore-finishing-contract.js";
const source = readFileSync(new URL("../components/explore/demo-framing-recording.ts", import.meta.url), "utf8"), exported = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: exported, require: name => { assert.equal(name, "@/worker/src/lib/explore-finishing-contract"); return contract; }, Error,
});
const frame = { version: 1, width: .3, height: 1, points: [[0, 0, 0], [10000, 0, 0], [12000, .7, 0], [14000, .7, 0]] };
test("single-clip framing accepts a prepared video, rejects duplicate composition and leaves legacy drafts unchanged", () => {
  const draft = { version: 1, kind: "hook", sourceAssetId: "00000000-0000-4000-8000-000000000001", demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null };
  assert.deepEqual(contract.parseExploreFinishDraft(draft), draft);
  assert.deepEqual(contract.parseExploreFinishDraft({ ...draft, sourceFraming: frame }).sourceFraming, frame);
  for (const patch of [{ kind: "phone" }, { demoAssetId: draft.sourceAssetId }, { demoFraming: frame }, { subtitles: { language: "en", style: "clean" } }, { editing: {} }]) {
    assert.throws(() => contract.parseExploreFinishDraft({ ...draft, sourceFraming: frame, ...patch }), /Single-clip framing/);
  }
});
test("preview holds the left for ten seconds and shows every intermediate position during the drag", () => {
  const parsed = contract.parseDemoFraming(frame);
  assert.deepEqual(contract.demoFramingPosition(parsed, 9999), { x: 0, y: 0 });
  assert.equal(contract.demoFramingPosition(parsed, 11000).x, .35);
  assert.equal(contract.demoFramingPosition(parsed, 20000).x, .7);
  for (let time = 10001; time < 12000; time += 33) assert.ok(contract.demoFramingPosition(parsed, time).x < contract.demoFramingPosition(parsed, time + 33).x);
});
test("invalid, out-of-bounds, excessive and unordered paths are rejected instead of clipped into a different edit", () => {
  for (const patch of [{ points: [[1, 0, 0]] }, { points: [[0, -.1, 0]] }, { points: [[0, .8, 0]] }, { points: [[0, 0, 1]] },
    { points: [[0, 0, 0], [0, .2, 0]] }, { points: [[0, 0, 0], [120001, .2, 0]] }, { points: [[0, NaN, 0]] },
    { width: 0 }, { height: Infinity }, { command: "untrusted-filter" }, { points: Array.from({ length: 513 }, (_, i) => [i, 0, 0]) }]) {
    assert.throws(() => contract.parseDemoFraming({ ...frame, ...patch }));
  }
});
test("recording preserves holds and drag speed while compacting stationary and straight motion samples", () => {
  const recording = new exported.DemoFramingRecording({ ...frame, points: [[0, 0, 0]] });
  for (let time = 0; time <= 14000; time += 20) recording.sample(time, contract.demoFramingPosition(frame, time).x, 0);
  const saved = recording.finish(14000);
  assert.ok(saved.points.length < 10);
  for (let time = 0; time <= 14000; time += 100) assert.ok(Math.abs(contract.demoFramingPosition(saved, time).x - contract.demoFramingPosition(frame, time).x) < .001);
  assert.throws(() => recording.sample(1000, .5, 0), /Playback moved/);
});
test("maximum bounded expression uses a shallow numeric-only tree and legacy drafts remain unchanged", () => {
  const maximum = contract.parseDemoFraming({ ...frame, points: Array.from({ length: 512 }, (_, i) => [i * 200, i % 2 ? .7 : 0, 0]) });
  const expression = contract.demoFramingExpression(maximum, 1, 960);
  assert.ok(expression.length < 60000); assert.doesNotMatch(expression, /[;\[\]"\\]/);
  assert.match(expression, /clip\(\(t-/);
  assert.equal(contract.demoFramingExpression({ ...frame, points: [[0, .5, 0]] }, 1, 960), "480");
});

test("a full two-minute drag remains bounded at high mouse polling rates and retains export-frame positions", () => {
  const recording = new exported.DemoFramingRecording({ ...frame, points: [[0, 0, 0]] });
  for (let time = 0; time <= 120000; time += 4) recording.sample(time, .7 * time / 120000, 0);
  const saved = recording.finish(120000);
  assert.ok(saved.points.length < 10);
  assert.equal(saved.points.at(-1)[0],120000);
  for (let i=0;i<=3600;i++) {
    const time=Math.round(i*1000/30);
    assert.ok(Math.abs(contract.demoFramingPosition(saved,time).x-.7*time/120000)<.001);
  }
});

test("finishing between export frames retains the final hold and backwards seeks are rejected", () => {
  const recording=new exported.DemoFramingRecording({...frame,points:[[0,0,0]]});
  recording.sample(500,.25,0); recording.sample(501,.25,0);
  assert.throws(()=>recording.sample(499,.1,0),/Playback moved/);
  const saved=recording.finish(1001);
  assert.equal(saved.points.at(-1)[0],1001);
  assert.ok(Math.abs(contract.demoFramingPosition(saved,1001).x-.25)<1e-6);
});
