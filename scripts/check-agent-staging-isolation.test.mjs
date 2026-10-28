import assert from "node:assert/strict";
import test from "node:test";
import { checkStagingIsolation, stagingWriteGates } from "./check-agent-staging-isolation.mjs";

function fixture() {
  const target = { environment: "ugc-agent-staging", supabaseProjectRef: "abcdefghijklmnopqrst", gcpProjectId: "ugc-agent-staging",
    firebaseProjectId: "ugc-agent-staging", storageBucket: "ugc-agent-staging-media", websiteProjectId: "prj_stage_web", mcpProjectId: "prj_stage_mcp",
    websiteOrigin: "https://stage-web.example.test", mcpOrigin: "https://stage-mcp.example.test", workerOrigins: ["https://stage-worker.example.test"], resourcePrefix: "ugc-agent-staging" };
  const base = { SUPABASE_URL: `https://${target.supabaseProjectRef}.supabase.co`, NEXT_PUBLIC_SUPABASE_URL: `https://${target.supabaseProjectRef}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_not_a_real_key", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fixture_not_a_real_key", GCP_PROJECT_ID: target.gcpProjectId, NEXT_PUBLIC_FIREBASE_PROJECT_ID: target.firebaseProjectId,
    GCP_STORAGE_BUCKET: target.storageBucket, GCP_RESOURCE_NAME_PREFIX: target.resourcePrefix, APP_BASE_URL: target.websiteOrigin,
    MCP_OAUTH_ISSUER: target.mcpOrigin, MCP_PUBLIC_URL: `${target.mcpOrigin}/mcp`, DODO_PAYMENTS_ENVIRONMENT: "test_mode", SOCIAL_RECONCILIATION_ENABLED: "false",
    ...Object.fromEntries(stagingWriteGates.map(key => [key, "false"])) };
  const env = { website: { ...base, MCP_ONLY_DEPLOYMENT: "false" }, mcp: { ...base, MCP_ONLY_DEPLOYMENT: "true" }, worker: { ...base, WORKER_JOB_TYPES: "test_worker_job" } };
  return { target, env, check: () => checkStagingIsolation(target, env) };
}
test("an explicit isolated gate-off configuration passes only offline preflight", () => {
  const result = fixture().check(); assert.equal(result.status, "configuration-preflight-passed"); assert.match(result.limitation, /Offline/);
});
test("an incomplete target cannot be treated as provisioned staging", () => {
  assert.equal(checkStagingIsolation({ environment: "ugc-agent-staging" }, {}).status, "blocked");
});
test("production database and hosting targets are rejected even if selected in the manifest", () => {
  const h = fixture(); h.target.supabaseProjectRef = "kltxwijhluawgveykfbt";
  h.target.websiteProjectId = "prj_mVOxt7AUko5egMAESaxjGyC60Kvu";
  assert.match(h.check().errors.join("\n"), /separate Supabase|dedicated staging/);
});
test("an inherited production worker endpoint, queue or media URL fails", () => {
  const h = fixture(); h.env.mcp.GCP_SOCIAL_PUBLISH_TASK_URL = "https://getugcpilot.com/api/internal/schedules/dispatch";
  h.env.website.GCP_SOCIAL_PUBLISH_TASKS_QUEUE = "ugc-social-publish";
  h.env.worker.GCP_STORAGE_PUBLIC_BASE_URL = "https://storage.googleapis.com/ugcsaas-media";
  const errors = h.check().errors.join("\n"); assert.match(errors, /approved staging endpoints/); assert.match(errors, /staging queue/); assert.match(errors, /production media bucket/);
});
test("production issuer fallback, public secrets and enabled writes fail without printing values", () => {
  const h = fixture(); delete h.env.mcp.MCP_OAUTH_ISSUER; h.env.website.NEXT_PUBLIC_SERVICE_ROLE_KEY = "sensitive-sentinel";
  h.env.mcp.MCP_PUBLISH_NOW_ENABLED = "true";
  const result = h.check(); assert.equal(result.status, "blocked"); assert.ok(result.errors.length >= 3); assert.ok(!JSON.stringify(result).includes("sensitive-sentinel"));
});
test("GCP credential aliases and service-key claims cannot select production", () => {
  const h = fixture(); h.env.worker.GOOGLE_CLOUD_CREDENTIALS_JSON = JSON.stringify({ project_id: "ugcsaas", client_email: "prod@ugcsaas.iam.gserviceaccount.com", private_key: "sensitive-sentinel" });
  h.env.mcp.SUPABASE_SERVICE_ROLE_KEY = `header.${Buffer.from(JSON.stringify({ ref: "kltxwijhluawgveykfbt", role: "service_role" })).toString("base64url")}.signature`;
  const result = h.check(); assert.match(result.errors.join("\n"), /credential claims|staging GCP project/); assert.ok(!JSON.stringify(result).includes("sensitive-sentinel"));
});
test("initial staging cannot reconcile real jobs, use live billing or collapse routing targets", () => {
  const h = fixture(); h.env.worker.WORKER_JOB_TYPES = "publish_social_post"; h.env.worker.SOCIAL_RECONCILIATION_ENABLED = "true";
  h.env.website.DODO_PAYMENTS_ENVIRONMENT = "live_mode"; h.target.mcpOrigin = h.target.websiteOrigin;
  assert.equal(h.check().status, "blocked"); assert.ok(h.check().errors.length >= 4);
});
test("endpoint origins containing credentials, paths or non-HTTPS URLs are rejected", () => {
  for (const value of ["https://user:pass@stage-web.example.test", "http://stage-web.example.test", "https://stage-web.example.test/path"]) {
    const h = fixture(); h.target.websiteOrigin = value; assert.equal(h.check().status, "blocked");
  }
});

test("browser credentials cannot silently fall back to production or carry a server role", () => {
  const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  for (const claims of [
    { ref: "kltxwijhluawgveykfbt", role: "anon" },
    { ref: "abcdefghijklmnopqrst", role: "service_role" },
  ]) {
    const h = fixture(); h.env.website.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt(claims);
    const result = h.check(); assert.equal(result.status, "blocked");
    assert.match(result.errors.join("\n"), /claims do not match/);
    assert.ok(!JSON.stringify(result).includes(h.env.website.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  }
  const h = fixture(); delete h.env.website.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.match(h.check().errors.join("\n"), /browser publishable key explicitly/);
});

test("the new business write gates cannot inherit an enabled setting", () => {
  for (const key of ["MCP_BUSINESS_CONTEXT_WRITES_ENABLED", "MCP_BUSINESS_ONBOARDING_WRITES_ENABLED", "MCP_BUSINESS_MEDIA_WRITES_ENABLED"]) {
    const h = fixture(); h.env.mcp[key] = "true";
    assert.match(h.check().errors.join("\n"), new RegExp(`${key} must be explicitly false`));
  }
});

test("null manifests, malformed environment exports and credential type swaps fail closed", () => {
  assert.equal(checkStagingIsolation(null, null).status, "blocked");
  const h = fixture(); h.env.mcp.SUPABASE_SERVICE_ROLE_KEY = 123;
  assert.match(h.check().errors.join("\n"), /values must be strings/);
  const swapped = fixture(); swapped.env.website.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_secret_fixture_not_a_real_key";
  assert.match(swapped.check().errors.join("\n"), /matching credential type/);
});
