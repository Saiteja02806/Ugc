"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAuth } from "@/contexts/auth-context";
import { consumeGoogleRedirectPending, trackGoogleRedirectAccountCreated } from "@/lib/firebase/auth";
import { getPostSignInDestination } from "@/lib/billing/purchase-intent";

export function GoogleAuthRedirectHandler() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || loading || !user) {
      return;
    }

    if (!consumeGoogleRedirectPending()) {
      return;
    }

    handledRef.current = true;
    void trackGoogleRedirectAccountCreated();
    if (user.emailVerified && window.location.pathname === "/oauth/authorize") {
      // Firebase returns to the page that started redirect sign-in. Keep the
      // OAuth request and consent screen instead of sending the user home.
      return;
    }
    const destination = window.location.pathname === "/sign-in"
      ? getPostSignInDestination(new URLSearchParams(window.location.search)) : "/explore";
    router.replace(user.emailVerified ? destination : "/verify-email");
  }, [loading, router, user]);

  return null;
}
