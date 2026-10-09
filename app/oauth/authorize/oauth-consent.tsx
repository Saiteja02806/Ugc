"use client";

import { useState } from "react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { RedirectDestination } from "@/lib/mcp/client-validation";
import { OAuthConsentView } from "./oauth-consent-view";

export function OAuthConsent({
  clientName,
  redirectHost,
  redirectDestination,
  scopes,
  authorizationParams,
}: {
  clientName: string;
  redirectHost: string;
  redirectDestination: RedirectDestination;
  scopes: string[];
  authorizationParams: string;
}) {
  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getCurrentUserIdToken(user.uid);
      if (!token) throw new Error("Sign in again to connect.");
      const response = await fetch("/oauth/authorize/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ authorizationParams, approve }),
      });
      const result = (await response.json()) as { redirect_url?: string };
      if (!response.ok || !result.redirect_url) {
        throw new Error("Connection could not be completed. Try again.");
      }
      window.location.assign(result.redirect_url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Connection failed.",
      );
      setBusy(false);
    }
  }

  async function switchAccount() {
    if (busy || switchingAccount) return;
    setSwitchingAccount(true);
    setError(null);

    try {
      await signOut();
    } catch {
      setError("Could not sign out. Refresh the page and try again.");
    } finally {
      setSwitchingAccount(false);
    }
  }

  const accountLabel = user?.email ?? user?.displayName ?? "UGC Pilot account";
  const redirectTitle = redirectDestination === "chatgpt"
    ? "Return to ChatGPT"
    : redirectDestination === "claude"
      ? "Return to Claude"
      : redirectDestination === "loopback"
        ? "Return to the app on this device"
        : `Return to ${redirectHost}`;
  const redirectDescription = redirectDestination === "chatgpt"
    ? "After approval, this browser will return securely to ChatGPT."
    : redirectDestination === "claude"
      ? "After approval, this browser will return securely to Claude."
      : redirectDestination === "loopback"
        ? "This local address returns control to the desktop or command-line app that started the connection. Keep that app open."
        : "After approval, this browser will return to the requesting app.";

  return (
    <OAuthConsentView
      clientName={clientName}
      redirectHost={redirectHost}
      redirectTitle={redirectTitle}
      redirectDescription={redirectDescription}
      isLocalCallback={redirectDestination === "loopback"}
      scopes={scopes}
      accountLabel={user ? accountLabel : null}
      emailVerified={user?.emailVerified ?? false}
      loading={loading}
      busy={busy}
      switchingAccount={switchingAccount}
      error={error}
      signInControl={
        <GoogleSignInButton
          label="Sign in with Google"
          successPath={"/oauth/authorize?" + authorizationParams}
        />
      }
      onDecision={(approve) => void decide(approve)}
      onSwitchAccount={() => void switchAccount()}
    />
  );
}
