"use client";

import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { GoogleSignInButton } from "./google-sign-in-button";
import { EmailAuthForm } from "./email-auth-form";
import { Button } from "@/components/ui/button";
import { getEmailVerificationPath, type EmailPurchaseIntent } from "@/lib/auth/email-policy";

export function AuthMethodPicker({
  successPath = "/dashboard", intent = {}, onAuthFlowStart,
}: {
  successPath?: string;
  intent?: EmailPurchaseIntent;
  onAuthFlowStart?: () => void;
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  if (showEmail) {
    return (
      <div>
        <button type="button" onClick={() => setShowEmail(false)} disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">
          <ArrowLeft className="size-4" aria-hidden="true" /> All sign-in options
        </button>
        <EmailAuthForm successPath={successPath} intent={intent}
          onAuthFlowStart={onAuthFlowStart} onBusyChange={setIsBusy} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <GoogleSignInButton label="Sign in with Google" successPath={successPath}
        verificationPath={getEmailVerificationPath(intent)} />
      <Button type="button" variant="outline" size="auth" className="w-full gap-3 font-semibold"
        onClick={() => setShowEmail(true)}>
        <Mail className="size-5" aria-hidden="true" /> Continue with email
      </Button>
    </div>
  );
}
