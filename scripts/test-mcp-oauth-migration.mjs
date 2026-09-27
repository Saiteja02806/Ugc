import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
try {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(await readFile(new URL("../supabase/migrations/20260927150038_mcp_oauth.sql", import.meta.url), "utf8"));
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'mcp_oauth_%'");
  assert.equal(tables.rows.length, 4);
  for (const { tablename } of tables.rows) {
    const grants = await db.query("SELECT has_table_privilege('anon', $1, 'SELECT') AS anon_can_read, has_table_privilege('service_role', $1, 'SELECT') AS service_can_read", [`public.${tablename}`]);
    assert.equal(grants.rows[0].anon_can_read, false);
    assert.equal(grants.rows[0].service_can_read, true);
  }
  const functions = await db.query("SELECT has_function_privilege('anon', 'public.mcp_rotate_refresh_token(text,text,text,text,text)', 'EXECUTE') AS anon_can_execute, has_function_privilege('service_role', 'public.mcp_rotate_refresh_token(text,text,text,text,text)', 'EXECUTE') AS service_can_execute");
  assert.equal(functions.rows[0].anon_can_execute, false);
  assert.equal(functions.rows[0].service_can_execute, true);
  const registrationGrant = await db.query("SELECT has_function_privilege('anon', 'public.mcp_register_client(text,text,text[],text)', 'EXECUTE') AS anon_can_execute");
  assert.equal(registrationGrant.rows[0].anon_can_execute, false);
  const exchangeGrant = await db.query("SELECT has_function_privilege('anon', 'public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)', 'EXECUTE') AS anon_can_execute, has_function_privilege('service_role', 'public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)', 'EXECUTE') AS service_can_execute");
  assert.equal(exchangeGrant.rows[0].anon_can_execute, false);
  assert.equal(exchangeGrant.rows[0].service_can_execute, true);
  await db.exec("SET ROLE anon");
  try {
    await assert.rejects(db.query("SELECT token_hash FROM public.mcp_oauth_tokens LIMIT 1"));
    await assert.rejects(db.query("SELECT public.mcp_register_client('anon-client','Anon',ARRAY['https://example.com/callback'],'anon-ip')"));
  } finally {
    await db.exec("RESET ROLE");
  }
  await db.exec("SET ROLE service_role");
  try {
    const serviceRegistration = await db.query("SELECT public.mcp_register_client('service-client','Service',ARRAY['https://example.com/callback'],'service-ip') AS registered");
    assert.equal(serviceRegistration.rows[0].registered, true);
    const serviceRows = await db.query("SELECT client_id FROM public.mcp_oauth_clients WHERE client_id='service-client'");
    assert.equal(serviceRows.rows[0].client_id, "service-client");
  } finally {
    await db.exec("RESET ROLE");
  }
  for (let index = 0; index < 20; index += 1) {
    const result = await db.query("SELECT public.mcp_register_client($1,$2,$3,$4) AS registered", [
      `client-${index}`, "Test client", ["https://example.com/callback"], "ip-hash",
    ]);
    assert.equal(result.rows[0].registered, true);
  }
  const limited = await db.query("SELECT public.mcp_register_client('client-21','Test client',ARRAY['https://example.com/callback'],'ip-hash') AS registered");
  assert.equal(limited.rows[0].registered, false);
  await db.exec(`INSERT INTO public.mcp_oauth_tokens
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, family_id, expires_at)
    VALUES ('old', 'refresh', 'client', 'firebase-user', 'https://mcp.example/mcp',
      ARRAY['account:read'], '00000000-0000-4000-8000-000000000001', now() + interval '1 day')`);
  const rotated = await db.query(`SELECT * FROM public.mcp_rotate_refresh_token(
    'old', 'new-refresh', 'new-access', 'client', 'https://mcp.example/mcp')`);
  assert.equal(rotated.rows[0].firebase_uid, "firebase-user");
  const replay = await db.query(`SELECT * FROM public.mcp_rotate_refresh_token(
    'old', 'unused-refresh', 'unused-access', 'client', 'https://mcp.example/mcp')`);
  assert.equal(replay.rows.length, 0);
  const active = await db.query("SELECT count(*)::int AS active FROM public.mcp_oauth_tokens WHERE family_id='00000000-0000-4000-8000-000000000001' AND revoked_at IS NULL");
  assert.equal(active.rows[0].active, 0);
  await db.exec(`INSERT INTO public.mcp_oauth_authorization_codes
    (code_hash, client_id, firebase_uid, redirect_uri, resource, scopes, code_challenge, expires_at)
    VALUES ('code', 'client', 'firebase-user', 'https://client.example/callback',
      'https://mcp.example/mcp', ARRAY['account:read'], 'challenge', now() + interval '5 minutes')`);
  const exchangeArgs = [
    "code", "client", "https://client.example/callback", "https://mcp.example/mcp",
    "challenge", "issued-access", "issued-refresh", "00000000-0000-4000-8000-000000000002",
  ];
  const exchangeSql = "SELECT * FROM public.mcp_exchange_authorization_code($1,$2,$3,$4,$5,$6,$7,$8)";
  for (const index of [1, 2, 3, 4]) {
    const wrong = [...exchangeArgs];
    wrong[index] = "wrong";
    assert.equal((await db.query(exchangeSql, wrong)).rows.length, 0);
  }
  const unused = await db.query("SELECT used_at FROM public.mcp_oauth_authorization_codes WHERE code_hash='code'");
  assert.equal(unused.rows[0].used_at, null);
  await assert.rejects(db.query(exchangeSql, [
    ...exchangeArgs.slice(0, 5), "old", "issued-refresh",
    "00000000-0000-4000-8000-000000000002",
  ]));
  const stillUnused = await db.query("SELECT used_at FROM public.mcp_oauth_authorization_codes WHERE code_hash='code'");
  assert.equal(stillUnused.rows[0].used_at, null);
  const exchanged = await db.query(exchangeSql, exchangeArgs);
  assert.deepEqual(exchanged.rows[0].scopes, ["account:read"]);
  assert.equal((await db.query(exchangeSql, exchangeArgs)).rows.length, 0);
  const issued = await db.query("SELECT count(*)::int AS count FROM public.mcp_oauth_tokens WHERE family_id='00000000-0000-4000-8000-000000000002'");
  assert.equal(issued.rows[0].count, 2);
  console.log("MCP OAuth migration, role isolation, and token lifecycle passed.");
} finally {
  await db.close();
}
