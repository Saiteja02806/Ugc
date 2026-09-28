import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20260928151747_mcp_upload_quota.sql", import.meta.url), "utf8");
const db = new PGlite();

async function reserve(userId, collection = "image", bytes = 1, maxCount = 5, maxBytes = 500 * 1024 * 1024) {
  const id = randomUUID();
  const video = collection !== "image";
  return db.query(`select public.mcp_create_upload_asset(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
  ) as asset`, [
    userId, id, collection, video && collection === "influencer" ? "influencer_upload" : "upload",
    video ? "clip.mp4" : "image.png", bytes, video ? "video/mp4" : "image/png",
    `media/${userId}/${collection}/${id}.${video ? "mp4" : "png"}`,
    "Quota test", `https://storage.googleapis.com/test/${id}`, maxCount, maxBytes,
  ]);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.media_assets (
      id uuid primary key, user_id text not null, collection text not null,
      source_type text not null, source_record_id text, title text not null,
      storage_key text not null, url text not null, mime_type text not null,
      file_name text, file_size_bytes bigint, ratio text not null,
      status text not null, metadata jsonb not null, updated_at timestamptz,
      deleted_at timestamptz
    );
    alter table public.media_assets enable row level security;
    grant select, insert, update on public.media_assets to service_role;
  `);
  try {
    await db.exec(migration);
  } catch (error) {
    throw new Error(`Migration failed: ${error.message} (${error.code ?? "unknown"})`);
  }
  const permissions = await db.query(`select
    has_function_privilege('anon', 'public.mcp_create_upload_asset(text,uuid,text,text,text,bigint,text,text,text,text,integer,bigint)', 'EXECUTE') as anon,
    has_function_privilege('authenticated', 'public.mcp_create_upload_asset(text,uuid,text,text,text,bigint,text,text,text,text,integer,bigint)', 'EXECUTE') as authenticated,
    has_function_privilege('service_role', 'public.mcp_create_upload_asset(text,uuid,text,text,text,bigint,text,text,text,text,integer,bigint)', 'EXECUTE') as service,
    has_function_privilege('anon', 'public.mcp_claim_deleted_upload_cleanup(text,uuid,timestamptz,integer)', 'EXECUTE') as anon_claim,
    has_function_privilege('service_role', 'public.mcp_claim_deleted_upload_cleanup(text,uuid,timestamptz,integer)', 'EXECUTE') as service_claim,
    has_function_privilege('anon', 'public.mcp_finish_deleted_upload_cleanup(text,uuid,uuid)', 'EXECUTE') as anon_finish,
    has_function_privilege('service_role', 'public.mcp_finish_deleted_upload_cleanup(text,uuid,uuid)', 'EXECUTE') as service_finish`);
  assert.deepEqual(permissions.rows[0], {
    anon: false, authenticated: false, service: true,
    anon_claim: false, service_claim: true, anon_finish: false, service_finish: true,
  });

  await db.exec("set role service_role");
  const first = await reserve("user-a");
  assert.equal(first.rows[0].asset.metadata.mcpUpload, true);
  for (let index = 1; index < 5; index += 1) await reserve("user-a");
  await assert.rejects(reserve("user-a"), /mcp_upload_quota_exceeded/);
  await reserve("user-b");
  await db.query("update public.media_assets set status='ready' where id=$1", [first.rows[0].asset.id]);
  await reserve("user-a");

  const deleted = await reserve("user-d", "image", 1, 1);
  await db.query("update public.media_assets set deleted_at=now()-interval '12 minutes' where id=$1", [deleted.rows[0].asset.id]);
  await assert.rejects(reserve("user-d", "image", 1, 1), /mcp_upload_quota_exceeded/);
  const claimToken = randomUUID();
  const claim = await db.query("select id from public.mcp_claim_deleted_upload_cleanup($1,$2,now()-interval '11 minutes',$3)", ["user-d", claimToken, 5]);
  assert.equal(claim.rows[0].id, deleted.rows[0].asset.id);
  const duplicateClaim = await db.query("select id from public.mcp_claim_deleted_upload_cleanup($1,$2,now()-interval '11 minutes',$3)", ["user-d", randomUUID(), 5]);
  assert.equal(duplicateClaim.rows.length, 0);
  const wrongFinish = await db.query("select public.mcp_finish_deleted_upload_cleanup($1,$2,$3) as finished", ["user-d", deleted.rows[0].asset.id, randomUUID()]);
  assert.equal(wrongFinish.rows[0].finished, false);
  const finish = await db.query("select public.mcp_finish_deleted_upload_cleanup($1,$2,$3) as finished", ["user-d", deleted.rows[0].asset.id, claimToken]);
  assert.equal(finish.rows[0].finished, true);
  await reserve("user-d", "image", 1, 1);

  await reserve("user-c", "video", 250 * 1024 * 1024);
  await reserve("user-c", "video", 250 * 1024 * 1024);
  await assert.rejects(reserve("user-c"), /mcp_upload_quota_exceeded/);
  await db.exec("reset role");
  console.log("MCP upload quota migration: role isolation, count, bytes, confirmation, and deleted-object cleanup release passed.");
} finally {
  await db.close();
}
