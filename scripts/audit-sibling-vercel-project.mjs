import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// Read-only inventory. No deployment, project, domain or environment mutations.
const team = "team_ECnoFm5XPu3r2f0qWjLs6Lrk";
const projectId = "prj_sEUePx1qDIZgisRySeJTeMlMGmsI";
const auth = JSON.parse(readFileSync(path.resolve(".tools/vercel-auth/auth.json"), "utf8"));
if (!auth.token) throw new Error("Existing Vercel authentication unavailable");
async function get(endpoint) {
  const url = new URL(endpoint, "https://api.vercel.com");
  url.searchParams.set("teamId", team);
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${auth.token}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Read-only Vercel request failed: HTTP ${response.status}, ${url.pathname}`);
  return response.json();
}
const [project, domains, ready, recent, aliases, websiteAlias, mcpAlias] = await Promise.all([
  get(`/v9/projects/${projectId}`),
  get(`/v9/projects/${projectId}/domains?limit=100`),
  get(`/v6/deployments?projectId=${projectId}&state=READY&limit=1`),
  get(`/v6/deployments?projectId=${projectId}&limit=100`),
  get(`/v4/aliases?projectId=${projectId}&limit=100`),
  get("/v4/aliases/getugcpilot.com"),
  get("/v4/aliases/mcp.getugcpilot.com"),
]);
if (project.id !== projectId || project.accountId !== team || project.name !== "trending-release-web-3f35202") throw new Error("Project identity mismatch");
const result = {
  checkedAt: new Date().toISOString(),
  project: { id: project.id, name: project.name, accountId: project.accountId, createdAt: project.createdAt, framework: project.framework, link: project.link ? { type: project.link.type, repo: project.link.repo, repoId: project.link.repoId, org: project.link.org, productionBranch: project.link.productionBranch, deployHooksCount: project.link.deployHooks?.length ?? 0 } : null, productionBranch: project.link?.productionBranch,
    targets: Object.fromEntries(Object.entries(project.targets ?? {}).map(([key, value]) => [key, { id: value.id, readyState: value.readyState, url: value.url, alias: value.alias }])),
  },
  domains: domains.domains?.map(domain => ({ name: domain.name, verified: domain.verified, redirect: domain.redirect, gitBranch: domain.gitBranch })), domainPagination: domains.pagination,
  readyDeployments: ready.deployments?.map(deployment => ({ uid: deployment.uid, name: deployment.name, url: deployment.url, created: deployment.created, state: deployment.state })),
  recentDeployments: recent.deployments?.map(deployment => ({ uid: deployment.uid, url: deployment.url, created: deployment.created, state: deployment.state, target: deployment.target, sha: deployment.meta?.githubCommitSha })), recentPagination: recent.pagination,
  aliases: aliases.aliases?.map(alias => ({ alias: alias.alias, projectId: alias.projectId, deploymentId: alias.deploymentId, redirect: alias.redirect })), aliasPagination: aliases.pagination,
  primaryDomainOwners: [websiteAlias, mcpAlias].map(alias => ({ alias: alias.alias, projectId: alias.projectId, deploymentId: alias.deployment?.id ?? alias.deploymentId })),
};
const output = path.resolve(process.argv[2] ?? ".tmp/sibling-linux-check/sibling-inventory.json");
mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ checkedAt: result.checkedAt, project: result.project, domains: result.domains, readyCount: result.readyDeployments?.length, recentCount: result.recentDeployments?.length, recentStates: [...new Set(result.recentDeployments?.map(deployment => deployment.state))], aliasCount: result.aliases?.length, primaryDomainOwners: result.primaryDomainOwners, moreDeployments: Boolean(result.recentPagination?.next), moreDomains: Boolean(result.domainPagination?.next), moreAliases: Boolean(result.aliasPagination?.next) }, null, 2));
