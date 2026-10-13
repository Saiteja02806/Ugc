import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { ClipDraftSaveSession, loadClipDraft, saveClipDraft, clipDraftPendingKey } from "./clip-draft-client.ts";
import { parseClipDraftContent, parseClipDraftReceipt, ExploreClipDraftError } from "./clip-draft-contract.ts";

const source = "11111111-1111-4111-8111-111111111111", audio = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333", requestId = "44444444-4444-4444-8444-444444444444";
const draftId = "55555555-5555-4555-8555-555555555555", scope = "hook";
const overlay = { value: "Exact text\nwith a second line.", width: .8, y: .35, fontSize: 48, color: "#ffffff", startMs: 0, endMs: 2500 };
const content = { version: 1, sourceAssetId: source, editing: { version: 1, format: "hook", trimStartMs: 500, trimEndMs: 3500,
  originalVolume: .6, musicVolume: .2, text: null, textOverlays: [overlay, { ...overlay, value: "", startMs: 2500, endMs: 3000 }] },
  backgroundAssetId: audio, backgroundPlayback: "repeat" };
const saved = (value = content, revision = 1) => ({ id: draftId, scope, revision, content: value, updatedAt: "2026-10-13T00:00:00Z" });

test("clip draft retains exact text, blank blocks, timing, trim and sound without exporting", () => {
  assert.deepEqual(parseClipDraftContent(content), content);
  assert.deepEqual(parseClipDraftReceipt(saved(), source, scope), saved());
  for (const change of [{ sourceAssetId: "https://untrusted/video.mp4" }, { backgroundAssetId: other, backgroundPlayback: "forever" }, { url: "https://untrusted" }])
    assert.throws(() => parseClipDraftContent({ ...content, ...change }));
  assert.throws(() => parseClipDraftReceipt(saved(), other, scope));
  assert.notEqual(clipDraftPendingKey("owner-a", scope, source), clipDraftPendingKey("owner-b", scope, source));
  const demo = { ...content, framing: { version: 1, width: .8, height: .8, points: [[0, .1, .1], [5000, .18, .18]] },
    workflowMusic: { enabled: true, assetId: audio, playback: "repeat" } };
  assert.deepEqual(parseClipDraftContent(demo), demo);
  assert.throws(() => parseClipDraftContent({ ...demo, framing: { ...demo.framing, points: [[0, .8, .8]] } }));
  assert.throws(() => parseClipDraftContent({ ...demo, workflowMusic: { enabled: true, assetId: "https://unowned", playback: "once" } }));
});

test("lost save response retries the exact request before accepting newer text", async () => {
  let persisted, calls = [], count = 0;
  const identities = [requestId, draftId];
  const session = new ClipDraftSaveSession(0, scope, source, value => { persisted = value; }, null, () => identities.shift());
  const send = async request => { calls.push(structuredClone(request)); if (!count++) throw new Error("lost reply"); return saved(request.content, request.expectedRevision + 1); };
  await assert.rejects(session.save(content, send), /lost reply/);
  assert.equal(persisted.requestId, requestId);
  const changed = { ...content, editing: { ...content.editing, originalVolume: .8 } };
  await session.save(changed, send);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[2].expectedRevision, 1);
  assert.notEqual(calls[2].requestId, calls[1].requestId);
  assert.deepEqual(calls[2].content, changed);
  assert.equal(persisted, null);
});

