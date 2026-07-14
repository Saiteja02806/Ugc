import {
  authenticateDemoRequest,
  getAwsDiagnostic,
  getDemoId,
  getFiniteNumber,
  getMissingDemoRuntimeEnvVars,
  getPositiveInteger,
  getProjectId,
  getString,
  isDemoStorageNotFoundError,
  isS3NotFoundError,
  jsonResponse,
  normalizeContentType,
  readJsonBody,
} from "@/lib/demo/demo-api";
import {
  getDemoVideo,
  markDemoVideoReady,
  type DemoVideoRatio,
} from "@/lib/demo/demo-storage";
import {
  ALLOWED_DEMO_CONTENT_TYPES,
  MAX_DEMO_DURATION_SECONDS,
  MAX_DEMO_UPLOAD_BYTES,
  MIN_DEMO_DURATION_SECONDS,
  validateRawDemoKeyForOwner,
} from "@/lib/demo/demo-upload";
import {
  serializeMediaAsset,
  upsertReadyMediaAsset,
} from "@/lib/media/media-storage";
import { buildCloudFrontUrl, headS3Object } from "@/lib/storage/s3";

export const runtime = "nodejs";

const allowedDemoRatios = new Set<DemoVideoRatio>([
  "9:16",
  "1:1",
  "4:5",
  "16:9",
  "other",
]);

type CompleteUploadBody = {
  demoId?: unknown;
  durationSeconds?: unknown;
  height?: unknown;
  key?: unknown;
  projectId?: unknown;
  ratio?: unknown;
  width?: unknown;
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
        error: "Demo upload verification is missing required server environment variables.",
        missingEnv,
      },
      500,
    );
  }

  const body = await readJsonBody<CompleteUploadBody>(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Send completed demo upload details as JSON.",
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

  const key = validateRawDemoKeyForOwner({
    userId: auth.user.uid,
    projectId,
    demoId,
    key: getString(body.key, 500),
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

  const durationSeconds = getFiniteNumber(body.durationSeconds);
  const width = getPositiveInteger(body.width);
  const height = getPositiveInteger(body.height);
  const ratio = getDemoRatio(body.ratio);

  if (
    durationSeconds === null ||
    durationSeconds < MIN_DEMO_DURATION_SECONDS ||
    durationSeconds > MAX_DEMO_DURATION_SECONDS
  ) {
    return jsonResponse(
      {
        ok: false,
        error: `Demo video duration must be between ${MIN_DEMO_DURATION_SECONDS} and ${MAX_DEMO_DURATION_SECONDS} seconds.`,
      },
      400,
    );
  }

  if (width === null || height === null) {
    return jsonResponse(
      {
        ok: false,
        error: "Demo video width and height are required.",
      },
      400,
    );
  }

  try {
    const existingDemo = await getDemoVideo({
      demoId,
      projectId,
      userId: auth.user.uid,
    });

    if (existingDemo.source_s3_key !== key.key) {
      return jsonResponse(
        {
          ok: false,
          error: "Demo upload key does not match the created demo record.",
        },
        409,
      );
    }

    const object = await headS3Object({ key: key.key });
    const contentType = normalizeContentType(object.ContentType);
    const size = object.ContentLength ?? 0;

    if (!ALLOWED_DEMO_CONTENT_TYPES.includes(contentType as never)) {
      return jsonResponse(
        {
          ok: false,
          error: "Uploaded demo object must be MP4, MOV, or WebM.",
        },
        422,
      );
    }

    if (contentType !== existingDemo.file_type) {
      return jsonResponse(
        {
          ok: false,
          error: "Uploaded demo content type does not match the created upload.",
        },
        422,
      );
    }

    if (size <= 0) {
      return jsonResponse(
        {
          ok: false,
          error: "Uploaded demo object is empty.",
        },
        422,
      );
    }

    if (size > MAX_DEMO_UPLOAD_BYTES) {
      return jsonResponse(
        {
          ok: false,
          error: "Uploaded demo object is too large. Maximum size is 100 MB.",
        },
        413,
      );
    }

    const demoUrl = buildCloudFrontUrl(key.key);
    const demo = await markDemoVideoReady({
      demoId,
      durationSeconds,
      height,
      projectId,
      ratio: ratio ?? undefined,
      userId: auth.user.uid,
      width,
    });
    const mediaAsset = await upsertReadyMediaAsset({
      assetId: demoId,
      collection: "video",
      durationSeconds,
      fileName: demo.file_name,
      fileSizeBytes: size,
      height,
      metadata: { demoId },
      mimeType: contentType,
      projectId,
      ratio: demo.ratio,
      sourceRecordId: demoId,
      sourceType: "demo_upload",
      storageKey: key.key,
      thumbnailUrl: demo.thumbnail_url,
      title: demo.title,
      url: demoUrl,
      userId: auth.user.uid,
      width,
    });

    return jsonResponse({
      ok: true,
      demo,
      mediaAsset: serializeMediaAsset(mediaAsset),
    });
  } catch (error) {
    console.error("Failed to verify demo upload:", error);

    if (isDemoStorageNotFoundError(error)) {
      return jsonResponse(
        {
          ok: false,
          error: "Demo video was not found.",
        },
        404,
      );
    }

    if (isS3NotFoundError(error)) {
      return jsonResponse(
        {
          ok: false,
          error: "Demo video was not found in S3. Upload the file before completing.",
        },
        404,
      );
    }

    return jsonResponse(
      {
        ok: false,
        error: "Could not verify the demo upload.",
        diagnostic: getAwsDiagnostic(error),
      },
      500,
    );
  }
}

function getDemoRatio(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return allowedDemoRatios.has(value as DemoVideoRatio)
    ? (value as DemoVideoRatio)
    : null;
}
