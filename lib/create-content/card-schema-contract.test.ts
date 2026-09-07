import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260907160000_create_content_cards.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Create Content cards are isolated from Trending plans and assignments", () => {
  assert.match(migration, /create table public\.create_content_cards/i);
  assert.match(migration, /unique \(user_id, source_media_asset_id\)/i);
  assert.match(migration, /references public\.media_assets\(id\)/i);
  assert.doesNotMatch(
    migration,
    /references public\.(?:daily_trending_feeds|trending_creative_edits|user_.*_assignments|.*content_plan)/i,
  );
});

test("Create Content cards stay private behind authenticated server routes", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.create_content_cards from anon, authenticated/i);
  assert.match(migration, /grant delete, insert, select, update on table public\.create_content_cards to postgres, service_role/i);
});
