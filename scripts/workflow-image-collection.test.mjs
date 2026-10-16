import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function fixture(limit = 6, ownedRead = async id => ({ id, title: "Saved image", url: "https://owned.test/saved.png" })) {
  let cursor = 0, result, nextUrl = 0;
  const slots = [], effects = [], revoked = [], imageReads = [];
  const depsChanged = (previous, next) => !previous || next.some((value, index) => !Object.is(previous[index], value));
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(create, dependencies) { const index = cursor++, previous = slots[index]; if (depsChanged(previous?.dependencies, dependencies)) {
      slots[index] = { dependencies }; effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = create(); });
    } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/use-local-workflow-images.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, require: name => { if (name === "@/lib/explore/format-reference-images") return { fetchFormatReferenceImage: (...args) => ownedRead(...args) }; assert.equal(name, "react"); return react; },
    URL: { createObjectURL: file => `blob:${++nextUrl}:${file.name}`, revokeObjectURL: url => revoked.push(url) },
    Image: class { set src(value) { imageReads.push({ url: value, load: () => this.onload(), fail: () => this.onerror() }); } },
  });
  return { revoked, imageReads, render() { cursor = 0; result = exports.useLocalWorkflowImages(limit); while (effects.length) effects.shift()(); return result; },
    setLimit(value) { limit = value; }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}
const file = name => new File(["image bytes"], name, { type: "image/png" });
const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

test("image uploads append in order, keep the first creator compatibility field and revoke only removed previews", async () => {
  const h = fixture();
  let input = h.render(); const first = input.choose(file("first.png")); h.imageReads[0].load(); assert.equal(await first, true);
  input = h.render(); const firstUrl = input.asset.url;
  const second = input.choose(file("second.png")); h.imageReads[1].load(); assert.equal(await second, true);
  input = h.render(); assert.deepEqual(Array.from(input.assets, image => image.name), ["first.png", "second.png"]);
  assert.equal(input.asset.url, firstUrl); assert.deepEqual(h.revoked, []);
  input.removeImage(firstUrl); input = h.render();
  assert.equal(input.asset.name, "second.png"); assert.deepEqual(h.revoked, [firstUrl]);
  h.unmount(); assert.equal(h.revoked.length, 2);
});

test("saved images are verified under their owner, appended without uploads and fenced when removed", async () => {
  const reads = []; let resolve;
  const h = fixture(6, (id, owner) => { reads.push([id, owner]); return new Promise(done => { resolve = done; }); });
  const saved = { id: "saved-image", title: "Product", url: "https://old.test/image.png" };
  let pending = h.render().chooseSavedImage(saved, "owner-a");
  assert.equal(h.render().loading, true);
  assert.deepEqual(reads, [[saved.id, "owner-a"]]);
  resolve({ ...saved, url: "https://owned.test/current.png" }); assert.equal(await pending, true);
  let value = h.render(); assert.equal(value.asset.assetId, saved.id); assert.equal(value.asset.url, "https://owned.test/current.png");
  assert.equal(value.asset.file, undefined); assert.equal(h.imageReads.length, 0);
  assert.equal(await value.chooseSavedImage(saved, "owner-a"), true); assert.equal(h.render().assets.length, 1);
  value.remove(); pending = h.render().chooseSavedImage(saved, "owner-a");
  h.render().remove(); resolve(saved); assert.equal(await pending, false); assert.equal(h.render().assets.length, 0);
});

test("a rejected saved image retains the earlier reference and blocks generation with an error", async () => {
  const h = fixture(6, async () => { throw Error("This image is no longer available."); });
  h.render().chooseLibraryImage({ name: "Creator", url: "/ai-studio/creator-references/creator-01.png" });
  assert.equal(await h.render().chooseSavedImage({id:"removed"}, "owner"), false);
  assert.equal(h.render().assets.length, 1); assert.match(h.render().error, /no longer available/);
});

test("multiple selection is atomic; a corrupt second image retains the earlier collection and stops generation", async () => {
  const h = fixture(); let input = h.render();
  input.chooseLibraryImage({ name: "Creator", url: "/ai-studio/creator-references/creator-01.png" }); input = h.render();
  const selecting = input.chooseFiles([file("good.png"), file("bad.png")]);
  assert.equal(h.render().loading, true); h.imageReads[0].load(); await settle(); h.imageReads[1].fail();
  assert.equal(await selecting, false); input = h.render();
  assert.equal(input.assets.length, 1); assert.equal(input.assets[0].name, "Creator");
  assert.match(input.error, /could not be previewed/); assert.equal(input.loading, false);
  assert.equal(h.revoked.length, 2);
  input.remove(); assert.equal(h.render().error, null);
});

test("catalogue images append without duplicates and new model limits preserve every selected image for removal", async () => {
  const h = fixture(); let input = h.render();
  for (const number of [1, 2, 1]) {
    input.chooseLibraryImage({ name: `Creator ${number}`, url: `/ai-studio/creator-references/creator-0${number}.png` }); input = h.render();
  }
  assert.equal(input.assets.length, 2);
  h.setLimit(2); input = h.render();
  input.chooseLibraryImage({ name: "Third", url: "/ai-studio/creator-references/creator-03.png" }); input = h.render();
  assert.equal(input.assets.length, 2); assert.match(input.error, /up to 2/);
  h.setLimit(1); input = h.render(); assert.equal(input.assets.length, 2, "A model change never silently removes a reference");
  assert.equal(await input.choose(file("third.png")), false);
  assert.equal(h.imageReads.length, 0);
  input.removeImage(input.assets[0].url); assert.equal(h.render().error, null);
});

test("remove and owner unmount discard a late file read without revoking retained images", async () => {
  for (const ending of ["remove", "unmount"]) {
    const h = fixture(); const input = h.render(); const choosing = input.choose(file("late.png"));
    if (ending === "remove") input.remove(); else h.unmount();
    h.imageReads[0].load(); assert.equal(await choosing, false);
    assert.equal(h.render().assets.length, 0); assert.equal(h.revoked.length, 1);
  }
});

test("remote image download is pending from the initial click and cannot restore a removed selection", async () => {
  const h = fixture(); const input = h.render(); let resolve;
  const choosing = input.chooseRemote(() => new Promise(done => { resolve = done; }));
  assert.equal(h.render().loading, true); input.remove(); resolve(file("late.png"));
  assert.equal(await choosing, false); assert.equal(h.imageReads.length, 0);
});
