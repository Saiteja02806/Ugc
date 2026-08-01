import {
  authenticateDemoRequest,
  getStorageDiagnostic,
  getMissingDemoRuntimeEnvVars,
  getNumber,
  getProjectId,
  getString,
  jsonResponse,
  readJsonBody,
} from "@/lib/demo/demo-api";
import { createUploadingDemoVideo } from "@/lib/demo/demo-storage";
import {
  createDemoUploadTarget,
  DEMO_UPLOAD_URL_EXPIRES_IN_SECONDS,
} from "@/lib/demo/demo-upload";
import { createSignedPutUrl } from "@/lib/storage/storage";

export const runtime = "nodejs";

type CreateUploadUrlBody = {
  contentType?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  projectId?: unknown;
  title?: unknown;
};

export async function POST(request: Request) {
  const auth = await authenticateDemoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const missingEnv = getMissingDemoRuntimeEnvVars({
    includeStorage: true,
    includeSupabase: true,
  });

  if (missingEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Demo upload is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  const body = await readJsonBody<CreateUploadUrlBody>(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Send demo video upload details as JSON.",
      },
      400,
    );
  }

  const projectId = getProjectId(body.projectId);
  const uploadTarget = createDemoUploadTarget({
    userId: auth.user.uid,
    projectId,
    fileName: getString(body.fileName, 255),
    contentType: getString(body.contentType, 100),
    fileSize: getNumber(body.fileSize),
  });

  if (!uploadTarget.ok) {
    return jsonResponse(
      {
        ok: false,
        error: uploadTarget.error,
      },
      uploadTarget.status,
    );
  }

  try {
    const uploadUrl = await createSignedPutUrl({
      key: uploadTarget.target.key,
      contentType: uploadTarget.target.contentType,
      expiresInSeconds: DEMO_UPLOAD_URL_EXPIRES_IN_SECONDS,
    });
    const demo = await createUploadingDemoVideo({
      demoId: uploadTarget.target.demoId,
      fileName: uploadTarget.target.fileName,
      fileSizeBytes: uploadTarget.target.fileSize,
      fileType: uploadTarget.target.contentType,
      projectId,
      sourceS3Key: uploadTarget.target.key,
      sourceVideoUrl: uploadTarget.target.publicUrl,
      title: getString(body.title, 140),
      userId: auth.user.uid,
    });

    return jsonResponse({
      ok: true,
      demoId: uploadTarget.target.demoId,
      demo,
      key: uploadTarget.target.key,
      uploadUrl,
      publicUrl: uploadTarget.target.publicUrl,
      expiresInSeconds: DEMO_UPLOAD_URL_EXPIRES_IN_SECONDS,
      requiredHeaders: {
        "Content-Type": uploadTarget.target.contentType,
      },
    });
  } catch (error) {
    console.error("Failed to create demo upload URL:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not create a demo upload URL.",
        diagnostic: getStorageDiagnostic(error),
      },
      500,
    );
  }
}
