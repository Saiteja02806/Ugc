import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const TARGET_EMAIL = "vtu19403@veltech.edu.in";
const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");

loadEnvFile(path.resolve(".env.local"));

const {
  findFirebaseUserByEmail,
} = await import("../lib/firebase/admin-user-lookup.ts");
const {
  getBusinessProfileForUser,
} = await import("../lib/business-profiles/db.ts");
const {
  getUserSubscription,
} = await import("../lib/billing/subscription-db.ts");

const account = await findFirebaseUserByEmail(TARGET_EMAIL);
if (!account) {
  throw new Error("The one-time Wall plan account no longer exists in Firebase.");
}
if (!account.emailVerified) {
  throw new Error("The one-time Wall plan account must have a verified email.");
}

const [profile, subscription] = await Promise.all([
  getBusinessProfileForUser(account.uid),
  getUserSubscription(account.uid),
]);
if (!profile) {
  throw new Error("The one-time Wall plan account has no Business Context profile.");
}
if (!subscription.isActive || subscription.planKey !== "starter") {
  throw new Error("The one-time Wall plan account is not an active Pro subscriber.");
}

if (!execute) {
  console.log(JSON.stringify({
    action: "fact-matched-single-pro-wall-plan-backfill",
    accountFound: true,
    databaseWrites: false,
    dryRun: true,
    scope: "Only the verified active Pro account requested for this one-time rollout.",
  }, null, 2));
  process.exit(0);
}

if (!confirmed) {
  throw new Error("Refusing to start customer plan replacements without --yes.");
}

const {
  startWallTextFactMatchedPlanReplacementGeneration,
} = await import("../lib/trending/wall-text-content-plan-generation-job.ts");

const plan = await startWallTextFactMatchedPlanReplacementGeneration({ profile });

console.log(JSON.stringify({
  action: "fact-matched-single-pro-wall-plan-backfill",
  started: plan.status === "generating",
  note: "Each started replacement is a durable background job. The old active plan continues serving until the new 200-item plan activates.",
}, null, 2));

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}
