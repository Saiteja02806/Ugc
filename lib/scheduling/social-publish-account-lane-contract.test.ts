import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const migration = read(
  "supabase/migrations/20260828161000_add_social_publish_account_lanes.sql",
);
const store = read("worker/src/lib/supabase.ts");
const worker = read("worker/src/jobs/publish-social-post.ts");

test("one publish lane is owned per provider account, not merely per post target", () => {
  assert.match(migration, /create table if not exists public\.social_publish_account_lanes/i);
  assert.match(migration, /primary key \(platform, social_connection_id\)/i);
  assert.match(
    migration,
    /claim_social_publish_operation_with_account_lane/i,
  );
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /claim_social_publish_operation\(/i);
  assert.match(
    migration,
    /release_social_publish_account_lane_on_operation_change/i,
  );
});

test("a busy account lane defers safely without spending a provider retry", () => {
  assert.match(
    store,
    /claim_social_publish_operation_with_account_lane/,
  );
  assert.match(store, /getSocialPublishAccountLane/);
  assert.match(worker, /new DeferredJobError\([\s\S]*social_publish_account_lane_busy/);
  assert.match(worker, /if \(error instanceof DeferredJobError\)[\s\S]*throw error/);
});

function read(relativePath: string) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}
