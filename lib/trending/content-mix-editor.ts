import {
  TRENDING_CONTENT_MIX_LIMITS,
  type TrendingContentMix,
} from "./content-mix.ts";
import type { TrendingFeedFormat } from "./feed-items.ts";

export function rebalanceTrendingContentMix(
  current: TrendingContentMix,
  changedFormat: TrendingFeedFormat,
  requestedValue: number,
): TrendingContentMix {
  const nextValue = clampInteger(
    requestedValue,
    0,
    TRENDING_CONTENT_MIX_LIMITS[changedFormat],
  );

  const formats = [
    "carousel",
    "wall_text",
    "hook_video",
    "reaction",
  ] as const satisfies readonly TrendingFeedFormat[];
  const unchangedFormats = formats.filter(
    (format) => format !== changedFormat,
  );
  const remaining = 100 - nextValue;
  const currentTotal = unchangedFormats.reduce(
    (total, format) => total + getValue(current, format),
    0,
  );
  const rawValues = unchangedFormats.map((format, index) => {
    const raw =
      currentTotal > 0
        ? (remaining * getValue(current, format)) / currentTotal
        : remaining / unchangedFormats.length;

    return { format, index, raw, value: Math.floor(raw) };
  });
  let unallocated =
    remaining - rawValues.reduce((total, entry) => total + entry.value, 0);

  rawValues
    .sort(
      (first, second) =>
        second.raw - second.value - (first.raw - first.value) ||
        first.index - second.index,
    )
    .forEach((entry) => {
      if (unallocated > 0) {
        entry.value += 1;
        unallocated -= 1;
      }
    });

  const values = new Map(rawValues.map((entry) => [entry.format, entry.value]));

  return {
    carousel: changedFormat === "carousel" ? nextValue : values.get("carousel") ?? 0,
    hook_video:
      changedFormat === "hook_video" ? nextValue : values.get("hook_video") ?? 0,
    reaction:
      changedFormat === "reaction" ? nextValue : values.get("reaction") ?? 0,
    wall_text:
      changedFormat === "wall_text" ? nextValue : values.get("wall_text") ?? 0,
  };
}

function getValue(mix: TrendingContentMix, format: TrendingFeedFormat) {
  return format === "reaction" ? mix.reaction ?? 0 : mix[format];
}

function clampInteger(value: number, minimum: number, maximum: number) {
  const integer = Number.isFinite(value) ? Math.round(value) : minimum;
  return Math.min(Math.max(integer, minimum), maximum);
}
