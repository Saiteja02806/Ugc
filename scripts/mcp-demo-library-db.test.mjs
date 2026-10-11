import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const baseline = readFileSync(new URL("../supabase/migrations/20260829093001_production_baseline_v1.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261011142003_mcp_demo_library.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function setup() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const table of ["media_assets", "demo_videos"]) {
    const start = baseline.indexOf(`CREATE TABLE "public"."${table}" (`);
    assert.ok(start >= 0);
    await db.exec(baseline.slice(start, baseline.indexOf("\n);", start) + 3));
    await db.exec(`alter table public.${table} enable row level security; grant all on public.${table} to service_role;`);
  }
  await db.exec(migration);
  return db;
}
async function upload(db, n, overrides = {}) {
  const values = { user_id: "owner-a", collection: "video", source_type: "upload", status: "ready",
    file_size_bytes: 1024, duration_seconds: 12, mime_type: "video/mp4", width: 720, height: 1280,
    metadata: { mcpUpload: true }, ...overrides };
  const columns = ["id", "title", "file_name", "storage_key", "url", ...Object.keys(values)];
  const row = [id(n), "Product tour", "tour.mp4", `media/owner-a/video/${id(n)}.mp4`, `https://cdn.example.test/${id(n)}.mp4`, ...Object.values(values)];
  await db.query(`insert into media_assets (${columns.join(",")}) values (${row.map((_, i) => `$${i + 1}`).join(",")})`, row);
}
const register = (db, n, owner = "owner-a", project = "test-project-001") => db.query("select mcp_register_demo($1,$2,$3) as result", [owner, id(n), project]);
const remove = (db, n, owner = "owner-a", project = "test-project-001") => db.query("select mcp_delete_demo($1,$2,$3) as result", [owner, id(n), project]);

test("real baseline tables: registration preserves identity, publishes Demo classification, and replay preserves editor changes", async () => {
  const db = await setup();
  try {
    await upload(db, 1);
    const first = (await register(db, 1)).rows[0].result;
    assert.deepEqual(first, { demo_id: id(1), asset_id: id(1), project_id: "test-project-001" });
    const media = (await db.query("select * from media_assets")).rows[0];
    assert.equal(media.source_type, "demo_upload"); assert.equal(media.source_record_id, id(1));
    assert.equal(media.metadata.mcpUpload, true); assert.equal(media.metadata.mcpDemo, true);
    await db.query("update demo_videos set title='Website edit', status='draft', draft_json='{\"edited\":true}' where id=$1", [id(1)]);
    assert.deepEqual((await register(db, 1)).rows[0].result, first);
    const demo = (await db.query("select * from demo_videos")).rows[0];
    assert.equal(demo.title, "Website edit"); assert.equal(demo.status, "draft"); assert.equal(demo.draft_json.edited, true);
    assert.equal(demo.source_s3_key, media.storage_key);
    await assert.rejects(register(db, 1, "owner-a", "other-project"), /mcp_demo_conflict/);
    await assert.rejects(register(db, 1, "owner-b"), /mcp_demo_not_found/);
  } finally { await db.close(); }
});

