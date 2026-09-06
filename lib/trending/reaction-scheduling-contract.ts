import { z } from "zod";

/**
 * Reaction Reels are rendered before they enter Trending. The scheduling
 * payload therefore contains only the durable assignment plus the shared
 * PlatformSelectionModal submission; it never accepts a client media ID.
 */
export const ReactionScheduleRequestSchema = z
  .object({
    assignmentId: z.string().uuid(),
    caption: z.string().trim().max(5000).optional(),
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

export type ReactionScheduleRequest = z.infer<
  typeof ReactionScheduleRequestSchema
>;

export type ReactionScheduleRequestInput = {
  assignmentId: string;
  caption?: string;
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

export function createReactionScheduleRequest(
  input: ReactionScheduleRequestInput,
): ReactionScheduleRequest {
  return ReactionScheduleRequestSchema.parse({
    assignmentId: input.assignmentId,
    caption: input.caption ?? "",
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
