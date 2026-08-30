import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(240);
const sourceKindSchema = z.enum(["catalog", "user"]);
const scheduleSettingSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().max(500),
]);

export const HookSuggestionRequestSchema = z
  .object({
    demoAssetId: z.string().uuid(),
    influencerId: identifierSchema,
    influencerVideoId: identifierSchema,
    sourceKind: sourceKindSchema,
  })
  .strict();

export const HookVideoDraftRequestSchema = HookSuggestionRequestSchema.extend({
  draftId: z.string().uuid().nullable().optional(),
  selectedHookId: z.string().uuid(),
  trimEnd: z.number().finite().positive().nullable(),
  trimStart: z.number().finite().min(0),
})
  .strict()
  .superRefine((value, context) => {
    if (value.trimEnd !== null && value.trimEnd <= value.trimStart) {
      context.addIssue({
        code: "custom",
        message: "Trim end must be after trim start.",
        path: ["trimEnd"],
      });
    }
  });

export const HookVideoScheduleRequestSchema = HookVideoDraftRequestSchema.extend({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  // The fields above remain required for compatibility with existing clients.
  // When this is true, the route deliberately ignores their stale display
  // values and resolves the actual time from its server clock.
  useDefaultScheduleTime: z.boolean().optional(),
  targets: z
    .array(
      z
        .object({
          connectionId: z.string().uuid(),
          platform: z.enum(["instagram", "tiktok", "youtube"]),
          settings: z.record(z.string().max(80), scheduleSettingSchema).optional(),
        })
        .strict(),
    )
    .min(1)
    .max(5),
  timezone: z.string().trim().min(1).max(120),
})
  .strict()
  .superRefine((value, context) => {
    const connectionIds = value.targets.map((target) => target.connectionId);

    if (new Set(connectionIds).size !== connectionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Choose each connected account once.",
        path: ["targets"],
      });
    }
  });

export type HookSuggestionRequest = z.infer<
  typeof HookSuggestionRequestSchema
>;
export type HookVideoDraftRequest = z.infer<
  typeof HookVideoDraftRequestSchema
>;
export type HookVideoScheduleRequest = z.infer<
  typeof HookVideoScheduleRequestSchema
>;

export function validateHookTrimBounds(params: {
  durationSeconds: number | null;
  trimEnd: number | null;
  trimStart: number;
}) {
  if (
    params.durationSeconds !== null &&
    (params.trimStart >= params.durationSeconds ||
      (params.trimEnd !== null &&
        params.trimEnd > params.durationSeconds + 0.05))
  ) {
    return false;
  }

  return params.trimEnd === null || params.trimEnd > params.trimStart;
}
