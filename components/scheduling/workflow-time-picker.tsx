"use client";

import { useState } from "react";
import { useDeviceTimeFormat } from "./use-device-time-format";
import { canonicalPickerHour, pickerHour, displayScheduleTime } from "@/lib/scheduling/time-display";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

/** Controlled wall-clock selection. Conversion and validation belong to scheduling. */
export function WorkflowTimePicker({ id, value, onChange, describedBy }: {
  id: string; value: string; onChange: (value: string) => void; describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const hour12 = useDeviceTimeFormat();
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const [hour, minute] = valid ? value.split(":") : ["00", "00"];
  const period = Number(hour) >= 12 ? "PM" : "AM";
  const shownHour = pickerHour(hour, hour12);
  const label = displayScheduleTime(value, hour12);
  return <>
    <input type="hidden" name="postTime" value={value} />
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button id={id} type="button" variant="outline" aria-label={`Choose publish time, currently ${valid ? label : "not selected"}`} aria-describedby={describedBy} className="h-11 w-full justify-start gap-2 tabular-nums" />}>
        <Clock3 className="size-4" aria-hidden="true" />{label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)]">
        <PopoverTitle>Choose publish time</PopoverTitle>
        <p className="text-xs text-muted">Time in the selected timezone.</p>
        <div className={hour12 ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
          <label className="space-y-2 text-sm">Hour
            <select aria-label="Hour" value={shownHour} onChange={event => onChange(`${canonicalPickerHour(event.target.value, period, hour12)}:${minute}`)} className="h-11 w-full rounded-lg border border-border bg-card-muted px-3">
              {Array.from({ length: hour12 ? 12 : 24 }, (_, i) => String(hour12 ? i + 1 : i).padStart(2, "0")).map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">Minute
            <select aria-label="Minute" value={minute} onChange={event => onChange(`${hour}:${event.target.value}`)} className="h-11 w-full rounded-lg border border-border bg-card-muted px-3">
              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          {hour12 ? <label className="space-y-2 text-sm">AM/PM
            <select aria-label="AM/PM" value={period} onChange={event => onChange(`${canonicalPickerHour(shownHour, event.target.value, true)}:${minute}`)} className="h-11 w-full rounded-lg border border-border bg-card-muted px-2">
              <option>AM</option><option>PM</option>
            </select>
          </label> : null}
        </div>
        <Button type="button" onClick={() => { if (!valid) onChange(`${hour}:${minute}`); setOpen(false); }}>Done</Button>
      </PopoverContent>
    </Popover>
  </>;
}
