import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("saved captions migration isolates storage, validates defaults and supports atomic revision fencing", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync(new URL("../supabase/migrations/20261024061601_saved_post_captions.sql", import.meta.url), "utf8"));
    const id = "00000000-0000-4000-8000-000000000001";
    const captions = JSON.stringify([{ id, text: "Exact caption\n\n#SaaS" }]);
    await db.query("insert into public.user_saved_captions(user_id,captions,default_caption_id,revision) values($1,$2,$3,1)", ["owner-a", captions, id]);
    await assert.rejects(db.query("insert into public.user_saved_captions(user_id,captions,revision) values('owner-a',$1,1)", [captions]), /duplicate key/);
    assert.equal((await db.query("update public.user_saved_captions set revision=2 where user_id='owner-a' and revision=1 returning revision")).rows.length, 1);
    assert.equal((await db.query("update public.user_saved_captions set revision=2,captions='[]',default_caption_id=null where user_id='owner-a' and revision=1 returning revision")).rows.length, 0);
    await assert.rejects(db.query("update public.user_saved_captions set default_caption_id='00000000-0000-4000-8000-000000000002' where user_id='owner-a'"), /check constraint/);
    await assert.rejects(db.query("insert into public.user_saved_captions(user_id,captions,revision) values('owner-b',$1,1)", [JSON.stringify(Array.from({ length: 21 }, () => ({ id, text: "x" })))]), /check constraint/);
    const permissions = await db.query("select has_table_privilege('anon','public.user_saved_captions','select') as anon,has_table_privilege('authenticated','public.user_saved_captions','update') as authenticated,has_table_privilege('service_role','public.user_saved_captions','update') as service");
    assert.deepEqual(permissions.rows[0], { anon: false, authenticated: false, service: true });
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.user_saved_captions'::regclass")).rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});