test("unconfirmed, foreign, deleted, oversized, non-video and invalid duration uploads never register", async () => {
  const db = await setup();
  try {
    const cases = [{ status: "uploading" }, { user_id: "owner-b" }, { file_size_bytes: 104857601 },
      { duration_seconds: 61 }, { duration_seconds: 0 }, { width: null }, { metadata: {} },
      { collection: "image", mime_type: "image/png" }, { source_type: "generated_video" }];
    for (let index = 0; index < cases.length; index++) {
      await upload(db, index + 10, cases[index]);
      await assert.rejects(register(db, index + 10), /mcp_demo_(input_invalid|not_found)/);
    }
    await upload(db, 30); await db.query("update media_assets set deleted_at=now() where id=$1", [id(30)]);
    await assert.rejects(register(db, 30), /mcp_demo_not_found/);
    assert.equal((await db.query("select count(*)::int as count from demo_videos")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("both registration writes roll back if the media classification update fails", async () => {
  const db = await setup();
  try {
    await upload(db, 40);
    await db.exec("alter table media_assets add constraint reject_demo_test check (source_type <> 'demo_upload');");
    await assert.rejects(register(db, 40), /reject_demo_test/);
    assert.equal((await db.query("select count(*)::int as count from demo_videos")).rows[0].count, 0);
    assert.equal((await db.query("select source_type from media_assets")).rows[0].source_type, "upload");
  } finally { await db.close(); }
});

test("deletion hides both linked rows, replays safely, preserves unrelated outputs and rejects foreign/project mismatches", async () => {
  const db = await setup();
  try {
    await upload(db, 50); await upload(db, 51, { source_type: "combined_render" }); await register(db, 50);
    await assert.rejects(remove(db, 50, "owner-b"), /mcp_demo_not_found/);
    await assert.rejects(remove(db, 50, "owner-a", "other-project"), /mcp_demo_not_found/);
    assert.equal((await remove(db, 50)).rows[0].result, true);
    assert.equal((await remove(db, 50)).rows[0].result, true);
    assert.ok((await db.query("select deleted_at from demo_videos where id=$1", [id(50)])).rows[0].deleted_at);
    assert.ok((await db.query("select deleted_at from media_assets where id=$1", [id(50)])).rows[0].deleted_at);
    assert.equal((await db.query("select deleted_at from media_assets where id=$1", [id(51)])).rows[0].deleted_at, null);
    await assert.rejects(register(db, 50), /mcp_demo_not_found/);
  } finally { await db.close(); }
});

test("conflicting linked media fails closed and both RPCs use invoker privileges restricted to service_role", async () => {
  const db = await setup();
  try {
    await upload(db, 60); await register(db, 60);
    await db.query("update media_assets set storage_key='changed-key' where id=$1", [id(60)]);
    await assert.rejects(remove(db, 60), /mcp_demo_conflict/);
    assert.equal((await db.query("select deleted_at from demo_videos")).rows[0].deleted_at, null);
    const privileges = await db.query(`select proname, prosecdef,
      has_function_privilege('anon',oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,
      has_function_privilege('service_role',oid,'EXECUTE') as service_role
      from pg_proc where proname in ('mcp_register_demo','mcp_delete_demo')`);
    assert.equal(privileges.rows.length, 2);
    for (const row of privileges.rows) {
      assert.equal(row.prosecdef, false); assert.equal(row.anon, false);
      assert.equal(row.authenticated, false); assert.equal(row.service_role, true);
    }
    await db.exec("set role anon");
    await assert.rejects(register(db, 60), /permission denied/);
    await db.exec("reset role; set role service_role");
    await upload(db, 61); await register(db, 61); await remove(db, 61);
  } finally { await db.close(); }
});

test("generic deletion using a stale upload snapshot still hides the registered Demo atomically", async () => {
  const db = await setup();
  try {
    await upload(db, 70);
    const stale = (await db.query("select * from media_assets where id=$1", [id(70)])).rows[0];
    assert.equal(stale.source_type, "upload");
    await register(db, 70);
    await db.query("update media_assets set deleted_at=now(), updated_at=now() where id=$1 and user_id=$2", [stale.id, stale.user_id]);
    assert.ok((await db.query("select deleted_at from demo_videos where id=$1", [id(70)])).rows[0].deleted_at);
    await assert.rejects(register(db, 70), /mcp_demo_not_found/);
    // Unrelated generic uploads are unaffected by this trigger.
    await upload(db, 71);
    await db.query("update media_assets set deleted_at=now() where id=$1", [id(71)]);
    assert.equal((await db.query("select count(*)::int as count from demo_videos")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("Demo deletion rolls back if linked media cannot be hidden", async () => {
  const db = await setup();
  try {
    await upload(db, 80); await register(db, 80);
    await db.exec("alter table media_assets add constraint reject_delete_test check (deleted_at is null);");
    await assert.rejects(remove(db, 80), /reject_delete_test/);
    assert.equal((await db.query("select deleted_at from demo_videos")).rows[0].deleted_at, null);
  } finally { await db.close(); }
});
