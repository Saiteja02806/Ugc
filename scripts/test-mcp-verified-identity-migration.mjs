import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
try {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  for (const migration of [
    "20260927202555_mcp_oauth.sql",
    "20260928111109_mcp_oauth_atomic_family_revocation.sql",
    "20261017080000_mcp_verified_identity.sql",
  ]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }

  const columns = await db.query(`SELECT table_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'email_verified'
    ORDER BY table_name`);
  assert.deepEqual(columns.rows.map((row) => row.table_name), [
    "mcp_oauth_authorization_codes",
    "mcp_oauth_tokens",
  ]);
  assert(columns.rows.every((row) => row.is_nullable === "NO" && String(row.column_default).includes("false")));

  await db.exec(`INSERT INTO public.mcp_oauth_authorization_codes
    (code_hash, client_id, firebase_uid, redirect_uri, resource, scopes, code_challenge, email_verified, expires_at)
    VALUES ('verified-code', 'client', 'verified-user', 'https://client.example/callback',
      'https://mcp.example/mcp', ARRAY['account:read','publishing:write'], 'challenge', true, now() + interval '5 minutes')`);
  const exchange = await db.query(`SELECT * FROM public.mcp_exchange_authorization_code(
    'verified-code', 'client', 'https://client.example/callback', 'https://mcp.example/mcp',
    'challenge', 'verified-access', 'verified-refresh', '00000000-0000-4000-8000-000000000010')`);
  assert.deepEqual(exchange.rows[0].scopes, ["account:read", "publishing:write"]);
  const issued = await db.query(`SELECT token_hash, email_verified FROM public.mcp_oauth_tokens
    WHERE token_hash IN ('verified-access', 'verified-refresh') ORDER BY token_hash`);
  assert.deepEqual(issued.rows, [
    { token_hash: "verified-access", email_verified: true },
    { token_hash: "verified-refresh", email_verified: true },
  ]);

  await db.query(`SELECT * FROM public.mcp_rotate_refresh_token(
    'verified-refresh', 'rotated-refresh', 'rotated-access', 'client', 'https://mcp.example/mcp')`);
  const rotated = await db.query(`SELECT email_verified FROM public.mcp_oauth_tokens
    WHERE token_hash IN ('rotated-access', 'rotated-refresh')`);
  assert(rotated.rows.every((row) => row.email_verified === true));

  await db.exec(`INSERT INTO public.mcp_oauth_tokens
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, family_id, expires_at)
    VALUES ('legacy-refresh', 'refresh', 'client', 'legacy-user', 'https://mcp.example/mcp',
      ARRAY['account:read'], '00000000-0000-4000-8000-000000000011', now() + interval '1 day')`);
  await db.query(`SELECT * FROM public.mcp_rotate_refresh_token(
    'legacy-refresh', 'legacy-rotated-refresh', 'legacy-rotated-access', 'client', 'https://mcp.example/mcp')`);
  const legacy = await db.query(`SELECT email_verified FROM public.mcp_oauth_tokens
    WHERE token_hash IN ('legacy-rotated-access', 'legacy-rotated-refresh')`);
  assert(legacy.rows.every((row) => row.email_verified === false));

  const grants = await db.query(`SELECT
    has_function_privilege('anon', 'public.mcp_rotate_refresh_token(text,text,text,text,text)', 'EXECUTE') AS anon_rotate,
    has_function_privilege('anon', 'public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)', 'EXECUTE') AS anon_exchange,
    has_function_privilege('service_role', 'public.mcp_rotate_refresh_token(text,text,text,text,text)', 'EXECUTE') AS service_rotate,
    has_function_privilege('service_role', 'public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)', 'EXECUTE') AS service_exchange`);
  assert.deepEqual(grants.rows[0], {
    anon_rotate: false,
    anon_exchange: false,
    service_rotate: true,
    service_exchange: true,
  });
  console.log("MCP verified identity migration preserves the consent snapshot through exchange and refresh.");
} finally {
  await db.close();
}