test("reload recovers an ambiguous save; mismatched replies and stale revisions never mark saved", async () => {
  const pending = { scope, requestId, expectedRevision: 0, content };
  const session = new ClipDraftSaveSession(1, scope, source, () => {}, pending);
  assert.deepEqual(await session.save(content, async input => { assert.deepEqual(input, pending); return saved(); }), saved());
  const mismatch = new ClipDraftSaveSession(0, scope, source, () => {}, null, () => requestId);
  await assert.rejects(mismatch.save(content, async () => saved({ ...content, backgroundAssetId: null, backgroundPlayback: "once" })), /verify/);
  const stale = new ClipDraftSaveSession(0, scope, source, () => {}, null, () => requestId);
  await assert.rejects(stale.save(content, async () => { throw new ExploreClipDraftError("changed", 409, "clip_draft_changed"); }));
  let sends = 0;
  await assert.rejects(stale.save(content, async () => { sends++; return saved(); }), /another session/);
  assert.equal(sends, 0);
});

test("draft transport uses one JSON save endpoint; mounting/loading only reads", async () => {
  const calls = [];
  const deps = { token: async () => "local-test-token", fetch: async (url, init) => { calls.push({ url, init });
    return Response.json({ ok: true, draft: saved(), requestId, replayed: false }); } };
  await loadClipDraft(deps, source, scope);
  await saveClipDraft(deps, { scope, requestId, expectedRevision: 0, content });
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, "/api/explore/clip-drafts");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.headers["Idempotency-Key"], requestId);
  assert.deepEqual(JSON.parse(calls[1].init.body).content, content);
  assert.ok(calls.every(call => !String(call.url).includes("finishes")));
});

test("real Postgres draft migration verifies ownership, CAS, replay and creates no render work", async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.media_assets(id uuid primary key, user_id text, collection text, status text, deleted_at timestamptz,
      metadata jsonb default '{}', duration_seconds numeric);
    insert into public.media_assets values('${source}','owner-a','video','ready',null,'{}',5),
      ('${audio}','owner-a','audio','ready',null,'{}',12),('${other}','owner-b','video','ready',null,'{}',5);
    grant select on public.media_assets to service_role;`);
  await db.exec(await readFile(new URL("../../supabase/migrations/20261012212314_explore_clip_draft_saves.sql", import.meta.url), "utf8"));
  const save = async (owner, id, revision, value = content) => (await db.query(
    "select public.explore_save_clip_draft($1,$2,$3,$4,$5,$6) as receipt",
    [owner, scope, value.sourceAssetId, id, revision, JSON.stringify(value)])).rows[0].receipt;
  const first = await save("owner-a", requestId, 0);
  assert.equal(first.draft.revision, 1); assert.equal(first.replayed, false); assert.deepEqual(first.draft.content, content);
  assert.deepEqual(await save("owner-a", requestId, 0), { ...first, replayed: true });
  await assert.rejects(save("owner-a", requestId, 0, { ...content, backgroundAssetId: null, backgroundPlayback: "once" }), /clip_draft_request_conflict/);
  await assert.rejects(save("owner-a", draftId, 0), /clip_draft_changed/);
  await assert.rejects(save("owner-b", draftId, 0), /clip_draft_asset_unavailable/);
  await assert.rejects(save("owner-a", draftId, 0, { ...content, sourceAssetId: other }), /clip_draft_asset_unavailable/);
  const changed = { ...content, editing: { ...content.editing, originalVolume: .8 } };
  const next = await save("owner-a", draftId, 1, changed); assert.equal(next.draft.revision, 2);
  // Accepted receipts remain replayable after a later revision and source removal.
  await db.exec(`update public.media_assets set deleted_at=now() where id='${source}';`);
  assert.deepEqual(await save("owner-a", requestId, 0), { ...first, replayed: true });
  const tables = (await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(row => row.tablename).sort();
  assert.deepEqual(tables, ["explore_clip_draft_saves", "explore_clip_drafts", "media_assets"]);
  await db.exec("set role authenticated");
  await assert.rejects(db.query("select * from public.explore_clip_drafts"), /permission denied/);
  await assert.rejects(save("owner-a", requestId, 0), /permission denied/);
  await db.exec("reset role; set role service_role");
  const rows = (await db.query("select revision from public.explore_clip_drafts")).rows;
  assert.equal(rows[0].revision, 2);
});
