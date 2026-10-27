"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeviceTimeFormat } from "./use-device-time-format";
import { displayScheduleTime } from "@/lib/scheduling/time-display";
import { quickSchedulePreset, type QuickTimePreset } from "@/lib/scheduling/quick-time";

export function ScheduleQuickActions({ timezone, onSelect, disabled = false }: {
  timezone: string; onSelect: (parts: { date: string; time: string }, preset: QuickTimePreset) => void; disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const hour12 = useDeviceTimeFormat();
  const presets: { value: QuickTimePreset; label: string }[] = [
    { value: 5, label: "5 mins" }, { value: 60, label: "1 hour" }, { value: 180, label: "3 hours" },
    { value: "tomorrow", label: `Tomorrow ${displayScheduleTime("09:00", hour12)}` },
  ];
  return <div className="min-w-0 max-w-full">
    <p className="mb-2 text-xs font-medium text-muted">Quick schedule</p>
    <div role="group" aria-label="Quick publish times" className="flex min-w-0 max-w-full flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
      {presets.map(preset => <Button key={preset.value} type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-full px-3 text-xs whitespace-nowrap" disabled={disabled} onClick={() => {
        try { const parts = quickSchedulePreset(preset.value, timezone); setError(null); onSelect(parts, preset.value); }
        catch { setError("Choose a valid timezone before selecting a quick time."); }
      }}>{preset.label}</Button>)}
    </div>
    {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
  </div>;
}
