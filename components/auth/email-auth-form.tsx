"use client";

import { ArrowRight, KeyRound, LoaderCircle, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClassName } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  getFirebaseAuthErrorMessage,
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type EmailAuthMode = "sign-in" | "create-account";

export function EmailAuthForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [mode, setMode] = useState<EmailAuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isCreateMode = mode === "create-account";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (isCreateMode) {
        if (password.length < 6) {
          setErrorMessage("Use a password with at least 6 characters.");
          return;
        }

        await signUpWithEmail(email, password);
        await refreshUser();
        router.replace("/verify-email");

        return;
      }

      const user = await signInWithEmail(email, password);
      await refreshUser();
      router.replace(user.emailVerified ? "/dashboard" : "/verify-email");
    } catch (error) {
      setErrorMessage(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    const trimmedEmail = email.trim();

    setErrorMessage(null);
    setStatusMessage(null);

    if (!trimmedEmail) {
      setErrorMessage("Enter your email address first.");
      return;
    }

    setIsResettingPassword(true);

    try {
      await requestPasswordReset(trimmedEmail);
      setStatusMessage("Password reset email sent.");
    } catch (error) {
      setErrorMessage(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsResettingPassword(false);
    }
  }

  function switchMode(nextMode: EmailAuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-5 grid grid-cols-2 rounded-md bg-card-muted p-1">
        <button
          type="button"
          onClick={() => switchMode("sign-in")}
          aria-pressed={!isCreateMode}
          className={modeButtonClassName(!isCreateMode)}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode("create-account")}
          aria-pressed={isCreateMode}
          className={modeButtonClassName(isCreateMode)}
        >
          Create account
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-foreground">
            Email
          </span>
          <span className="relative block">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-subtle"
              aria-hidden="true"
            />
            <input
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              required
              className={inputClassName}
              placeholder="you@example.com"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-foreground">
            Password
          </span>
          <span className="relative block">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-subtle"
              aria-hidden="true"
            />
            <input
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={isCreateMode ? "new-password" : "current-password"}
              required
              minLength={6}
              className={inputClassName}
              placeholder="At least 6 characters"
            />
          </span>
        </label>

        {!isCreateMode ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={isResettingPassword || isSubmitting}
              className="inline-flex items-center gap-2 text-sm font-bold text-primary transition hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {isResettingPassword ? "Sending…" : "Reset password"}
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || isResettingPassword}
          className={buttonClassName({
            className: "h-12 w-full gap-2 rounded-2xl",
          })}
        >
          {isSubmitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
          {isSubmitting
            ? isCreateMode
              ? "Creating account…"
              : "Signing in…"
            : isCreateMode
              ? "Continue with Email"
              : "Sign in with Email"}
        </button>
      </form>

      {statusMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-center text-sm font-semibold text-success"
        >
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 text-center text-sm font-semibold text-error"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "h-12 w-full rounded-lg border border-border bg-background/70 py-2 pl-10 pr-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-subtle focus:border-focus focus:ring-2 focus:ring-focus/20";

function modeButtonClassName(isActive: boolean) {
  return cn(
    "h-9 rounded-lg text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-focus",
    isActive
      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
      : "text-muted hover:text-foreground",
  );
}
