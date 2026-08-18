"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ViralReviewerAccessState } from "@/lib/viral/reviewer-access";

type AccessResponse = {
  hasAccess?: unknown;
  ok?: unknown;
};

export function useViralReviewerAccess({
  authorizedByParent = false,
}: {
  authorizedByParent?: boolean;
} = {}) {
  const { loading, user } = useAuth();
  const [accessState, setAccessState] =
    useState<ViralReviewerAccessState>(() =>
      authorizedByParent ? "reviewer" : "checking",
    );

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccess() {
      if (authorizedByParent) {
        setAccessState("reviewer");
        return;
      }

      if (loading) {
        setAccessState("checking");
        return;
      }

      if (!user) {
        setAccessState("locked");
        return;
      }

      setAccessState("checking");

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          if (!controller.signal.aborted) setAccessState("error");
          return;
        }

        const response = await fetch("/api/admin/viral/access", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | AccessResponse
          | null;

        if (controller.signal.aborted) return;

        if (response.status === 503) {
          setAccessState("unavailable");
        } else if (response.status === 403) {
          setAccessState("locked");
        } else if (!response.ok || data?.ok !== true) {
          setAccessState("error");
        } else {
          setAccessState(data.hasAccess === true ? "reviewer" : "locked");
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setAccessState("error");
        }
      }
    }

    void loadAccess();

    return () => controller.abort();
  }, [authorizedByParent, loading, user]);

  return accessState;
}
