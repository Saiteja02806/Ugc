import assert from "node:assert/strict";
import test from "node:test";

import {
  getGoogleServiceAccountCredentials,
  getMissingVercelGcpCredentialEnvVars,
} from "./credentials.ts";

test("uses no explicit GCP credentials outside Vercel by default", () => {
  assert.equal(getGoogleServiceAccountCredentials({}), null);
  assert.deepEqual(getMissingVercelGcpCredentialEnvVars({}), []);
});

test("requires explicit GCP credentials on Vercel", () => {
  assert.deepEqual(getMissingVercelGcpCredentialEnvVars({ VERCEL: "1" }), [
    "GOOGLE_CLOUD_CREDENTIALS_JSON or GOOGLE_CLOUD_CLIENT_EMAIL/GOOGLE_CLOUD_PRIVATE_KEY",
  ]);
});

test("parses Vercel-safe service account JSON credentials", () => {
  const credentials = getGoogleServiceAccountCredentials({
    GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({
      client_email: "ugc-app-sa@ugcsaas.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      project_id: "ugcsaas",
    }),
  });

  assert.deepEqual(credentials, {
    client_email: "ugc-app-sa@ugcsaas.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
    private_key_id: undefined,
    project_id: "ugcsaas",
    type: undefined,
  });
});

test("accepts split service account credential env vars", () => {
  const credentials = getGoogleServiceAccountCredentials({
    GOOGLE_CLOUD_CLIENT_EMAIL: "ugc-app-sa@ugcsaas.iam.gserviceaccount.com",
    GOOGLE_CLOUD_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  });

  assert.equal(
    credentials?.client_email,
    "ugc-app-sa@ugcsaas.iam.gserviceaccount.com",
  );
  assert.equal(
    credentials?.private_key,
    "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
  );
});
