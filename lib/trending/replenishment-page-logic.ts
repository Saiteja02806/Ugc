import { z } from "zod";

export const REPLENISHMENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ReplenishmentResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    pendingSlotCount: z.number().int().nonnegative(),
    state: z.enum(["caught_up", "exhausted", "preparing", "ready"]),
    userId: z.string().min(1).max(256),
  }),
  z.object({
    error: z.string().min(1).max(500),
    ok: z.literal(false),
    userId: z.string().min(1).max(256),
  }),
]);

const ReplenishmentPageResponseSchema = z
  .object({
    cycleId: z.string().refine(isValidReplenishmentCycleId),
    cycleStatus: z.enum(["active", "completed"]),
    hasMore: z.boolean(),
    nextCursor: z.string().regex(REPLENISHMENT_UUID_PATTERN).nullable(),
    ok: z.literal(true),
    pageCursor: z.string().regex(REPLENISHMENT_UUID_PATTERN).nullable(),
    processedCount: z.number().int().min(0).max(10),
    results: z.array(ReplenishmentResultSchema).max(10),
  })
  .superRefine((value, context) => {
    if (value.processedCount !== value.results.length) {
      context.addIssue({
        code: "custom",
        message: "Processed profile count must match the result count.",
        path: ["processedCount"],
      });
    }

    if (value.hasMore !== (value.cycleStatus === "active")) {
      context.addIssue({
        code: "custom",
        message: "Cycle status must match the page continuation state.",
        path: ["cycleStatus"],
      });
    }

    if (
      value.cycleStatus === "active" &&
      (!value.nextCursor || value.processedCount === 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "An active cycle must advance to a non-empty next page.",
        path: ["nextCursor"],
      });
    }

    if (value.cycleStatus === "completed" && value.nextCursor !== null) {
      context.addIssue({
        code: "custom",
        message: "A completed cycle cannot expose a next cursor.",
        path: ["nextCursor"],
      });
    }

    if (
      value.nextCursor &&
      value.pageCursor &&
      value.nextCursor.toLowerCase() <= value.pageCursor.toLowerCase()
    ) {
      context.addIssue({
        code: "custom",
        message: "The persisted replenishment cursor must advance.",
        path: ["nextCursor"],
      });
    }
  });

export type ReplenishmentPageResponse = z.infer<
  typeof ReplenishmentPageResponseSchema
>;

export function parseReplenishmentPageResponse(value: unknown) {
  return ReplenishmentPageResponseSchema.parse(value);
}

export function isValidReplenishmentCycleId(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function getNextReplenishmentCursor(params: {
  currentCursor: string | null;
  hasMore: boolean;
  nextCursor: string | null;
  processedCount: number;
}) {
  if (!params.hasMore) {
    return null;
  }

  if (!Number.isInteger(params.processedCount) || params.processedCount <= 0) {
    throw new Error(
      "Carousel replenishment page cannot continue without processed profiles.",
    );
  }

  if (
    !params.nextCursor ||
    !REPLENISHMENT_UUID_PATTERN.test(params.nextCursor) ||
    (params.currentCursor !== null &&
      (!REPLENISHMENT_UUID_PATTERN.test(params.currentCursor) ||
        params.nextCursor.toLowerCase() <= params.currentCursor.toLowerCase()))
  ) {
    throw new Error("Carousel replenishment cursor did not advance.");
  }

  return params.nextCursor;
}
