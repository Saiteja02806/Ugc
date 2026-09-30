import { validateAuthorizationRequest } from "@/lib/mcp/authorization";

import { OAuthConsent } from "./oauth-consent";

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") continue;
    params.set(key, value);
  }
  const authorization = await validateAuthorizationRequest(params);
  if (!authorization) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Invalid connection request</h1><p className="mt-3">Return to your MCP client and try connecting again.</p></main>;
  }
  return <OAuthConsent
    clientName={authorization.client.clientName}
    redirectHost={new URL(authorization.redirectUri).host}
    scopes={authorization.scopes}
    authorizationParams={params.toString()}
  />;
}
