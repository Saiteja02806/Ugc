import { z } from "zod";

import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { updateTrendingHookVideoAssignment } from "@/lib/trending/hook-video-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HookFeedActionSchema = z
  .object({
    action: z.enum(["selected", "skipped"]),
    assignmentId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = HookFeedActionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return hookVideoJson(
      { error: "Choose a valid Trending Hook action.", ok: false },
      400,
    );
  }

  try {
    const assignment = await updateTrendingHookVideoAssignment({
      action: parsed.data.action,
      assignmentId: parsed.data.assignmentId,
      userId: auth.user.uid,
    });

    return hookVideoJson({ assignment, ok: true });
  } catch (error) {
    return hookVideoErrorResponse(error, "Could not update this Hook idea.");
  }
}
