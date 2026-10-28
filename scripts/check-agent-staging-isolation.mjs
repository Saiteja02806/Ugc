// Read-only preflight. No environment loading, networking, deployment or writes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const production = {
  database: "kltxwijhluawgveykfbt", gcp: "ugcsaas", bucket: "ugcsaas-media",
  projects: ["prj_mVOxt7AUko5egMAESaxjGyC60Kvu", "prj_IU0eCl6JEnHt2mMaEV0g2Ej1NMYU"],
  hosts: ["getugcpilot.com", "www.getugcpilot.com", "mcp.getugcpilot.com", "ugc-mcp.vercel.app"],
};
export const stagingWriteGates = [
  "MCP_SCHEDULING_WRITES_ENABLED", "MCP_SCHEDULE_ACTIONS_ENABLED", "MCP_PUBLISH_NOW_ENABLED",
  "MCP_SOCIAL_CONNECTIONS_ENABLED", "MCP_VIDEO_FINISHING_ENABLED", "MCP_PRIVATE_UPLOADS_ENABLED",
  "MCP_AUDIO_VIDEO_IMPORT_ENABLED", "MCP_CREATIVE_GROUPS_ENABLED", "MCP_LIBRARY_WRITES_ENABLED",
  "MCP_TEXT_REMIX_ENABLED", "MCP_ACCOUNT_SETTINGS_WRITES_ENABLED",
  "MCP_BUSINESS_CONTEXT_WRITES_ENABLED", "MCP_BUSINESS_ONBOARDING_WRITES_ENABLED", "MCP_BUSINESS_MEDIA_WRITES_ENABLED",
];

function origin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === "/" && !production.hosts.includes(url.hostname) ? url.origin : null;
  } catch { return null; }
}

