"use client";

import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

import { OAuthConsentView } from "./oauth-consent-view";

export function OAuthConsent({
  clientName,
  redirectHost,
  scopes,
  authorizationParams,
}: {
  clientName: string;
  redirectHost: string;
  scopes: string[];
  authorizationParams: string;
}) {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ authorizationParams, approve }),
      });
      const result = await response.json() as { redirect_url?: string };
      if (!response.ok || !result.redirect_url) throw new Error("Connection could not be completed. Try again.");
      window.location.assign(result.redirect_url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection failed.");
      setBusy(false);
    }
  }

  return (
    <OAuthConsentView
      clientName={clientName}
      redirectHost={redirectHost}
      redirectTitle={`Return to ${redirectHost}`}
      redirectDescription="After approval, this browser will return to the app that started the connection."
      scopes={scopes}
      accountLabel={user ? user.email ?? user.displayName ?? "UGC Pilot account" : null}
      emailVerified={user?.emailVerified ?? false}
      loading={loading}
      busy={busy}
      error={error}
      signInControl={<GoogleSignInButton successPath={`/oauth/authorize?${authorizationParams}`} />}
      onDecision={(approve) => void decide(approve)}
    />
  );
}
