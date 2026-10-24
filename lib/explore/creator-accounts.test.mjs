import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock, test } from "node:test";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";
import { getCreatorAccounts, getCreatorAccountSource, readCreatorAccountMedia, getCreatorAccountText } from "./creator-accounts.ts";
import { ReferenceTextSchema } from "./reference-text.ts";
import { createHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";

const allowed = { uid: "pilot-owner", email: "vtu19403@veltech.edu.in", emailVerified: true };
const privateFixtureAvailable = getCreatorAccounts(allowed).length > 0;
const requiresPrivateFixture = { skip: !privateFixtureAvailable && "Private creator fixtures or package key are unavailable in this public clone." };
let actor = allowed, authenticatedReads = 0;
class FirebaseAuthRequestError extends Error { constructor() { super("Sign in"); this.status = 401; } }
mock.module(new URL("../firebase/server-auth.ts", import.meta.url), { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async () => { authenticatedReads++; if (!actor) throw new FirebaseAuthRequestError(); return actor; },
} });
mock.module(new URL("../ai-studio/server-access.ts",import.meta.url),{namedExports:{requireAIStudioProUser:async()=>actor}});
mock.module(new URL("../firebase/auth.ts",import.meta.url),{namedExports:{getCurrentUserIdToken:async()=>assert.fail("No browser auth call")}});
const { GET: catalog } = await import("../../app/api/explore/creator-accounts/route.ts");
const { GET: media } = await import("../../app/api/explore/creator-media/[referenceId]/route.ts");
const request = (id = "creator-account-1-01", variant = "video") => new Request(`https://www.getugcpilot.com/api/explore/creator-media/${id}?variant=${variant}`);
const context = (id = "creator-account-1-01") => ({ params: Promise.resolve({ referenceId: id }) });

test("only the verified pilot email receives creator metadata", () => {
  for (const user of [null, {}, { ...allowed, emailVerified: false }, { ...allowed, email: "other@example.com" }]) {
    assert.equal(canAccessCreatorAccounts(user), false); assert.deepEqual(getCreatorAccounts(user), []);
  }
  assert.equal(canAccessCreatorAccounts({ ...allowed, email: " VTU19403@VELTECH.EDU.IN " }), true);
  const accounts = getCreatorAccounts(allowed);
  if (!privateFixtureAvailable) { assert.deepEqual(accounts, []); return; }
  assert.deepEqual(accounts.map(account => [account.id, account.items.length]), [["creator-account-1", 6], ["creator-account-2", 6]]);
  assert.equal(new Set(accounts.flatMap(account => account.items.map(item => item.id))).size, 12);
});

test("all 24 private assets match the imported manifest and every video has a first frame", requiresPrivateFixture, async () => {
  const { getHookSourceFrame } = await import("./hook-source-frame.ts");
  for (const account of getCreatorAccounts(allowed)) for (const item of account.items) {
    const source = getCreatorAccountSource(item.id);
    const video = await readCreatorAccountMedia(item.id, "video"), poster = await readCreatorAccountMedia(item.id, "poster");
    assert.equal(createHash("sha256").update(video.bytes).digest("hex"), item.sourceSha256);
    const frame = await getHookSourceFrame(item.id);
    assert.equal(frame.frameIndex, source.startingFrame.index); assert.equal(frame.sourceSha256, item.sourceSha256);
    assert.equal(frame.frameSha256, source.startingFrame.sha256); assert.equal(createHash("sha256").update(frame.png).digest("hex"),source.startingFrame.sha256);
    assert.equal(createHash("sha256").update(poster.bytes).digest("hex"),source.posterSha256);
    assert.equal(frame.width, source.width); assert.equal(frame.height, source.height);
    const text = ReferenceTextSchema.parse(getCreatorAccountText(item.id, allowed));
    assert.equal(text.sourceSha256, item.sourceSha256); assert.ok(text.blocks[0].text);
    assert.equal(getCreatorAccountText(item.id, { ...allowed, email: "other@example.com" }), null);
    const draft = createHookKeyframeDraft({ ownerId: allowed.uid, referenceId: item.id, sourceSha256: item.sourceSha256, draftId: "11111111-1111-4111-8111-111111111111" });
    const preview = getHookKeyframePromptPreview(draft, "hook", item.generationPrompt);
    assert.ok(preview.directions); assert.equal(preview.animationError, null); assert.ok(preview.animationPrompt);
  }
  for (const id of ["../../.env.local", "creator-account-3-01", "creator-account-1-99"]) assert.equal(await readCreatorAccountMedia(id, "video"), null);
});

