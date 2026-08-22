import {
  authenticateDemoRequest,
  getDemoId,
  getMissingDemoRuntimeEnvVars,
  getProjectId,
  getProjectIdFromUrl,
  getString,
  isDemoStorageNotFoundError,
  jsonResponse,
  readJsonBody,
} from "@/lib/demo/demo-api";
import {
  getDemoVideo,
  updateDemoVideoDetails,
  type DemoVideoStatus,
  type Json,
} from "@/lib/demo/demo-storage";
import { normalizeEditableVideoDraftInput } from "@/lib/edit/video-library";

export const runtime = "nodejs";

const patchableStatuses = new Set<Extract<DemoVideoStatus, "ready" | "draft">>([
  "ready",
  "draft",
]);
const MAX_DEMO_DRAFT_JSON_LENGTH = 50_000;

type DemoRouteContext = {
  params: Promise<{
    demoId: string;
  }>;
};

type PatchDemoBody = {
  draft?: unknown;
  projectId?: unknown;
  status?: unknown;
  tags?: unknown;
  title?: unknown;
};

export async function GET(request: Request, context: DemoRouteContext) {
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
        error: "Demo lookup is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  const demoId = getDemoId((await context.params).demoId);

  if (!demoId) {
    return jsonResponse(
      {
        ok: false,
        error: "Demo ID is required.",
      },
      400,
    );
  }

  try {
    const demo = await getDemoVideo({
      demoId,
      projectId: getProjectIdFromUrl(request),
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      demo,
    });
  } catch (error) {
    console.error("Failed to load demo video:", error);

    return jsonResponse(
      {
        ok: false,
        error: isDemoStorageNotFoundError(error)
          ? "Demo video was not found."
          : "Could not load demo video.",
      },
      isDemoStorageNotFoundError(error) ? 404 : 500,
    );
  }
}

export async function PATCH(request: Request, context: DemoRouteContext) {
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
        error: "Demo update is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  const body = await readJsonBody<PatchDemoBody>(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Send demo update details as JSON.",
      },
      400,
    );
  }

  const demoId = getDemoId((await context.params).demoId);

  if (!demoId) {
    return jsonResponse(
      {
        ok: false,
        error: "Demo ID is required.",
      },
      400,
    );
  }

  const projectId =
    getString(body.projectId, 96) || getProjectIdFromUrl(request);
  const titleUpdate = getTitleUpdate(body);
  const draftUpdate = getDraftUpdate(body);
  const statusUpdate = getStatusUpdate(body);
  const tagsUpdate = getTagsUpdate(body);

  if (!titleUpdate.ok) {
    return jsonResponse(
      {
        ok: false,
        error: titleUpdate.error,
      },
      400,
    );
  }

  if (!draftUpdate.ok) {
    return jsonResponse(
      {
        ok: false,
        error: draftUpdate.error,
      },
      400,
    );
  }

  if (!statusUpdate.ok) {
    return jsonResponse(
      {
        ok: false,
        error: statusUpdate.error,
      },
      400,
    );
  }

  if (!tagsUpdate.ok) {
    return jsonResponse(
      {
        ok: false,
        error: tagsUpdate.error,
      },
      400,
    );
  }

  try {
    let finalDraft = draftUpdate.value;
    let finalStatus = statusUpdate.value;

    if (tagsUpdate.value !== undefined) {
      const existing = await getDemoVideo({
        demoId,
        projectId: getProjectId(projectId),
        userId: auth.user.uid,
      });

      const existingDraftObj =
        existing.draft_json &&
        typeof existing.draft_json === "object" &&
        !Array.isArray(existing.draft_json)
          ? (existing.draft_json as Record<string, Json | undefined>)
          : {};

      finalDraft = {
        ...(finalDraft ?? existingDraftObj),
        tags: tagsUpdate.value,
      };

      if (!statusUpdate.value && !draftUpdate.value) {
        if (existing.status === "ready" || existing.status === "draft") {
          finalStatus = existing.status;
        }
      }
    }

    const demo = await updateDemoVideoDetails({
      demoId,
      draft: finalDraft,
      projectId: getProjectId(projectId),
      status: finalStatus,
      title: titleUpdate.value,
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      demo,
    });
  } catch (error) {
    console.error("Failed to update demo video:", error);

    return jsonResponse(
      {
        ok: false,
        error: isDemoStorageNotFoundError(error)
          ? "Demo video was not found."
          : "Could not update demo video.",
      },
      isDemoStorageNotFoundError(error) ? 404 : 500,
    );
  }
}

function getTitleUpdate(body: PatchDemoBody):
  | {
      ok: true;
      value?: string;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!("title" in body)) {
    return { ok: true };
  }

  const title = getString(body.title, 140);

  if (!title) {
    return {
      ok: false,
      error: "Demo title cannot be empty.",
    };
  }

  return {
    ok: true,
    value: title,
  };
}

function getDraftUpdate(body: PatchDemoBody):
  | {
      ok: true;
      value?: Record<string, Json | undefined>;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!("draft" in body)) {
    return { ok: true };
  }

  if (!body.draft || typeof body.draft !== "object" || Array.isArray(body.draft)) {
    return {
      ok: false,
      error: "Demo draft must be a JSON object.",
    };
  }

  try {
    const normalizedDraft = normalizeEditableVideoDraftInput(body.draft);

    if (!normalizedDraft) {
      return {
        ok: false,
        error: "Demo draft must include valid trim and text overlay settings.",
      };
    }

    const rawDraft = JSON.stringify(normalizedDraft);

    if (rawDraft.length > MAX_DEMO_DRAFT_JSON_LENGTH) {
      return {
        ok: false,
        error: "Demo draft is too large.",
      };
    }

    const parsedDraft = JSON.parse(rawDraft) as Record<string, Json | undefined>;

    return {
      ok: true,
      value: parsedDraft,
    };
  } catch {
    return {
      ok: false,
      error: "Demo draft must be valid JSON.",
    };
  }
}

function getStatusUpdate(body: PatchDemoBody):
  | {
      ok: true;
      value?: Extract<DemoVideoStatus, "ready" | "draft">;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!("status" in body)) {
    return { ok: true };
  }

  if (!patchableStatuses.has(body.status as never)) {
    return {
      ok: false,
      error: "Demo status can only be ready or draft from this endpoint.",
    };
  }

  return {
    ok: true,
    value: body.status as Extract<DemoVideoStatus, "ready" | "draft">,
  };
}

function getTagsUpdate(body: PatchDemoBody):
  | {
      ok: true;
      value?: string[];
    }
  | {
      ok: false;
      error: string;
    } {
  if (!("tags" in body)) {
    return { ok: true };
  }

  if (!Array.isArray(body.tags)) {
    return {
      ok: false,
      error: "Tags must be an array of strings.",
    };
  }

  const tags: string[] = [];

  for (const item of body.tags) {
    if (typeof item !== "string") {
      continue;
    }

    const clean = item.trim().slice(0, 32);

    if (!clean) {
      continue;
    }

    const formatted = clean.startsWith("#") ? clean : `#${clean}`;

    if (!tags.includes(formatted)) {
      tags.push(formatted);
    }
  }

  return {
    ok: true,
    value: tags.slice(0, 10),
  };
}
