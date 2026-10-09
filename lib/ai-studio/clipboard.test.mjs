import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { copyAIStudioImage, copyAIStudioPrompt, getAIStudioClipboardError } from "./clipboard.ts";

const globals = ["navigator", "ClipboardItem", "fetch", "createImageBitmap", "document"];
let originals;
beforeEach(() => { originals = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])); });
afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});
function mock(name, value) { Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
function mockImageClipboard(onWrite) {
  mock("ClipboardItem", class { constructor(data) { this.data = data; } });
  mock("navigator", { clipboard: { write: onWrite } });
}

test("prompt copying preserves the complete instruction including line breaks and Unicode", async () => {
  const prompt = `Original prompt\nதமிழ் — ${"All instructions. ".repeat(1500)}`;
  let copied;
  mock("navigator", { clipboard: { writeText: async text => { copied = text; } } });
  await copyAIStudioPrompt(prompt);
  assert.equal(copied, prompt);
});

test("image write starts in the click before the fetch finishes, and writes image bytes", async () => {
  let resolveFetch;
  let writeStarted = false;
  let copied;
  let requestedOptions;
  mockImageClipboard(async items => { writeStarted = true; copied = await items[0].data["image/png"]; });
  mock("fetch", (_url, options) => { requestedOptions = options; return new Promise(resolve => { resolveFetch = resolve; }); });
  const png = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const operation = copyAIStudioImage("https://storage.googleapis.com/example/image.png");
  assert.equal(writeStarted, true, "clipboard write does not wait for network permission or image conversion");
  resolveFetch({ ok: true, blob: async () => png });
  await operation;
  assert.equal(copied, png);
  assert.equal(requestedOptions.credentials, "omit", "cross-origin media requests do not carry credentials");
});

test("JPEG and WebP are converted to PNG at the original dimensions without cropping", async () => {
  for (const type of ["image/jpeg", "image/webp"]) {
    const original = new Blob([type], { type });
    const png = new Blob(["pixel-preserving PNG"], { type: "image/png" });
    let copied;
    let closed = false;
    const bitmap = { width: 720, height: 1280, close: () => { closed = true; } };
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => assert.deepEqual(args, [bitmap, 0, 0]) }), toBlob: (callback, mime) => { assert.equal(mime, "image/png"); callback(png); } };
    mockImageClipboard(async items => { copied = await items[0].data["image/png"]; });
    mock("fetch", async () => ({ ok: true, blob: async () => original }));
    mock("createImageBitmap", async blob => { assert.equal(blob, original); return bitmap; });
    mock("document", { createElement: tag => { assert.equal(tag, "canvas"); return canvas; } });
    await copyAIStudioImage("https://example.com/image");
    assert.equal(copied, png);
    assert.deepEqual([canvas.width, canvas.height], [720, 1280]);
    assert.equal(closed, true);
  }
});

test("unsupported image copying does not fetch or silently replace the clipboard with a URL", async () => {
  let fetched = false;
  let copiedText = false;
  mock("navigator", { clipboard: { writeText: async () => { copiedText = true; } } });
  mock("fetch", async () => { fetched = true; });
  await assert.rejects(copyAIStudioImage("https://example.com/image.png"), /Use Download instead/);
  assert.equal(fetched, false);
  assert.equal(copiedText, false);
});

test("failed media and denied permissions report errors instead of claiming success", async () => {
  mockImageClipboard(async items => { await items[0].data["image/png"]; });
  mock("fetch", async () => ({ ok: false }));
  await assert.rejects(copyAIStudioImage("https://example.com/image.png"), /could not be loaded/);
  const denied = new DOMException("Not allowed", "NotAllowedError");
  mock("navigator", { clipboard: { writeText: async () => { throw denied; } } });
  await assert.rejects(copyAIStudioPrompt("Original prompt"), error => error === denied);
  assert.match(getAIStudioClipboardError(denied, "prompt"), /Clipboard access was blocked/);
  assert.match(getAIStudioClipboardError(new Error("failed"), "image"), /Try again or use Download/);
});
