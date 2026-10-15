import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("missing queued delivery recovery rejects a concurrent claim, changed snapshot and unprivileged role", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table background_jobs(id uuid primary key,status text,updated_at timestamptz,attempt_count integer);
      create function recover_background_job(p_job_id uuid) returns setof background_jobs language sql as $$
        update background_jobs set attempt_count=attempt_count+1,updated_at=clock_timestamp() where id=p_job_id returning *;
      $$;
      insert into background_jobs values('00000000-0000-4000-8000-000000000001','queued','2026-10-15T13:31:00Z',0);`);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261015135636_guard_missing_queued_job_recovery.sql", import.meta.url), "utf8"));
    const recover = () => db.query("select * from recover_missing_queued_background_job('00000000-0000-4000-8000-000000000001','2026-10-15T13:31:00Z')");
    await db.exec("update background_jobs set status='processing'");
    assert.equal((await recover()).rows.length, 0);
    await db.exec("update background_jobs set status='queued',updated_at='2026-10-15T13:32:00Z'");
    assert.equal((await recover()).rows.length, 0);
    await db.exec("update background_jobs set updated_at='2026-10-15T13:31:00Z'; set role authenticated");
    await assert.rejects(recover(), /permission denied/);
    await db.exec("set role service_role");
    assert.equal((await recover()).rows[0].attempt_count, 1);
    assert.equal((await recover()).rows.length, 0);
  } finally { await db.close(); }
});
