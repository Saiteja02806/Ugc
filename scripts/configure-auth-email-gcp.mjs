import assert from "node:assert/strict";
import { GoogleAuth } from "google-auth-library";

// Uses the operator's existing Google ADC. Never reads or prints private keys.
const project = "ugcsaas";
const principal = `serviceAccount:ugc-app-sa@${project}.iam.gserviceaccount.com`;
const roleId = "ugcAuthEmailSender";
const roleName = `projects/${project}/roles/${roleId}`;
const permissions = ["firebaseauth.users.sendEmail"];
const execute = process.argv.includes("--execute") && process.argv.includes("--yes");
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
const call = async (url, method = "GET", data) => (await client.request({ url, method, ...(data ? { data } : {}), timeout: 15000 })).data;

try {
  let role;
  try { role = await call(`https://iam.googleapis.com/v1/${roleName}`); }
  catch (error) { if (error.response?.status !== 404) throw error; }
  if (role) {
    assert.deepEqual([...role.includedPermissions].sort(), permissions);
    assert.ok(!role.deleted && role.stage !== "DISABLED");
  }
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const current = await call(`${url}:getIamPolicy`, "POST", { options: { requestedPolicyVersion: 3 } });
  const alreadyGranted = current.bindings?.some((binding) => binding.role === roleName && !binding.condition && binding.members.includes(principal));
  console.log(JSON.stringify({ project, principal, role: roleName, permissions, roleExists: Boolean(role), alreadyGranted, execute }));
  if (!execute) {
    console.log("Dry run. Use --execute --yes to apply only this custom role and binding.");
  } else {
    if (!role) await call(`https://iam.googleapis.com/v1/projects/${project}/roles`, "POST", {
      roleId, role: { title: "UGC authentication email links", description: "Generate Firebase verification and password-reset email links.", includedPermissions: permissions, stage: "GA" },
    });
    if (!alreadyGranted) {
      // Read again after creating the role. Preserve all existing bindings and the
      // policy etag so a concurrent IAM edit causes a conflict rather than loss.
      const policy = await call(`${url}:getIamPolicy`, "POST", { options: { requestedPolicyVersion: 3 } });
      policy.bindings ??= [];
      let binding = policy.bindings.find((item) => item.role === roleName && !item.condition);
      if (!binding) { binding = { role: roleName, members: [] }; policy.bindings.push(binding); }
      if (!binding.members.includes(principal)) binding.members.push(principal);
      await call(`${url}:setIamPolicy`, "POST", { policy });
    }
    const saved = await call(`${url}:getIamPolicy`, "POST", { options: { requestedPolicyVersion: 3 } });
    assert.ok(saved.bindings.some((binding) => binding.role === roleName && !binding.condition && binding.members.includes(principal)));
    const savedRole = await call(`https://iam.googleapis.com/v1/${roleName}`);
    assert.deepEqual([...savedRole.includedPermissions].sort(), permissions);
    console.log("Verified: the app account has only the requested custom-role permission in this new binding.");
  }
} catch (error) {
  // Provider error objects can contain bearer credentials; keep diagnostics safe.
  console.error(JSON.stringify({ action: "configure-auth-email-gcp", status: error.response?.status ?? "failed", message: "Could not verify or apply the scoped email-link permission." }));
  process.exitCode = 1;
}
