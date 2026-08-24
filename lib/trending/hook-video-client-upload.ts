import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset, MediaRatio } from "@/lib/media/types";

const DEFAULT_DEMO_PROJECT_ID = "test-project-001";
const MAX_DEMO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MIN_DEMO_DURATION_SECONDS = 1;
const MAX_DEMO_DURATION_SECONDS = 60;
const CONTENT_TYPE_BY_EXTENSION = {
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
} as const;

type DemoContentType =
  (typeof CONTENT_TYPE_BY_EXTENSION)[keyof typeof CONTENT_TYPE_BY_EXTENSION];

export async function uploadHookVideoDemo(file: File) {
  const contentType = getSupportedContentType(file);
  const metadata = await readVideoMetadata(file);
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before uploading a product demo.");
  }

  const preparedResponse = await fetch("/api/demo/create-upload-url", {
    body: JSON.stringify({
      contentType,
      fileName: file.name,
      fileSize: file.size,
      projectId: DEFAULT_DEMO_PROJECT_ID,
      title: getFileTitle(file.name),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const prepared = (await preparedResponse.json().catch(() => null)) as {
    demoId?: string;
    error?: string;
    key?: string;
    ok?: boolean;
    requiredHeaders?: Record<string, string>;
    uploadUrl?: string;
  } | null;

  if (
    !preparedResponse.ok ||
    !prepared ||
    !prepared.ok ||
    !prepared.demoId ||
    !prepared.key ||
    !prepared.uploadUrl
  ) {
    throw new Error(prepared?.error || "Could not prepare this demo upload.");
  }

  try {
    const uploadResponse = await fetch(prepared.uploadUrl, {
      body: file,
      headers: {
        ...prepared.requiredHeaders,
        "Content-Type": contentType,
      },
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error("The product demo could not be uploaded.");
    }

    const completedResponse = await fetch("/api/demo/complete-upload", {
      body: JSON.stringify({
        demoId: prepared.demoId,
        durationSeconds: metadata.durationSeconds,
        height: metadata.height,
        key: prepared.key,
        projectId: DEFAULT_DEMO_PROJECT_ID,
        ratio: metadata.ratio,
        width: metadata.width,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const completed = (await completedResponse.json().catch(() => null)) as
      | {
          error?: string;
          mediaAsset?: MediaAsset;
          ok?: boolean;
        }
      | null;

    if (
      !completedResponse.ok ||
      !completed?.ok ||
      !completed.mediaAsset
    ) {
      throw new Error(
        completed?.error || "Could not finish this demo upload.",
      );
    }

    return completed.mediaAsset;
  } catch (error) {
    await fetch("/api/demo/delete", {
      body: JSON.stringify({
        demoId: prepared.demoId,
        key: prepared.key,
        projectId: DEFAULT_DEMO_PROJECT_ID,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "DELETE",
    }).catch(() => undefined);
    throw error;
  }
}

async function readVideoMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("Could not read this product demo."));
    });

    if (
      !Number.isFinite(video.duration) ||
      video.duration < MIN_DEMO_DURATION_SECONDS ||
      video.duration > MAX_DEMO_DURATION_SECONDS ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      throw new Error(
        `Demo video duration must be between ${MIN_DEMO_DURATION_SECONDS} and ${MAX_DEMO_DURATION_SECONDS} seconds.`,
      );
    }

    return {
      durationSeconds: video.duration,
      height: video.videoHeight,
      ratio: getRatio(video.videoWidth, video.videoHeight),
      width: video.videoWidth,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getSupportedContentType(file: File): DemoContentType {
  if (file.size <= 0) {
    throw new Error("Demo video file is empty.");
  }

  if (file.size > MAX_DEMO_UPLOAD_BYTES) {
    throw new Error("Demo video is too large. Maximum size is 100 MB.");
  }

  const extension = file.name.split(".").pop()?.trim().toLowerCase();
  const inferredContentType = extension
    ? CONTENT_TYPE_BY_EXTENSION[
        extension as keyof typeof CONTENT_TYPE_BY_EXTENSION
      ]
    : undefined;

  if (!inferredContentType) {
    throw new Error("Demo video must be an MP4, MOV, or WebM file.");
  }

  const browserContentType = file.type.trim().toLowerCase();

  if (browserContentType && browserContentType !== inferredContentType) {
    throw new Error("Demo video file extension and content type do not match.");
  }

  return inferredContentType;
}

function getRatio(width: number, height: number): MediaRatio {
  const value = width / height;
  const options: [MediaRatio, number][] = [
    ["9:16", 9 / 16],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["16:9", 16 / 9],
  ];

  return (
    options.find(([, expected]) => Math.abs(value - expected) <= 0.03)?.[0] ??
    "other"
  );
}

function getFileTitle(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || "Product demo"
  );
}
