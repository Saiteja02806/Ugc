import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("receipt permission correction defeats Supabase default ALL grants while retaining append-only requests", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role; alter default privileges in schema public grant all on tables to service_role;");
    const group = await readFile(new URL("../supabase/migrations/20261013072941_mcp_creative_asset_groups.sql", import.meta.url), "utf8");
    const library = await readFile(new URL("../supabase/migrations/20261013072958_mcp_library_content.sql", import.meta.url), "utf8");
    // Use the actual receipt DDL; unrelated application tables/RPCs are unnecessary for this grant regression.
    await db.exec(group.slice(0, group.indexOf("-- Existing application queries")));
    await db.exec(library.slice(0, library.indexOf("create index mcp_library_items_owner_page_idx")));
    for (const name of ["mcp_creative_group_requests", "mcp_library_requests"]) {
      const before = (await db.query("select has_table_privilege('service_role', $1, 'UPDATE') allowed", [name])).rows[0];
      assert.equal(before.allowed, true, "fixture must reproduce the production default-grant bug");
    }
    await db.exec(await readFile(new URL("../supabase/migrations/20261013073411_mcp_request_receipt_permissions.sql", import.meta.url), "utf8"));
    for (const name of ["mcp_creative_group_requests", "mcp_library_requests"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        for (const role of ["anon", "authenticated", "service_role"]) {
          const row = (await db.query("select has_table_privilege($1, $2, $3) allowed", [role, name, privilege])).rows[0];
          assert.equal(row.allowed, role === "service_role" && ["SELECT", "INSERT"].includes(privilege), `${role} ${name} ${privilege}`);
        }
      }
    }
    await db.exec("set role service_role");
    await db.query("insert into public.mcp_creative_group_requests(user_id,request_id,operation,payload_hash,input_json,result_json) values('owner-a','00000000-0000-4000-8000-000000000001','create',repeat('a',64),'{}','{}')");
    await db.query("insert into public.mcp_library_requests(user_id,request_id,operation,input_json,result_json) values('owner-a','00000000-0000-4000-8000-000000000001','save_carousel','{}','{}')");
    for (const name of ["mcp_creative_group_requests", "mcp_library_requests"]) {
      assert.equal(Number((await db.query(`select count(*) total from public.${name}`)).rows[0].total), 1);
      for (const sql of [`update public.${name} set result_json='{}'`, `delete from public.${name}`, `truncate public.${name}`]) {
        await assert.rejects(db.query(sql), error => error.code === "42501");
      }
    }
  } finally { await db.close(); }
});
