import "server-only";

import {
  completeSocialOAuthCallback,
  createSocialOAuthCorrelationId,
  consumeDeniedSocialOAuthCallback,
  getSocialPlatformRedirectUri,
  getSocialAppBaseUrl,
  logSocialOAuthTrace,
  SocialOAuthError,
  type SocialOAuthTraceContext,
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
  const trace: SocialOAuthTraceContext = {
    callbackHost: url.host,
    correlationId: createSocialOAuthCorrelationId(),
  };
  const state = url.searchParams.get("state")?.trim() ?? "";
  const providerError = url.searchParams.get("error")?.trim();

  logSocialOAuthTrace(trace, "code_received", {
    appBaseHostMatchesCallback: hostMatchesCallback(
      getSocialAppBaseUrl(),
      url.host,
    ),
    configuredRedirectHostMatchesCallback: hostMatchesCallback(
      getSocialPlatformRedirectUri(config.platform),
      url.host,
    ),
    hasCode: Boolean(url.searchParams.get("code")?.trim()),
    hasCookieHeader: Boolean(request.headers.get("cookie")),
    hasProviderError: Boolean(providerError),
    hasState: Boolean(state),
    providerErrorCode: normalizeLogValue(providerError),
  });

  if (providerError) {
    let errorCode = "authorization_denied";
    let failedStage = "provider_authorization";

    if (state) {
      try {
        await consumeDeniedSocialOAuthCallback({ ...config, state, trace });
      } catch (error) {
        errorCode = getSafeErrorCode(error);
        failedStage = getSafeErrorStage(error);
      }
    } else {
      errorCode = "missing_callback_parameters";
      failedStage = "code_received";
    }

    return renderCallbackPage({
      callbackHost: trace.callbackHost,
      correlationId: trace.correlationId,
      errorCode,
      failedStage,
      message: getFailureMessage(config.platform, errorCode),
      ...config,
      status: "error",
    });
  }

  const code = url.searchParams.get("code")?.trim() ?? "";

  if (!code || !state) {
    logSocialOAuthTrace(trace, "code_received", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
    });

    return renderCallbackPage({
      callbackHost: trace.callbackHost,
      correlationId: trace.correlationId,
      errorCode: "missing_callback_parameters",
      failedStage: "code_received",
      message: "The provider did not return a complete authorization response.",
      ...config,
      status: "error",
    });
  }

  try {
    await completeSocialOAuthCallback({ code, state, trace, ...config });

    logSocialOAuthTrace(trace, "callback_completed", {
      callbackSucceeded: true,
      databaseRowVerified: true,
    });

    return renderCallbackPage({
      callbackHost: trace.callbackHost,
      correlationId: trace.correlationId,
      message: `${getPlatformLabel(config.platform)} is connected.`,
      ...config,
      status: "success",
    });
  } catch (error) {
    const errorCode = getSafeErrorCode(error);
    const failedStage = getSafeErrorStage(error);

    logSocialOAuthTrace(trace, "callback_completed", {
      callbackSucceeded: false,
    });

    return renderCallbackPage({
      callbackHost: trace.callbackHost,
      correlationId: trace.correlationId,
      errorCode,
      failedStage,
      message: getFailureMessage(config.platform, errorCode),
      ...config,
      status: "error",
    });
  }
}

function renderCallbackPage(params: {
  callbackHost: string;
  correlationId: string;
  errorCode?: string;
  failedStage?: string;
  message: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  status: "error" | "success";
}) {
  const appBaseUrl = getSocialAppBaseUrl();
  const targetOrigins = getAllowedTargetOrigins(appBaseUrl);
  const payload: SocialOAuthResultMessage = {
    callbackHost: params.callbackHost,
    correlationId: params.correlationId,
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
    ...(params.failedStage ? { failedStage: params.failedStage } : {}),
    platform: params.platform,
    provider: params.provider,
    status: params.status,
    type: "ugc-social-oauth-result",
  };
  const safePayload = safeInlineJson(payload);
  const safeTargetOrigins = safeInlineJson(targetOrigins);
  const returnUrl = new URL("/connected-accounts", appBaseUrl).toString();
  const title = params.status === "success" ? "Account connected" : "Connection failed";
  const statusClass = params.status === "success" ? "success" : "error";
  const fallbackMessage =
    params.status === "success"
      ? `${getPlatformLabel(params.platform)} connected successfully. You may close this window.`
      : "Keep this window open while you check the failed stage below.";
  const failedStage = params.failedStage ?? "unknown";
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
      dl { border-top: 1px solid #e4e4e7; margin: 18px 0 0; padding-top: 16px; text-align: left; }
      dt { color: #71717a; font-size: 11px; font-weight: 700; letter-spacing: 0; margin-top: 12px; text-transform: uppercase; }
      dd { color: #18181b; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 6px 0 0; overflow-wrap: anywhere; }
      p[hidden] { display: none; }
      a { color: #9a3412; display: inline-block; font-size: 14px; font-weight: 700; margin-top: 20px; }
    </style>
  </head>
  <body>
    <main>
      <span class="mark ${statusClass}" aria-hidden="true">${params.status === "success" ? "&#10003;" : "!"}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(params.message)}</p>
      <p id="manual-close-message" hidden>${escapeHtml(fallbackMessage)}</p>
      ${params.status === "error" ? `<dl><dt>Failed stage</dt><dd>${escapeHtml(failedStage)}</dd><dt>Correlation ID</dt><dd>${escapeHtml(params.correlationId)}</dd></dl>` : ""}
      <a href="${escapeHtml(returnUrl)}">Return to connected accounts</a>
    </main>
    <script>
      (() => {
        const payload = ${safePayload};
        const targetOrigins = ${safeTargetOrigins};
        let posted = false;

        if (window.opener && !window.opener.closed) {
          for (const targetOrigin of targetOrigins) {
            try {
              window.opener.postMessage(payload, targetOrigin);
              posted = true;
            } catch {}
          }
        }

        if (payload.status === "success") {
          window.setTimeout(() => window.close(), posted ? 650 : 1200);
        }

        window.setTimeout(() => {
          const message = document.getElementById("manual-close-message");
          if (message) {
            message.hidden = false;
          }
        }, 1600);
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

function getSafeErrorStage(error: unknown) {
  return error instanceof SocialOAuthError && error.stage
    ? error.stage
    : "unknown";
}

function hostMatchesCallback(value: string, callbackHost: string) {
  try {
    return new URL(value).host === callbackHost;
  } catch {
    return false;
  }
}

function getAllowedTargetOrigins(appBaseUrl: string) {
  const appOrigin = new URL(appBaseUrl).origin;
  const origins = new Set([appOrigin]);
  const parsed = new URL(appOrigin);

  if (parsed.hostname === "getugcpilot.com") {
    origins.add(`${parsed.protocol}//www.getugcpilot.com`);
  }

  if (parsed.hostname === "www.getugcpilot.com") {
    origins.add(`${parsed.protocol}//getugcpilot.com`);
  }

  return [...origins];
}

function normalizeLogValue(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.slice(0, 160);
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
