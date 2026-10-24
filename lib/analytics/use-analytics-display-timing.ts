"use client";

import { useEffect, useRef } from "react";

/** Bounded User Timing entries; contains no owner, account names, or metrics. */
export function useAnalyticsDisplayTiming(name: "accounts" | "snapshot", identity: string, enabled: boolean, ready: boolean) {
  const timing = useRef<{ identity: string; startedAt: number | null; measured: boolean }>({ identity, startedAt: null, measured: false });
  useEffect(() => {
    if (!enabled || timing.current.identity !== identity) {
      timing.current = { identity, startedAt: null, measured: false };
    }
    if (!enabled) return;
    timing.current.startedAt ??= performance.now();
    if (!ready || timing.current.measured) return;
    timing.current.measured = true;
    const entry = `ugc.analytics.${name}`;
    // Retain only the latest sample for each surface during long app sessions.
    performance.clearMeasures(entry);
    performance.measure(entry, { start: timing.current.startedAt, end: performance.now() });
  }, [enabled, identity, name, ready]);
}