test("catalogue and bytes recheck identity for each request, including repeated reads", async () => {
  for (actor of [null, { ...allowed, email: "other@example.com" }, { ...allowed, emailVerified: false }]) {
    const response = await catalog(new Request("https://www.getugcpilot.com/api/explore/creator-accounts"));
    if (actor) assert.deepEqual((await response.json()).accounts, []); else assert.equal(response.status, 401);
    assert.equal((await media(request(), context())).status, 404);
  }
  actor = allowed;
  const visible = await catalog(new Request("https://www.getugcpilot.com/api/explore/creator-accounts"));
  if (!privateFixtureAvailable) {
    assert.deepEqual((await visible.json()).accounts, []);
    assert.equal((await media(request(), context())).status, 404);
    return;
  }
  assert.equal((await visible.json()).accounts.length, 2);
  assert.equal(visible.headers.get("cache-control"), "private, no-store");
  const before = authenticatedReads;
  for (let i = 0; i < 2; i++) {
    const response = await media(request(), context());
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "video/mp4");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  assert.equal(authenticatedReads, before + 2);
  assert.equal((await media(request(undefined, "poster"), context())).headers.get("content-type"), "image/png");
  assert.equal((await media(request(undefined, "other"), context())).status, 400);
  assert.equal((await media(request("creator-account-1-99"), context("creator-account-1-99"))).status, 404);
});

test("private caption reads require the pilot identity and the exact workflow/slide", async () => {
  const { getReferenceText } = await import("./reference-text-store.ts");
  for (const identity of [undefined, { ...allowed, email: "other@example.com" }, { ...allowed, emailVerified: false }]) assert.throws(() => getReferenceText("creator-account-1-01", null, "hook", identity));
  assert.throws(() => getReferenceText("creator-account-1-01", "foreign-slide", "hook", allowed));
  assert.throws(() => getReferenceText("creator-account-1-01", null, "wall_text", allowed));
  if (!privateFixtureAvailable) { assert.equal(getReferenceText("creator-account-1-01", null, "hook", allowed), null); return; }
  assert.equal(getReferenceText("creator-account-1-01", null, "hook", allowed).status, "ready");
});

test("retained private frame-zero source previews are served and verified exactly while new preparation uses the clearer binding",requiresPrivateFixture,async()=>{
  const {handleHookStartingFrame}=await import("./hook-source-frame-api.ts");
  const {readVerifiedHookStartingFrame}=await import("./hook-starting-frame-client.ts");
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION="true";actor=allowed;
  for(const account of getCreatorAccounts(allowed))for(const item of account.items){
    const source=getCreatorAccountSource(item.id),retainedFrame={index:0,timeSeconds:0,sha256:source.posterSha256,width:source.width,height:source.height};
    const request=(extra={})=>new Request("https://www.getugcpilot.com/api/explore/hook-starting-frame",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({referenceId:item.id,...extra})});
    const old=await handleHookStartingFrame(request({sourceFrameSha256:source.posterSha256}));
    assert.equal(old.status,200);const verified=await readVerifiedHookStartingFrame(old,{referenceId:item.id,sourceSha256:item.sourceSha256,retainedFrame});assert.deepEqual(verified.frame,retainedFrame);
    const current=await handleHookStartingFrame(request());assert.equal(current.status,200);assert.equal(current.headers.get("x-hook-frame-sha256"),source.startingFrame.sha256);
    assert.equal((await handleHookStartingFrame(request({sourceFrameSha256:"f".repeat(64)}))).status,404);
    actor={...allowed,email:"other@example.com"};assert.equal((await handleHookStartingFrame(request({sourceFrameSha256:source.posterSha256}))).status,404);actor=allowed;
  }
});
