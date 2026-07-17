import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset, MediaRatio } from "@/lib/media/types";

export async function uploadHookVideoDemo(file: File) {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a video file for the product demo.");
  }

  const metadata = await readVideoMetadata(file);
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before uploading a product demo.");
  }

  const preparedResponse = await fetch("/api/media/create-upload-url", {
    body: JSON.stringify({
      collection: "video",
      contentType: file.type,
      fileName: file.name,
      fileSize: file.size,
      title: getFileTitle(file.name),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const prepared = (await preparedResponse.json()) as {
    assetId?: string;
    error?: string;
    key?: string;
    ok?: boolean;
    requiredHeaders?: Record<string, string>;
    uploadUrl?: string;
  };

  if (
    !preparedResponse.ok ||
    !prepared.ok ||
    !prepared.assetId ||
    !prepared.key ||
    !prepared.uploadUrl
  ) {
    throw new Error(prepared.error || "Could not prepare this demo upload.");
  }

  try {
    const uploadResponse = await fetch(prepared.uploadUrl, {
      body: file,
      headers: prepared.requiredHeaders,
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error("The product demo could not be uploaded.");
    }

    const completedResponse = await fetch("/api/media/complete-upload", {
      body: JSON.stringify({
        assetId: prepared.assetId,
        durationSeconds: metadata.durationSeconds,
        height: metadata.height,
        key: prepared.key,
        ratio: metadata.ratio,
        width: metadata.width,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const completed = (await completedResponse.json()) as {
      asset?: MediaAsset;
      error?: string;
      ok?: boolean;
    };

    if (!completedResponse.ok || !completed.ok || !completed.asset) {
      throw new Error(completed.error || "Could not finish this demo upload.");
    }

    return completed.asset;
  } catch (error) {
    await fetch(`/api/media/${encodeURIComponent(prepared.assetId)}`, {
      headers: { Authorization: `Bearer ${token}` },
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
      video.duration <= 0 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      throw new Error("This product demo does not contain valid video metadata.");
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
