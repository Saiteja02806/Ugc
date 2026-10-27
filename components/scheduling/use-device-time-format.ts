"use client";
import { useEffect, useState } from "react";
import { deviceUses12HourTime } from "@/lib/scheduling/time-display";

/** Resolve in the browser after hydration; never rewrite a saved wall-clock value. */
export function useDeviceTimeFormat() {
  const [hour12, setHour12] = useState(false);
  useEffect(() => {
    const refresh = () => setHour12(deviceUses12HourTime());
    refresh();
    window.addEventListener("languagechange", refresh);
    return () => window.removeEventListener("languagechange", refresh);
  }, []);
  return hour12;
}
