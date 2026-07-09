import { downloadVideoToBuffer } from "@/lib/video/download-video";

type GenerateHeyGenTalkingAvatarVideoParams = {
  avatarImageUrl?: string;
  avatarId?: string;
  voiceId?: string;
  script: string;
};

type HeyGenCreateVideoResponse = {
  data?: {
    video_id?: unknown;
  };
};

type HeyGenVideoStatusResponse = {
  data?: {
    status?: unknown;
    video_url?: unknown;
    error?: unknown;
  };
};

const HEYGEN_API_BASE_URL = "https://api.heygen.com";
const HEYGEN_POLL_INTERVAL_MS = 5_000;
const HEYGEN_TIMEOUT_MS = 8 * 60_000;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHeyGen(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${HEYGEN_API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": getRequiredEnv("HEYGEN_API_KEY"),
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(`HeyGen request failed: ${response.status}`);
  }

  return payload;
}

async function createTalkingAvatarVideo({
  avatarId,
  voiceId,
  script,
}: Required<Pick<GenerateHeyGenTalkingAvatarVideoParams, "avatarId" | "voiceId" | "script">>) {
  const payload = (await fetchHeyGen("/v2/video/generate", {
    method: "POST",
    body: JSON.stringify({
      dimension: {
        height: 1280,
        width: 720,
      },
      video_inputs: [
        {
          character: {
            avatar_id: avatarId,
            avatar_style: "normal",
            type: "avatar",
          },
          voice: {
            input_text: script,
            type: "text",
            voice_id: voiceId,
          },
        },
      ],
    }),
  })) as HeyGenCreateVideoResponse;
  const videoId = payload.data?.video_id;

  if (typeof videoId !== "string" || !videoId) {
    throw new Error("HeyGen did not return a video id.");
  }

  return videoId;
}

async function waitForHeyGenVideoUrl(videoId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= HEYGEN_TIMEOUT_MS) {
    const payload = (await fetchHeyGen(
      `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      {
        method: "GET",
      },
    )) as HeyGenVideoStatusResponse;
    const status = payload.data?.status;

    if (status === "completed") {
      const videoUrl = payload.data?.video_url;

      if (typeof videoUrl !== "string" || !videoUrl) {
        throw new Error("HeyGen completed without a video URL.");
      }

      return videoUrl;
    }

    if (status === "failed") {
      throw new Error(
        `HeyGen video generation failed: ${String(payload.data?.error ?? "unknown")}`,
      );
    }

    await sleep(HEYGEN_POLL_INTERVAL_MS);
  }

  throw new Error("HeyGen video generation timed out.");
}

export async function generateHeyGenTalkingAvatarVideoBuffer({
  avatarId,
  avatarImageUrl,
  voiceId,
  script,
}: GenerateHeyGenTalkingAvatarVideoParams) {
  if (avatarImageUrl && !avatarId) {
    throw new Error(
      "HeyGen generated-image photo avatar creation is not enabled yet. Provide avatarId and voiceId for the MVP.",
    );
  }

  if (!avatarId) {
    throw new Error("Missing HeyGen avatarId.");
  }

  if (!voiceId) {
    throw new Error("Missing HeyGen voiceId.");
  }

  const videoId = await createTalkingAvatarVideo({
    avatarId,
    script,
    voiceId,
  });
  const videoUrl = await waitForHeyGenVideoUrl(videoId);

  return downloadVideoToBuffer(videoUrl, {
    headers: {
      "X-Api-Key": getRequiredEnv("HEYGEN_API_KEY"),
    },
  });
}
