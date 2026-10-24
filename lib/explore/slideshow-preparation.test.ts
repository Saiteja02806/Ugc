import assert from "node:assert/strict";
import test from "node:test";
import { prepareSlideshowSequence } from "./slideshow-preparation.ts";

test("independent slide work overlaps in pairs while preserving source order and progress", async () => {
  const pending = new Map<number, (value: string) => void>();
  const started: number[] = [], progress: number[] = [];
  const done = prepareSlideshowSequence([0,1,2,3], async index => {
    started.push(index);
    return await new Promise<string>(resolve => pending.set(index, resolve));
  }, completed => progress.push(completed));
  assert.deepEqual(started, [0,1]);
  pending.get(1)!("second"); await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0,1,2]);
  pending.get(2)!("third"); await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0,1,2,3]);
  pending.get(3)!("fourth"); pending.get(0)!("first");
  assert.deepEqual(await done, ["first","second","third","fourth"]);
  assert.deepEqual(progress, [0,1,2,3,4]);
});

test("a failed slide stops new work and waits for the other upload before releasing the save", async () => {
  let finishOther!: (value: number) => void;
  const started: number[] = [];
  let settled = false;
  const done = prepareSlideshowSequence([0,1,2], async index => {
    started.push(index);
    if (index === 0) throw new Error("Upload failed");
    return await new Promise<number>(resolve => { finishOther = resolve; });
  });
  const rejected = done.then(() => assert.fail("Expected failure"), error => { settled = true; assert.equal(error.message, "Upload failed"); });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(settled, false); assert.deepEqual(started, [0,1]);
  finishOther(1); await rejected; assert.equal(settled, true);
});
