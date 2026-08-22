import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { listSavedHookVideoDrafts } from "@/lib/trending/hook-video-db";
import {
  getMissingHookVideoLibraryRenderEnvVars,
  queueSavedHookVideoRender,
} from "@/lib/trending/hook-video-library-render";
import { persistHookVideoSelection } from "@/lib/trending/hook-video-service";
import { HookVideoDraftRequestSchema } from "@/lib/trending/hook-video-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    return hookVideoJson({
      drafts: await listSavedHookVideoDrafts(auth.user.uid),
      ok: true,
    });
  } catch (error) {
    return hookVideoErrorResponse(error, "Could not load saved Hook videos.");
  }
}

export async function POST(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = HookVideoDraftRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return hookVideoJson(
      { error: "Complete the Hook video before saving it.", ok: false },
      400,
    );
  }

  if (getMissingHookVideoLibraryRenderEnvVars().length > 0) {
    return hookVideoJson(
      {
        error: "Hook video preparation is temporarily unavailable.",
        ok: false,
      },
      501,
    );
  }

  try {
    const composition = await persistHookVideoSelection({
      input: parsed.data,
      librarySaved: true,
      userId: auth.user.uid,
    });
    const result = await queueSavedHookVideoRender({
      composition,
      userId: auth.user.uid,
    });

    return hookVideoJson({ draft: result.draft, jobId: result.jobId, ok: true }, 202);
  } catch (error) {
    return hookVideoErrorResponse(
      error,
      "Could not save and prepare this Hook video.",
    );
  }
}
