export const MCP_SCOPES = [
  "account:read",
  "brand:read",
  "assets:read",
  "assets:write",
  "generation:write",
  "jobs:read",
] as const;

export function parseMcpScopes(value: string | null) {
  if (!value) return ["account:read"];
  const scopes = Array.from(new Set(value.split(/\s+/).filter(Boolean)));
  return scopes.length > 0 && scopes.every((scope) => MCP_SCOPES.includes(scope as typeof MCP_SCOPES[number]))
    ? scopes
    : null;
}
