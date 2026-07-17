import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { listHookVideoBrowseInventory } from "@/lib/trending/hook-video-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    return hookVideoJson({
      entries: await listHookVideoBrowseInventory(auth.user.uid),
      ok: true,
    });
  } catch (error) {
    return hookVideoErrorResponse(
      error,
      "Could not load Surprise me videos.",
    );
  }
}
