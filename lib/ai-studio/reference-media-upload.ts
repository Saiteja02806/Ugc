"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset, MediaCollection, MediaRatio } from "@/lib/media/types";

export type AIStudioReferenceKind = "image" | "video" | "audio";

export type AIStudioReferenceMedia = {
  asset: MediaAsset;
  kind: AIStudioReferenceKind;
};

const DEFAULT_MAX_REFERENCE_VIDEO_SECONDS = 3;

export async function uploadAIStudioReferenceMedia(
  file: File,
  kind: AIStudioReferenceKind,
  maxVideoDurationSeconds = DEFAULT_MAX_REFERENCE_VIDEO_SECONDS,
  expectedUserId?: string,
  options?: { maxAudioDurationSeconds?: number; requireVideoReferenceRatio?: boolean; purpose?: "explore-demo" },
): Promise<AIStudioReferenceMedia> {
  const collection: MediaCollection = kind;
  const expectedPrefix = `${kind}/`;

  if (!file.type.startsWith(expectedPrefix)) {
    throw new Error(`Choose a valid ${kind} file.`);
  }

  const metadata =
    kind === "image" ? await readImageMetadata(file)
      : kind === "audio" ? await readAudioMetadata(file, options?.maxAudioDurationSeconds ?? 30) : await readVideoMetadata(file, maxVideoDurationSeconds, options?.requireVideoReferenceRatio ?? true);
  const token = await getCurrentUserIdToken(expectedUserId);

  if (!token) {
    throw new Error(`Sign in before uploading a reference ${kind}.`);
  }

  const preparedResponse = await fetch("/api/media/create-upload-url", {
    body: JSON.stringify({
      collection,
      contentType: file.type,
      fileName: file.name,
      fileSize: file.size,
      projectId: options?.purpose ?? "ai-studio",
      title: getFileTitle(file.name, kind),
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
    throw new Error(prepared.error || `Could not prepare this reference ${kind}.`);
  }

  let completionAttempted = false;
  try {
    const uploadResponse = await fetch(prepared.uploadUrl, {
      body: file,
      headers: prepared.requiredHeaders,
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error(`The reference ${kind} could not be uploaded.`);
    }

    completionAttempted = true;
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

    if (!completedResponse.ok || !completed.ok || completed.asset?.id !== prepared.assetId || completed.asset.status !== "ready" || completed.asset.collection !== kind) {
      throw new Error(completed.error || `Could not finish this reference ${kind} upload.`);
    }

    return { asset: completed.asset, kind };
  } catch (error) {
    // A lost acknowledgement does not mean the upload failed. Never delete a
    // potentially committed asset; first recover it through the owner API.
    if (completionAttempted) {
      const recovered = await fetch(`/api/media/${encodeURIComponent(prepared.assetId)}`, {
        cache: "no-store", headers: { Authorization: `Bearer ${token}` },
      }).then(async response => response.ok ? response.json() : null).catch(() => null);
      if (recovered?.ok && recovered.asset?.id === prepared.assetId && recovered.asset.status === "ready" && recovered.asset.collection === kind) return { asset: recovered.asset, kind };
    }
    throw error;
  }
}

async function readImageMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new window.Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read this reference image."));
    });

    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error("This reference image does not contain valid dimensions.");
    }

    return {
      durationSeconds: null,
      height: image.naturalHeight,
      ratio: getRatio(image.naturalWidth, image.naturalHeight),
      width: image.naturalWidth,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readVideoMetadata(file: File, maxDurationSeconds: number, requireReferenceRatio: boolean) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this reference video."));
    });

    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      throw new Error("This reference video does not contain valid video data.");
    }

    if (video.duration > maxDurationSeconds) {
      throw new Error(`Reference videos can be up to ${maxDurationSeconds} seconds long.`);
    }

    const ratio = getRatio(video.videoWidth, video.videoHeight);

    if (requireReferenceRatio && ratio !== "9:16" && ratio !== "16:9") {
      throw new Error("Use a 9:16 vertical or 16:9 landscape reference video.");
    }

    return {
      durationSeconds: video.duration,
      height: video.videoHeight,
      ratio,
      width: video.videoWidth,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readAudioMetadata(file: File, maxDurationSeconds: number) {
  const objectUrl = URL.createObjectURL(file);
  const audio = document.createElement("audio");
  try {
    audio.preload = "metadata";
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error("Could not read this audio reference. Use an MP3 or WAV file."));
      audio.src = objectUrl;
    });
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > maxDurationSeconds) {
      throw new Error(`Audio must contain between 0 and ${maxDurationSeconds} seconds of audio.`);
    }
    return { durationSeconds: audio.duration, width: null, height: null, ratio: "other" as const };
  } finally {
    audio.removeAttribute("src");
    audio.load();
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

  return options.find(([, expected]) => Math.abs(value - expected) <= 0.03)?.[0] ?? "other";
}

function getFileTitle(fileName: string, kind: AIStudioReferenceKind) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || `AI Studio reference ${kind}`
  );
}
