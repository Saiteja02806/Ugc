function browserLocales() {
  return typeof navigator !== "undefined" ? Array.from(navigator.languages?.length ? navigator.languages : [navigator.language]) : undefined;
}

/** Presentation only. Scheduling storage always remains HH:mm in its selected zone. */
export function deviceUses12HourTime(locale?: string | string[]) {
  return new Intl.DateTimeFormat(locale ?? browserLocales(), { hour: "numeric" }).resolvedOptions().hour12 === true;
}
export function displayScheduleTime(value: string, hour12: boolean, locale?: string | string[]) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return "Choose time";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(locale ?? browserLocales(), { hour: hour12 ? "numeric" : "2-digit", minute: "2-digit", hourCycle: hour12 ? "h12" : "h23", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}
export function pickerHour(hour24: string, hour12: boolean) {
  return hour12 ? String(Number(hour24) % 12 || 12).padStart(2, "0") : hour24;
}
export function canonicalPickerHour(hour: string, period: string, hour12: boolean) {
  return String(hour12 ? Number(hour) % 12 + (period === "PM" ? 12 : 0) : Number(hour)).padStart(2, "0");
}
