import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { addSavedCaption, EMPTY_CAPTION_LIBRARY, initialSavedCaption, parseSavedCaptionLibrary, removeSavedCaption } from "./saved-captions.ts";

const A = "00000000-0000-4000-8000-000000000001", B = "00000000-0000-4000-8000-000000000002";
const exact = "  A caption\n\nhttps://getugcpilot.com\n#BuildInPublic 🚀  ";
test("captions preserve exact wording, line breaks and links; defaults and deletion are independent of the post", () => {
  const first = addSavedCaption(EMPTY_CAPTION_LIBRARY, exact, A);
  assert.equal(first.defaultId, A); assert.equal(first.captions[0].text, exact);
  assert.equal(addSavedCaption(first, exact, B), first);
  const second = addSavedCaption(first, "Another caption", B);
  assert.equal(second.defaultId, A); assert.equal(second.captions.length, 2);
  assert.equal(initialSavedCaption(second, "", false), exact);
  assert.equal(initialSavedCaption(second, "existing draft", false), null);
  assert.equal(initialSavedCaption(second, "", true), null);
  const removed = removeSavedCaption(second, A);
  assert.equal(removed.defaultId, null); assert.equal(removed.captions.length, 1);
  assert.equal(second.captions[0].text, exact, "Deleting from the library does not mutate a post or the old snapshot");
});
test("invalid IDs, defaults, duplicates, blank/oversized captions and excess entries fail closed", () => {
  const one = addSavedCaption(EMPTY_CAPTION_LIBRARY, exact, A);
  for (const input of [null, { ...one, userId: "other" }, { ...one, revision: -1 }, { ...one, defaultId: B },
    { ...one, captions: [{ id: A, text: " " }] }, { ...one, captions: [{ id: A, text: "x".repeat(5001) }] },
    { ...one, captions: [one.captions[0], one.captions[0]] }, { ...one, captions: [...one.captions, { id: B, text: exact }] },
    { ...one, captions: Array.from({ length: 21 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, text: String(i) })) }]) assert.throws(() => parseSavedCaptionLibrary(input));
});

let owner, rows, accesses, fail;
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
class SavedCaptionConflictError extends Error {}
mock.module("../firebase/server-auth.ts", { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => { if (!owner) throw new FirebaseAuthRequestError("Sign in"); return { uid: owner }; } } });
mock.module("./saved-captions-db.ts", { namedExports: {
  SavedCaptionConflictError,
  getSavedCaptions: async id => { accesses.push(id); if (fail) throw new Error("Private database details"); return rows.get(id) ?? EMPTY_CAPTION_LIBRARY; },
  saveCaptionLibrary: async (id, value) => { accesses.push(id); if (fail) throw new Error("Private database details"); if ((rows.get(id)?.revision ?? 0) !== value.revision) throw new SavedCaptionConflictError("Changed in another tab"); const next = { ...value, revision: value.revision + 1 }; rows.set(id, next); return next; },
} });
const { GET, PUT } = await import("../../app/api/account/saved-captions/route.ts");
const request = value => new Request("https://www.getugcpilot.com/api/account/saved-captions", { method: "PUT", body: typeof value === "string" ? value : JSON.stringify(value) });
beforeEach(() => { owner = "owner-a"; rows = new Map(); accesses = []; fail = false; });
test("API authenticates, isolates accounts and rejects stale concurrent updates without overwriting", async () => {
  const first = addSavedCaption(EMPTY_CAPTION_LIBRARY, exact, A);
  const save = await PUT(request(first)); assert.equal(save.status, 200);
  assert.equal((await save.json()).library.revision, 1);
  assert.equal((await PUT(request(first))).status, 409);
  const get = await GET(request(null)); assert.equal(get.headers.get("cache-control"), "private, no-store"); assert.equal(get.headers.get("vary"), "Authorization");
  assert.equal((await get.json()).library.captions[0].text, exact);
  owner = "owner-b"; assert.deepEqual((await (await GET(request(null))).json()).library, EMPTY_CAPTION_LIBRARY);
  owner = null; const count = accesses.length;
  assert.equal((await GET(request(null))).status, 401); assert.equal((await PUT(request(first))).status, 401); assert.equal(accesses.length, count);
});
test("invalid and oversized API updates never reach storage; failures retain generic safe messages", async () => {
  assert.equal((await PUT(request({ ...EMPTY_CAPTION_LIBRARY, userId: "other" }))).status, 400);
  assert.equal((await PUT(request("not json"))).status, 400);
  assert.equal((await PUT(request(" ".repeat(650001)))).status, 413);
  assert.equal(accesses.length, 0);
  fail = true; const response = await PUT(request(EMPTY_CAPTION_LIBRARY));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /Private database/);
});
