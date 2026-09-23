export function localPublishDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function layoutPublishDatePoints<T extends { date: string; value: number | null }>(points: T[]) {
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = Date.parse(ordered[0]?.date ?? "");
  const last = Date.parse(ordered.at(-1)?.date ?? "");
  const maximum = Math.max(1, ...ordered.map((point) => point.value ?? 0));
  return {
    maximum,
    points: ordered.map((point) => ({ ...point,
      x: first === last ? 50 : 6 + ((Date.parse(point.date) - first) / (last - first)) * 88,
      y: point.value === null ? null : 82 - (point.value / maximum) * 66,
    })),
  };
}
