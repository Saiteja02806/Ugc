"use client";

import { useEffect, useMemo } from "react";
import { createRefreshQueue } from "@/lib/http/refresh-queue";

export function useRefreshQueue(scope: string) {
  // Changing account/resource gives in-flight callbacks a separate cancellation lifetime.
  const { queue } = useMemo(() => ({ scope, queue: createRefreshQueue() }), [scope]);
  useEffect(() => {
    queue.activate();
    return () => queue.dispose();
  }, [queue]);
  return queue;
}
