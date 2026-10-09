"use client";

import {
  applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode,
} from "firebase/auth";
import { CheckCircle2, LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getSafeEmailContinuePath } from "@/lib/auth/email-policy";
import { auth } from "@/lib/firebase/client";

type ActionState = "checking" | "verify" | "reset" | "success" | "error";

export default function EmailActionPage() {
  return <Suspense fallback={<main className="min-h-screen bg-background" />}><EmailActionRouter /></Suspense>;
}

function EmailActionRouter() {
  const params = useSearchParams();
  return <EmailActionContent key={params.toString()} mode={params.get("mode")}
    code={params.get("oobCode")} continueUrl={params.get("continueUrl")} />;
}

function EmailActionContent({ mode, code, continueUrl }: {
  mode: string | null; code: string | null; continueUrl: string | null;
}) {
  const { refreshUser, signOut } = useAuth();
  const [state, setState] = useState<ActionState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continuePath] = useState(() => getSafeEmailContinuePath(
    continueUrl, typeof window === "undefined" ? "https://getugcpilot.com" : window.location.origin,
  ));

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!code || !["verifyEmail", "resetPassword"].includes(mode || "")) {
        throw new Error("invalid-action");
      }
      if (mode === "resetPassword") {
        const targetEmail = await verifyPasswordResetCode(auth, code);
        if (!cancelled) { setEmail(targetEmail); setState("reset"); }
      } else {
        const action = await checkActionCode(auth, code);
        if (action.operation !== "VERIFY_EMAIL") throw new Error("invalid-action");
        if (!cancelled) { setEmail(action.data.email || ""); setState("verify"); }
      }
    }
    void validate().catch(() => {
      if (!cancelled) {
        setError("This link is invalid, expired, or has already been used. Request a new email to continue.");
        setState("error");
      }
    });
    return () => { cancelled = true; };
  }, [code, mode]);

  async function handleVerify() {
    if (!code) return;
    setIsBusy(true);
    setError(null);
    try {
      await applyActionCode(auth, code);
      setState("success");
      if (auth.currentUser?.email?.toLowerCase() === email.toLowerCase()) {
        // Verification is complete even if refreshing this browser's session fails.
        await refreshUser().catch(() => null);
      }
    } catch {
      setError("This link could not be verified. Request a new verification email and try again.");
      setState("error");
    } finally { setIsBusy(false); }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) { setError("The passwords don't match."); return; }
    if (password.length < 6) { setError("Use a password with at least 6 characters."); return; }
    if (!code) return;
    setIsBusy(true);
    try {
      await confirmPasswordReset(auth, code, password);
      setPassword("");
      setConfirmation("");
      setState("success");
    } catch (resetError) {
      const failure = (resetError as { code?: string })?.code;
      if (failure === "auth/weak-password" || failure === "auth/password-does-not-meet-requirements") {
        setError("Use a stronger password that meets your account's password requirements.");
      } else if (failure === "auth/network-request-failed") {
        setError("Check your connection and try again.");
      } else {
        setError("This reset link is invalid or expired. Request a new password reset email.");
        setState("error");
      }
    } finally { setIsBusy(false); }
  }

  async function handleContinue() {
    setIsBusy(true);
    try {
      await auth.authStateReady();
      // A password reset requires a fresh sign-in. A verification link must never
      // silently open a different account that happens to be signed in here.
      if (mode === "resetPassword" ||
          (auth.currentUser && auth.currentUser.email?.toLowerCase() !== email.toLowerCase())) {
        await signOut();
      }
      window.location.assign(continuePath);
    } catch {
      setError("Could not open sign-in. Please try again.");
      setIsBusy(false);
    }
  }

  const success = state === "success";
  const title = success ? (mode === "verifyEmail" ? "Email verified" : "Password updated") :
    state === "reset" ? "Create a new password" : state === "verify" ? "Verify your email" :
      state === "error" ? "Request a new link" : "Checking your link";

  return (
    <main className="instagram-theme min-h-screen bg-background px-5 text-foreground sm:px-8">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 rounded-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <ProductLogoMark className="size-9 rounded-control bg-primary p-2" imageClassName="brightness-0 invert" sizes="36px" />
          UGC Pilot
        </Link>
        <Link href="/sign-in" className="text-sm font-semibold text-muted hover:text-foreground">Sign in</Link>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center pb-12">
        <div className="w-full max-w-[420px] rounded-3xl border border-border bg-card/95 p-7 shadow-floating sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-primary">
              {state === "checking" ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> :
                success ? <CheckCircle2 className="size-7" aria-hidden="true" /> : <MailCheck className="size-7" aria-hidden="true" />}
            </div>
            <h1 className="text-3xl font-bold tracking-normal">{title}</h1>
            {email && !success ? <p className="mt-3 break-words text-sm text-muted">{email}</p> : null}
            {success ? <p role="status" className="mt-3 text-sm leading-6 text-muted">
              {mode === "verifyEmail" ? "Your email has been verified. You're ready to continue." : "Your password has been changed. Sign in with your new password."}
            </p> : null}
          </div>
          {state === "verify" ? <div className="space-y-5">
            <p className="text-center text-sm leading-6 text-muted">Confirm your email address to open your workspace.</p>
            <Button className="h-12 w-full" disabled={isBusy} onClick={handleVerify}>{isBusy ? "Verifying…" : "Verify email"}</Button>
          </div> : null}
          {state === "reset" ? <form onSubmit={handleReset} className="space-y-4">
            <label className="block text-sm font-semibold">New password
              <input type="password" autoComplete="new-password" minLength={6} required value={password}
                onChange={(event) => setPassword(event.target.value)} disabled={isBusy}
                className={passwordInputClass} />
            </label>
            <label className="block text-sm font-semibold">Confirm password
              <input type="password" autoComplete="new-password" minLength={6} required value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)} disabled={isBusy}
                className={passwordInputClass} />
            </label>
            <Button type="submit" className="h-12 w-full" disabled={isBusy}>{isBusy ? "Updating…" : "Reset password"}</Button>
          </form> : null}
          {success ? <Button className="h-12 w-full" disabled={isBusy} onClick={handleContinue}>
            {isBusy ? "Opening…" : mode === "verifyEmail" ? "Continue to UGC Pilot" : "Continue to sign in"}
          </Button> : null}
          {error ? <p role="alert" className="mt-4 text-center text-sm leading-6 text-error">{error}</p> : null}
          {state === "error" ? <Link href={continuePath} className="mt-6 block rounded-lg text-center text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Return to sign in</Link> : null}
        </div>
      </section>
    </main>
  );
}

const passwordInputClass = "mt-2 h-12 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-focus focus:ring-2 focus:ring-focus/20";