export function checkStagingIsolation(target, environments) {
  if (!target || typeof target !== "object" || Array.isArray(target) || !environments || typeof environments !== "object" || Array.isArray(environments)) {
    return { status: "blocked", errors: ["Explicit target and environment objects are required."], limitation: "Offline configuration check only." };
  }
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  require(target.environment === "ugc-agent-staging", "Select the explicit staging environment.");
  for (const key of ["supabaseProjectRef", "gcpProjectId", "firebaseProjectId", "storageBucket", "websiteProjectId", "mcpProjectId", "resourcePrefix"]) {
    require(typeof target[key] === "string" && target[key].trim().length > 0, `Target ${key} is missing.`);
  }
  require(/^[a-z]{20}$/.test(target.supabaseProjectRef ?? "") && target.supabaseProjectRef !== production.database, "Staging must use a separate Supabase project.");
  require(target.gcpProjectId !== production.gcp && target.firebaseProjectId !== production.gcp, "Staging must use separate GCP/Firebase projects.");
  require(target.storageBucket !== production.bucket, "Staging must use a separate media bucket.");
  require(target.websiteProjectId !== target.mcpProjectId && ![target.websiteProjectId, target.mcpProjectId].some(id => production.projects.includes(id)), "Use two dedicated staging Vercel projects.");
  require(/^ugc-agent-staging(?:-[a-z0-9-]+)?$/.test(target.resourcePrefix ?? ""), "Staging queues need a staging resource prefix.");
  const website = origin(target.websiteOrigin), mcp = origin(target.mcpOrigin);
  require(Boolean(website && mcp && website !== mcp), "Configure distinct HTTPS staging website and MCP origins.");
  const workers = Array.isArray(target.workerOrigins) ? target.workerOrigins.map(origin) : [];
  require(workers.length > 0 && workers.every(Boolean) && !workers.includes(website) && !workers.includes(mcp), "Configure explicit, separate HTTPS staging worker origins.");

  for (const role of ["website", "mcp", "worker"]) {
    const env = environments[role];
    if (!env || typeof env !== "object" || Array.isArray(env)) { errors.push(`${role}: missing explicit environment export.`); continue; }
    const check = (condition, message) => require(condition, `${role}: ${message}`);
    if (!Object.values(env).every(value => typeof value === "string")) {
      check(false, "environment values must be strings.");
      continue;
    }
    for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
      check(env[key] === `https://${target.supabaseProjectRef}.supabase.co`, `${key} must identify the staging database.`);
    }
    check(Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()), "supply a staging-only service credential through secret storage.");
    check(Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()), "supply the staging browser publishable key explicitly.");
    for (const key of ["GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"]) {
      check(key === "GCP_PROJECT_ID" ? env[key] === target.gcpProjectId : !env[key] || env[key] === target.gcpProjectId, `${key} must not override the staging project.`);
    }
    check(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === target.firebaseProjectId, "Firebase must identify the staging identity project.");
    check(env.GCP_STORAGE_BUCKET === target.storageBucket, "media writes must use the staging bucket.");
    check(env.GCP_RESOURCE_NAME_PREFIX === target.resourcePrefix, "queue fallback must use the staging prefix.");
    check(env.APP_BASE_URL === website && (!env.UGC_INTERNAL_APP_URL || env.UGC_INTERNAL_APP_URL === website), "application URLs must identify the staging website.");
    check(env.MCP_OAUTH_ISSUER === mcp && env.MCP_PUBLIC_URL === `${mcp}/mcp`, "OAuth issuer/resource must identify staging.");
    check(env.DODO_PAYMENTS_ENVIRONMENT === "test_mode", "billing must remain in test mode.");
    check(!env.DODO_PAYMENTS_API_KEY && !env.DODO_PAYMENTS_WEBHOOK_KEY, "initial staging must omit billing credentials/webhooks.");
    for (const key of stagingWriteGates) check(env[key] === "false", `${key} must be explicitly false for initial deployment.`);
    check(env.SOCIAL_RECONCILIATION_ENABLED === "false", "initial deployment must not reconcile social publications.");
    if (role !== "worker") check(env.MCP_ONLY_DEPLOYMENT === (role === "mcp" ? "true" : "false"), "website/MCP routing mode is incorrect.");
    if (role === "worker") check(env.WORKER_JOB_TYPES === "test_worker_job", "initial worker must run only the isolated test job.");
    for (const [key, value] of Object.entries(env)) {
      if (typeof value !== "string") continue;
      check(!value.includes(production.database) && !value.includes(`projects/${production.gcp}/`), `${key} contains a production resource reference.`);
      check(!value.includes(production.bucket), `${key} contains the production media bucket.`);
      if (key.endsWith("TASKS_QUEUE") && value) check(value.startsWith(`${target.resourcePrefix}-`), `${key} must name a staging queue.`);
      if (/^GCP_.*(?:TASK_URL|DISPATCH_URL|AUDIENCE)$/.test(key) && value) {
        try { check([website, ...workers].includes(new URL(value).origin), `${key} must route only to approved staging endpoints.`); }
        catch { check(false, `${key} is not a valid staging endpoint.`); }
      }
      if (key.startsWith("NEXT_PUBLIC_") && /SECRET|PRIVATE_KEY|SERVICE_ROLE|TOKEN/.test(key)) check(!value, `${key} exposes a server credential.`);
      if (/^(?:GOOGLE_CLOUD_CLIENT_EMAIL|GCP_CLIENT_EMAIL|GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL|GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL)$/.test(key) && value) {
        check(value.endsWith(`@${target.gcpProjectId}.iam.gserviceaccount.com`), `${key} must belong to the staging GCP project.`);
      }
      if (/^(?:GOOGLE_CLOUD_CREDENTIALS_JSON|GOOGLE_APPLICATION_CREDENTIALS_JSON|GCP_SERVICE_ACCOUNT_KEY_JSON)$/.test(key) && value) {
        try {
          const credentials = JSON.parse(value.trim().startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8"));
          check(credentials.project_id === target.gcpProjectId && credentials.client_email?.endsWith(`@${target.gcpProjectId}.iam.gserviceaccount.com`), `${key} must belong to the staging GCP project.`);
        } catch { check(false, `${key} must be valid staging credential JSON.`); }
      }
      if (["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].includes(key)) {
        const expectedRole = key === "SUPABASE_SERVICE_ROLE_KEY" ? "service_role" : "anon";
        if (value.split(".").length === 3) {
          try { const claims = JSON.parse(Buffer.from(value.split(".")[1], "base64url")); check(claims.ref === target.supabaseProjectRef && claims.role === expectedRole, `${key} credential claims do not match staging or the required role.`); }
          catch { check(false, `${key} credential is malformed.`); }
        } else {
          check(value.startsWith(expectedRole === "anon" ? "sb_publishable_" : "sb_secret_"), `${key} must use the matching credential type.`);
        }
      }
    }
  }
  return { status: errors.length ? "blocked" : "configuration-preflight-passed", errors,
    limitation: "Offline configuration check only. Verify credential provenance, IAM, provider apps, schema, protected endpoints and real host execution separately." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [targetFile, exportsFile] = process.argv.slice(2);
    if (!targetFile || !exportsFile) throw new Error("arguments");
    const result = checkStagingIsolation(JSON.parse(readFileSync(targetFile, "utf8")), JSON.parse(readFileSync(exportsFile, "utf8")));
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.errors.length ? 1 : 0;
  } catch {
    console.error("Staging check requires explicit readable target and environment-export JSON files. No environment values are printed."); process.exitCode = 1;
  }
}
