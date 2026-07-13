import { NextResponse } from "next/server";

import {
  completeOAuthCallback,
  isSocialPlatform,
  SocialOAuthError,
} from "@/lib/social/oauth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string }> },
) {
  const { platform } = await context.params;
  const url = new URL(request.url);
  const appBaseUrl = process.env.APP_BASE_URL?.trim() || "https://getugcpilot.com";

  if (!isSocialPlatform(platform)) {
    return NextResponse.redirect(
      new URL("/connected-accounts?error=unsupported_platform", appBaseUrl),
    );
  }

  const providerError = url.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      buildErrorRedirect({
        appBaseUrl,
        message: providerError,
        platform,
      }),
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      buildErrorRedirect({
        appBaseUrl,
        message: "missing_code_or_state",
        platform,
      }),
    );
  }

  try {
    const result = await completeOAuthCallback({ code, platform, state });
    return NextResponse.redirect(new URL(result.redirectTo, appBaseUrl));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finish account connection.";
    const safeMessage =
      error instanceof SocialOAuthError ? message : "connection_failed";

    console.error(`Failed to finish ${platform} OAuth callback:`, error);

    return NextResponse.redirect(
      buildErrorRedirect({ appBaseUrl, message: safeMessage, platform }),
    );
  }
}

function buildErrorRedirect(params: {
  appBaseUrl: string;
  message: string;
  platform: string;
}) {
  const redirectUrl = new URL("/connected-accounts", params.appBaseUrl);
  redirectUrl.searchParams.set("platform", params.platform);
  redirectUrl.searchParams.set("error", params.message.slice(0, 240));
  return redirectUrl;
}
