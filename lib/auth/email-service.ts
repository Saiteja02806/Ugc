import "server-only";

import { randomUUID } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

import { getGoogleServiceAccountCredentials, getMissingVercelGcpCredentialEnvVars } from "../gcp/credentials";
import {
  AuthEmailError, buildBrandedEmailActionLink, getEmailAuthAppUrl,
  getEmailSignInPath, type AuthEmailKind, type EmailPurchaseIntent,
} from "./email-policy";

export function getAuthEmailConfiguration() {
  const key = process.env.RESEND_API_KEY?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!key || !projectId || getMissingVercelGcpCredentialEnvVars().length) {
    throw new AuthEmailError("Email delivery is temporarily unavailable. Please try again later.");
  }
  return {
    key, projectId,
    appUrl: getEmailAuthAppUrl(),
    from: process.env.EMAIL_FROM?.trim() || "UGC Pilot <admin@getugcpilot.com>",
    verificationTemplate: process.env.RESEND_VERIFICATION_TEMPLATE_ID?.trim() || "email-verification",
    resetTemplate: process.env.RESEND_PASSWORD_RESET_TEMPLATE_ID?.trim() || "forgot-your-password",
  };
}

export async function deliverAuthEmail(
  kind: AuthEmailKind,
  email: string,
  intent: EmailPurchaseIntent = {},
) {
  const config = getAuthEmailConfiguration();
  const credentials = getGoogleServiceAccountCredentials();
  const client = await new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  }).getClient();
  let firebaseLink: string;
  try {
    const response = await client.request<{ oobLink?: string }>({
      method: "POST",
      url: `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/accounts:sendOobCode`,
      timeout: 10_000,
      data: {
        requestType: kind === "verification" ? "VERIFY_EMAIL" : "PASSWORD_RESET",
        email,
        returnOobLink: true,
        continueUrl: new URL(getEmailSignInPath(intent), config.appUrl).href,
      },
    });
    if (!response.data.oobLink) throw new Error("missing-link");
    firebaseLink = response.data.oobLink;
  } catch (error) {
    const code = (error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message;
    if (kind === "password-reset" && code === "EMAIL_NOT_FOUND") return;
    // Google errors can contain credentials and action codes; never expose them.
    throw new AuthEmailError("Could not prepare your email. Please try again later.");
  }
  const link = buildBrandedEmailActionLink(firebaseLink, config.appUrl, kind, intent);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `auth-${kind}-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: kind === "verification" ? "Verify your email for UGC Pilot" : "Reset your UGC Pilot password",
      template: {
        id: kind === "verification" ? config.verificationTemplate : config.resetTemplate,
        variables: kind === "verification" ? { VERIFICATION_URL: link } : { RESET_URL: link },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new AuthEmailError("Could not send your email. Please try again later.");
  }
}
