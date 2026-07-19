import assert from "node:assert/strict";
import test from "node:test";

import {
  createGcpCutoverAuditSignature,
  deriveGcpCutoverAuditSecret,
  isValidGcpCutoverAuditSecret,
  verifyGcpCutoverAuditSignature,
} from "./gcp-cutover-audit-signature.ts";

test("GCP cutover audit signatures verify recent matching requests", () => {
  const body = JSON.stringify({ canary: "production-cutover" });
  const secret = deriveGcpCutoverAuditSecret("supabase-service-role-secret");
  const timestamp = Date.now().toString();
  const signature = createGcpCutoverAuditSignature({
    body,
    secret,
    timestamp,
  });

  assert.equal(isValidGcpCutoverAuditSecret(secret), true);
  assert.equal(
    verifyGcpCutoverAuditSignature({
      body,
      secret,
      signature,
      timestamp,
    }),
    true,
  );
});

test("GCP cutover audit signatures reject tampered request bodies", () => {
  const body = JSON.stringify({ canary: "production-cutover" });
  const secret = deriveGcpCutoverAuditSecret("supabase-service-role-secret");
  const timestamp = Date.now().toString();
  const signature = createGcpCutoverAuditSignature({
    body,
    secret,
    timestamp,
  });

  assert.equal(
    verifyGcpCutoverAuditSignature({
      body: JSON.stringify({ canary: "tampered" }),
      secret,
      signature,
      timestamp,
    }),
    false,
  );
});
