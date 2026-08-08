"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAuth } from "@/contexts/auth-context";
import { consumeGoogleRedirectPending } from "@/lib/firebase/auth";

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
    router.replace(user.emailVerified ? "/dashboard" : "/verify-email");
  }, [loading, router, user]);

  return null;
}
