import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
try {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  for (const migration of [
    "20260927202555_mcp_oauth.sql",
    "20260928111109_mcp_oauth_atomic_family_revocation.sql",
  ]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }

  const privilege = await db.query(`SELECT
    has_function_privilege('anon', 'public.mcp_revoke_token_family(text,text)', 'EXECUTE') AS anon_can_execute,
    has_function_privilege('service_role', 'public.mcp_revoke_token_family(text,text)', 'EXECUTE') AS service_can_execute`);
  assert.equal(privilege.rows[0].anon_can_execute, false);
  assert.equal(privilege.rows[0].service_can_execute, true);
  await db.exec(`INSERT INTO public.mcp_oauth_tokens
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, family_id, expires_at)
    VALUES ('old-refresh', 'refresh', 'client-a', 'user-a', 'https://mcp.example/mcp',
      ARRAY['account:read'], '00000000-0000-4000-8000-000000000003', now() + interval '1 day')`);

  await db.exec("SET ROLE service_role");
  const wrongClient = await db.query("SELECT public.mcp_revoke_token_family('old-refresh','client-b') AS revoked");
  assert.equal(wrongClient.rows[0].revoked, false);
  const rotated = await db.query(`SELECT * FROM public.mcp_rotate_refresh_token(
    'old-refresh', 'new-refresh', 'new-access', 'client-a', 'https://mcp.example/mcp')`);
  assert.equal(rotated.rows[0].firebase_uid, "user-a");
  const revoked = await db.query("SELECT public.mcp_revoke_token_family('new-access','client-a') AS revoked");
  assert.equal(revoked.rows[0].revoked, true);
  const active = await db.query(`SELECT count(*)::int AS count FROM public.mcp_oauth_tokens
    WHERE family_id='00000000-0000-4000-8000-000000000003' AND revoked_at IS NULL`);
  assert.equal(active.rows[0].count, 0);
  const afterDisconnect = await db.query(`SELECT * FROM public.mcp_rotate_refresh_token(
    'new-refresh', 'another-refresh', 'another-access', 'client-a', 'https://mcp.example/mcp')`);
  assert.equal(afterDisconnect.rows.length, 0);

  await db.exec("RESET ROLE");
  await db.exec("SET ROLE anon");
  try {
    await assert.rejects(db.query("SELECT public.mcp_revoke_token_family('old-refresh','client-a')"));
  } finally {
    await db.exec("RESET ROLE");
  }
  console.log("MCP OAuth family revocation migration and role isolation passed.");
} finally {
  await db.close();
}
