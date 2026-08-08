"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getFirebaseAuthErrorMessage,
  signInWithGoogle,
  signInWithGoogleRedirect,
} from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type GoogleSignInButtonProps = {
  appearance?: "card" | "header" | "menu";
  label?: string;
};

export function GoogleSignInButton({
  appearance = "card",
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isCard = appearance === "card";

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
        try {
          await signInWithGoogleRedirect();
        } catch (redirectError) {
          setErrorMessage(getFirebaseAuthErrorMessage(redirectError));
        }
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
    <div
      className={cn(
        isCard ? "w-full" : "relative",
        appearance === "header" ? "shrink-0" : "w-full",
      )}
    >
      <Button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        aria-busy={isLoading}
        variant="muted"
        size={isCard ? "auth" : "auth-compact"}
        className={cn(
          "font-semibold shadow-sm",
          isCard && "w-full",
          appearance === "menu" && "w-full justify-start",
        )}
      >
        <Image
          aria-hidden="true"
          alt=""
          src="/icons/google.svg"
          width={20}
          height={20}
          unoptimized
          className={cn(
            "shrink-0",
            isCard ? "size-5" : "size-[18px]",
          )}
        />
        <span>{isLoading ? "Signing in…" : label}</span>
      </Button>

      {errorMessage ? (
        <p
          role="alert"
          className={
            isCard
              ? "mt-3 text-center text-sm font-semibold text-error"
              : appearance === "header"
                ? "absolute right-0 top-[calc(100%+0.625rem)] z-50 w-72 rounded-control border border-border bg-card/95 px-3 py-2.5 text-left text-xs font-medium leading-5 text-error shadow-floating backdrop-blur-xl"
                : "mt-2 px-3 text-left text-xs font-medium leading-5 text-error"
          }
        >
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
