import {
  authenticateDemoRequest,
  getMissingDemoRuntimeEnvVars,
  getProjectIdFromUrl,
  jsonResponse,
} from "@/lib/demo/demo-api";
import { listDemoVideos } from "@/lib/demo/demo-storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateDemoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingEnv = getMissingDemoRuntimeEnvVars({
    includeSupabase: true,
  });

  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Demo list is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  try {
    const projectId = getProjectIdFromUrl(request);
    const demos = await listDemoVideos({
      projectId,
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      demos,
    });
  } catch (error) {
    console.error("Failed to list demo videos:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load demo videos.",
      },
      500,
    );
  }
}
