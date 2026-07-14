import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

import type { generateTalkingAvatarVideoTask } from "@/trigger/generate-talking-avatar-video";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

const defaultScript =
  "I tried this tool this morning, and it made the whole workflow feel much faster.";

function cleanText(value: unknown, fallback: string, maxLength = 500) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanOptionalText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function cleanPathSegment(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleanValue = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleanValue || fallback;
}

function cleanHttpsUrl(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const videoId = crypto.randomUUID();

    const handle = await tasks.trigger<typeof generateTalkingAvatarVideoTask>(
      "generate-talking-avatar-video",
      {
        videoId,
        userId: user.uid,
        projectId: cleanPathSegment(body?.projectId, "test-project-001"),
        avatarImageUrl: cleanHttpsUrl(body?.avatarImageUrl),
        avatarId: cleanOptionalText(body?.avatarId, 160),
        voiceId: cleanOptionalText(body?.voiceId, 160),
        script: cleanText(body?.script, defaultScript, 2_000),
      },
      { tags: [`user_${user.uid}`] },
    );

    return NextResponse.json({
      ok: true,
      message: "Talking avatar video task started",
      runId: handle.id,
      videoId,
    });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("Failed to trigger talking avatar video task:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to trigger talking avatar video task",
      },
      { status: 500 },
    );
  }
}
