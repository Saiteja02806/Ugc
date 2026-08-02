"use client";

import { useEffect } from "react";

import { EDIT_RENDER_E2E_TOKEN_STORAGE_KEY } from "@/lib/firebase/auth";

export function AvatarE2ESeed({ token }: { token: string }) {
  useEffect(() => {
    window.localStorage.setItem(EDIT_RENDER_E2E_TOKEN_STORAGE_KEY, token);
    window.location.replace("/avatars");
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <p className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-semibold shadow-sm">
        Preparing avatar library test...
      </p>
    </main>
  );
}
