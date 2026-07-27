"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  getFirebaseAuthErrorMessage,
  signInWithGoogle,
} from "@/lib/firebase/auth";

export function GoogleSignInButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await signInWithGoogle();
      router.push(user.emailVerified ? "/dashboard" : "/verify-email");
    } catch (error) {
      if (isFirebaseError(error, "auth/popup-closed-by-user")) {
        setErrorMessage("Sign-in was cancelled. Try again when you are ready.");
      } else if (isFirebaseError(error, "auth/popup-blocked")) {
        setErrorMessage("Popup was blocked. Please allow popups and try again.");
      } else if (isMissingInitialStateError(error)) {
        setErrorMessage(
          "Your browser lost the Google sign-in state. Refresh this page and try again.",
        );
      } else {
        setErrorMessage(getFirebaseAuthErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-control border border-border bg-card-muted px-5 text-sm font-bold text-foreground shadow-sm transition hover:border-border-strong hover:bg-[#2d2d2d] hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center text-sm font-bold text-[#4285f4]"
        >
          G
        </span>
        {isLoading ? "Signing in..." : "Sign in with Google"}
      </button>

      {errorMessage ? (
        <p className="mt-3 rounded-control border border-error/35 bg-error/10 px-3 py-2 text-sm font-semibold text-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function isFirebaseError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function isMissingInitialStateError(error: unknown) {
  if (isFirebaseError(error, "auth/missing-or-invalid-nonce")) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("missing initial state")
  );
}
