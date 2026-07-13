import "server-only";

import {
  completeSocialOAuthCallback,
  consumeDeniedSocialOAuthCallback,
  getSocialAppBaseUrl,
  SocialOAuthError,
} from "@/lib/social/oauth";
import type {
  SocialOAuthResultMessage,
  SocialPlatform,
  SocialProvider,
} from "@/lib/social/types";

export async function handleSocialOAuthCallback(
  request: Request,
  config: {
    platform: SocialPlatform;
    provider: SocialProvider;
  },
) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state")?.trim() ?? "";
  const providerError = url.searchParams.get("error")?.trim();

  if (providerError) {
    let errorCode = "authorization_denied";

    if (state) {
      try {
        await consumeDeniedSocialOAuthCallback({ ...config, state });
      } catch (error) {
        errorCode = getSafeErrorCode(error);
      }
    } else {
      errorCode = "missing_callback_parameters";
    }

    return renderCallbackPage({
      errorCode,
      message: getFailureMessage(config.platform, errorCode),
      ...config,
      status: "error",
    });
  }

  const code = url.searchParams.get("code")?.trim() ?? "";

  if (!code || !state) {
    return renderCallbackPage({
      errorCode: "missing_callback_parameters",
      message: "The provider did not return a complete authorization response.",
      ...config,
      status: "error",
    });
  }

  try {
    await completeSocialOAuthCallback({ code, state, ...config });

    return renderCallbackPage({
      message: `${getPlatformLabel(config.platform)} is connected.`,
      ...config,
      status: "success",
    });
  } catch (error) {
    const errorCode = getSafeErrorCode(error);

    console.error("Social OAuth callback failed", {
      code: errorCode,
      platform: config.platform,
      provider: config.provider,
    });

    return renderCallbackPage({
      errorCode,
      message: getFailureMessage(config.platform, errorCode),
      ...config,
      status: "error",
    });
  }
}

function renderCallbackPage(params: {
  errorCode?: string;
  message: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  status: "error" | "success";
}) {
  const appBaseUrl = getSocialAppBaseUrl();
  const targetOrigin = new URL(appBaseUrl).origin;
  const payload: SocialOAuthResultMessage = {
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
    platform: params.platform,
    provider: params.provider,
    status: params.status,
    type: "ugc-social-oauth-result",
  };
  const safePayload = safeInlineJson(payload);
  const safeTargetOrigin = safeInlineJson(targetOrigin);
  const returnUrl = new URL("/connected-accounts", appBaseUrl).toString();
  const title = params.status === "success" ? "Account connected" : "Connection failed";
  const statusClass = params.status === "success" ? "success" : "error";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | UGC Pilot</title>
    <style>
      :root { color-scheme: light; font-family: Arial, sans-serif; }
      body { align-items: center; background: #f4f4f5; color: #18181b; display: flex; justify-content: center; margin: 0; min-height: 100vh; padding: 24px; }
      main { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; max-width: 420px; padding: 28px; text-align: center; width: 100%; }
      .mark { align-items: center; border-radius: 50%; display: inline-flex; font-size: 20px; font-weight: 700; height: 44px; justify-content: center; width: 44px; }
      .success { background: #dcfce7; color: #15803d; }
      .error { background: #fee2e2; color: #b91c1c; }
      h1 { font-size: 20px; margin: 18px 0 8px; }
      p { color: #52525b; font-size: 14px; line-height: 1.6; margin: 0; }
      a { color: #9a3412; display: inline-block; font-size: 14px; font-weight: 700; margin-top: 20px; }
    </style>
  </head>
  <body>
    <main>
      <span class="mark ${statusClass}" aria-hidden="true">${params.status === "success" ? "&#10003;" : "!"}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(params.message)}</p>
      <a href="${escapeHtml(returnUrl)}">Return to connected accounts</a>
    </main>
    <script>
      (() => {
        const payload = ${safePayload};
        const targetOrigin = ${safeTargetOrigin};

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, targetOrigin);
          window.setTimeout(() => window.close(), 650);
        }
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

function getSafeErrorCode(error: unknown) {
  return error instanceof SocialOAuthError
    ? error.code
    : "connection_failed";
}

function getFailureMessage(platform: SocialPlatform, errorCode: string) {
  if (errorCode === "authorization_denied") {
    return `${getPlatformLabel(platform)} authorization was cancelled.`;
  }

  if (errorCode === "invalid_or_expired_state") {
    return "This connection request is invalid or has expired. Return to UGC Pilot and try again.";
  }

  if (errorCode === "eligible_instagram_account_missing") {
    return "No eligible Instagram professional account was found for this Meta login.";
  }

  if (errorCode === "youtube_channel_missing") {
    return "No YouTube channel was found for this Google account.";
  }

  return `${getPlatformLabel(platform)} could not be connected. Return to UGC Pilot and try again.`;
}

function getPlatformLabel(platform: SocialPlatform) {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
  }
}

function safeInlineJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
