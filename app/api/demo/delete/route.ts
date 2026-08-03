import {
  authenticateDemoRequest,
  getStorageDiagnostic,
  getDemoId,
  getMissingDemoRuntimeEnvVars,
  getProjectId,
  getString,
  isDemoStorageNotFoundError,
  jsonResponse,
  readJsonBody,
} from "@/lib/demo/demo-api";
import { getDemoVideo, softDeleteDemoVideo } from "@/lib/demo/demo-storage";
import { validateRawDemoKeyForOwner } from "@/lib/demo/demo-upload";
import { deleteStorageObject } from "@/lib/storage/storage";

export const runtime = "nodejs";

type DeleteDemoBody = {
  demoId?: unknown;
  key?: unknown;
  projectId?: unknown;
};

export async function DELETE(request: Request) {
  const auth = await authenticateDemoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingSupabaseEnv = getMissingDemoRuntimeEnvVars({
    includeSupabase: true,
  });

  if (missingSupabaseEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Demo delete is missing required server environment variables.",
        missingEnv: missingSupabaseEnv,
      },
      500,
    );
  }

  const body = await readJsonBody<DeleteDemoBody>(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Send demo delete details as JSON.",
      },
      400,
    );
  }

  const projectId = getProjectId(body.projectId);
  const demoId = getDemoId(body.demoId);

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
      projectId,
      userId: auth.user.uid,
    });
    const requestedKey = getString(body.key, 500);

    if (requestedKey) {
      const key = validateRawDemoKeyForOwner({
        userId: auth.user.uid,
        projectId,
        demoId,
        key: requestedKey,
      });

      if (!key.ok) {
        return jsonResponse(
          {
            ok: false,
            error: key.error,
          },
          key.status,
        );
      }

      if (key.key !== demo.source_s3_key) {
        return jsonResponse(
          {
            ok: false,
            error: "Demo delete key does not match the demo record.",
          },
          409,
        );
      }
    }

    await softDeleteDemoVideo({
      demoId,
      projectId,
      userId: auth.user.uid,
    });

    const missingStorageEnv = getMissingDemoRuntimeEnvVars({
      includeStorage: true,
    });

    if (missingStorageEnv.length > 0) {
      return jsonResponse({
        ok: true,
        demoId,
        key: demo.source_s3_key,
        storageDeleted: false,
        storageWarning:
          "Demo was removed from the library, but Cloud Storage cleanup is not configured.",
      });
    }

    try {
      await deleteStorageObject({ key: demo.source_s3_key });

      return jsonResponse({
        ok: true,
        demoId,
        key: demo.source_s3_key,
        storageDeleted: true,
      });
    } catch (error) {
      console.error("Failed to delete demo upload from Cloud Storage:", error);

      return jsonResponse({
        ok: true,
        demoId,
        key: demo.source_s3_key,
        storageDeleted: false,
        storageWarning:
          "Demo was removed from the library, but the source object could not be deleted.",
        diagnostic: getStorageDiagnostic(error),
      });
    }
  } catch (error) {
    console.error("Failed to delete demo video:", error);

    return jsonResponse(
      {
        ok: false,
        error: isDemoStorageNotFoundError(error)
          ? "Demo video was not found."
          : "Could not delete the demo video.",
      },
      isDemoStorageNotFoundError(error) ? 404 : 500,
    );
  }
}
