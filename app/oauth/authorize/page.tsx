import type { Metadata } from "next";

import { validateAuthorizationRequest } from "@/lib/mcp/authorization";
import { classifyRedirectDestination } from "@/lib/mcp/client-validation";

import { ConsentBrandMark } from "./consent-brand-mark";
import { OAuthConsent } from "./oauth-consent";

export const metadata: Metadata = {
  title: "Connect an app",
  description: "Review and approve access to your UGC Pilot account.",
};

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
    return (
      <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_42%)]"
        />
        <section className="w-full max-w-md rounded-[24px] border border-border bg-card p-6 text-center shadow-[0_24px_80px_rgb(0_0_0/0.22)] sm:p-8">
          <ConsentBrandMark className="mx-auto size-12 rounded-2xl shadow-sm" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Connection request
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-foreground-strong">
            This connection link is invalid
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Return to your MCP client and start the UGC Pilot connection again.
          </p>
        </section>
      </main>
    );
  }
  const redirectUrl = new URL(authorization.redirectUri);
  const redirectDestination = classifyRedirectDestination(authorization.redirectUri);

  return <OAuthConsent
    clientName={authorization.client.clientName}
    redirectHost={redirectUrl.host}
    redirectDestination={redirectDestination}
    scopes={authorization.scopes}
    authorizationParams={params.toString()}
  />;
}
