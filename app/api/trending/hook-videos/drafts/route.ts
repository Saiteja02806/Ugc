import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { listSavedHookVideoDrafts } from "@/lib/trending/hook-video-db";
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

  try {
    const result = await persistHookVideoSelection({
      input: parsed.data,
      librarySaved: true,
      userId: auth.user.uid,
    });

    return hookVideoJson({ draft: result.draft, ok: true });
  } catch (error) {
    return hookVideoErrorResponse(error, "Could not save this Hook video.");
  }
}
