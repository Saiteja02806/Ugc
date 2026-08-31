import { z } from "zod";

/**
 * The single contract used by Trending's Wall schedule client and its route.
 * Keeping the payload builder beside the strict server schema means a harmless
 * display field cannot accidentally become an invalid scheduling request.
 */
export const WallTextScheduleRequestSchema = z
  .object({
    assignmentId: z.string().uuid(),
    scheduledDate: z.string().trim().max(32).optional(),
    scheduledTime: z.string().trim().max(32).optional(),
    targets: z
      .array(
        z
          .object({
            connectionId: z.string().uuid(),
            platform: z.enum(["instagram", "tiktok", "youtube"]).optional(),
            settings: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    timezone: z.string().trim().min(1).max(100),
    useDefaultScheduleTime: z.boolean(),
  })
  .strict();

export type WallTextScheduleRequest = z.infer<
  typeof WallTextScheduleRequestSchema
>;

export type WallTextScheduleRequestInput = {
  assignmentId: string;
  scheduledDate?: string;
  scheduledTime?: string;
  targets: Array<{
    connectionId: string;
    platform?: "instagram" | "tiktok" | "youtube";
    settings?: Record<string, unknown>;
  }>;
  timezone: string;
  useDefaultScheduleTime: boolean;
};

/**
 * Deliberately picks only fields that the route accepts. In particular, a UI
 * display title is derived by the server and must never be sent here.
 */
export function createWallTextScheduleRequest(
  input: WallTextScheduleRequestInput,
): WallTextScheduleRequest {
  return WallTextScheduleRequestSchema.parse({
    assignmentId: input.assignmentId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    targets: input.targets.map((target) => ({
      connectionId: target.connectionId,
      ...(target.platform ? { platform: target.platform } : {}),
      ...(target.settings ? { settings: target.settings } : {}),
    })),
    timezone: input.timezone,
    useDefaultScheduleTime: input.useDefaultScheduleTime,
  });
}
