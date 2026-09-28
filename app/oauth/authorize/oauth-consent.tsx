"use client";

import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

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

  return <main className="mx-auto max-w-xl p-8">
    <h1 className="text-2xl font-bold">Connect {clientName} to UGC Pilot?</h1>
    <p className="mt-3">This client will return to <strong>{redirectHost}</strong>.</p>
    <p className="mt-4">Requested access:</p>
    <ul className="mt-2 list-disc pl-6">{scopes.map((scope) => <li key={scope}>{scope}</li>)}</ul>
    {loading ? <p className="mt-6">Checking your sign-in…</p> : !user ?
      <div className="mt-6"><GoogleSignInButton successPath={`/oauth/authorize?${authorizationParams}`} /></div> :
      !user.emailVerified ? <p className="mt-6">Verify your email in UGC Pilot before connecting.</p> :
      <div className="mt-6 flex gap-3">
        <button type="button" disabled={busy} onClick={() => void decide(true)} className="rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">Allow access</button>
        <button type="button" disabled={busy} onClick={() => void decide(false)} className="rounded-lg border px-5 py-3 disabled:opacity-50">Cancel</button>
      </div>}
    {error && <p className="mt-4 text-red-600" role="alert">{error}</p>}
  </main>;
}
