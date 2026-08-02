"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type AccessResponse = {
  isPro?: unknown;
  message?: unknown;
  ok?: unknown;
};

export function useAIStudioAccess() {
  const { loading, user } = useAuth();
  const [accessState, setAccessState] =
    useState<AIStudioAccessState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccess() {
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
          setAccessState("error");
          return;
        }

        const response = await fetch("/api/ai-studio/access", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        const data = (await response.json()) as AccessResponse;

        if (!controller.signal.aborted) {
          if (!response.ok || data.ok !== true) {
            setAccessState("error");
          } else {
            setAccessState(data.isPro === true ? "pro" : "locked");
          }
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

    return () => {
      controller.abort();
    };
  }, [loading, user]);

  return accessState;
}
