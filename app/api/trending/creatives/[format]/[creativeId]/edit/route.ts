import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import {
  createHookEditContent,
  createWallTextEditContent,
  TRENDING_CREATIVE_EDIT_VERSION,
  type TrendingCreativeEditFormat,
  type TrendingCreativeEditSaveInput,
} from "@/lib/trending/creative-edit-contract";
import {
  HOOK_TEXT_MAXIMUM_CHARACTERS,
  HOOK_TEXT_MAXIMUM_WORDS,
  HOOK_TEXT_MINIMUM_CHARACTERS,
  HOOK_TEXT_MINIMUM_WORDS,
} from "@/lib/trending/hook-text-layout";
import {
  loadTrendingCreativeEditor,
  saveTrendingCreativeEditor,
} from "@/lib/trending/creative-edit-service";
import {
  attachTrendingCreativeEditRenderJob,
  getMissingTrendingCreativeEditEnvVars,
  markTrendingCreativeEditRenderFailed,
  TrendingCreativeEditAccessError,
} from "@/lib/trending/creative-edits";
import {
  MAX_CURRENT_WALL_TEXT_WORDS,
  MIN_SHORT_WALL_TEXT_WORDS,
} from "@/lib/trending/wall-text-text-logic";
import {
  DEFAULT_TRENDING_TEXT_COLOR,
  TRENDING_TEXT_COLOR_VALUES,
} from "@/lib/trending/text-color";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMAT_SCHEMA = z.enum(["carousel", "hook_video", "wall_text"]);
const POSITION_SCHEMA = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strip();
const SOURCE_SCHEMA = z
  .object({
    groupId: z.string().uuid().nullable().optional(),
    mediaAssetId: z.string().uuid().nullable().optional(),
    resolvedAssetId: z.string().uuid().nullable().optional(),
    selectionKind: z.enum(["asset", "group"]),
  })
  .strip();
const TEXT_COLOR_SCHEMA = z
  .enum(TRENDING_TEXT_COLOR_VALUES)
  .default(DEFAULT_TRENDING_TEXT_COLOR);
const CAROUSEL_PATCH_SCHEMA = z
  .object({
    assignmentId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    slides: z
      .array(
        z
          .object({
            backgroundAssetId: z.string().uuid().nullable(),
            ctaText: z.string().max(120),
            headline: z.string().trim().max(180),
            slideId: z.string().uuid(),
            slideNumber: z.number().int().min(1).max(20),
            subtext: z.string().max(360),
            textPosition: POSITION_SCHEMA,
          })
          .strip(),
      )
      .min(1)
      .max(20),
  })
  .strip();
const HOOK_PATCH_SCHEMA = z
  .object({
    assignmentId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    hookText: z
      .string()
      .trim()
      .min(HOOK_TEXT_MINIMUM_CHARACTERS)
      .max(HOOK_TEXT_MAXIMUM_CHARACTERS)
      .refine((value) => {
        const wordCount = value.split(/\s+/u).filter(Boolean).length;
        return (
          wordCount >= HOOK_TEXT_MINIMUM_WORDS &&
          wordCount <= HOOK_TEXT_MAXIMUM_WORDS
        );
      }),
    position: POSITION_SCHEMA,
    source: SOURCE_SCHEMA.nullable().optional(),
    textColor: TEXT_COLOR_SCHEMA,
  })
  .strip();
const WALL_PATCH_SCHEMA = z
  .object({
    assignmentId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    fullText: z
      .string()
      .trim()
      .max(600)
      .refine((value) => {
        const wordCount = value.split(/\s+/u).filter(Boolean).length;
        return (
          wordCount >= MIN_SHORT_WALL_TEXT_WORDS &&
          wordCount <= MAX_CURRENT_WALL_TEXT_WORDS
        );
      }),
    source: SOURCE_SCHEMA.nullable().optional(),
    textColor: TEXT_COLOR_SCHEMA,
    textBox: z
      .object({
        height: z.number().finite().min(0.05).max(1),
        width: z.number().finite().min(0.05).max(1),
        x: z.number().finite().min(0).max(1),
        y: z.number().finite().min(0).max(1),
      })
      .strip(),
  })
  .strip();

type RouteContext = {
  params: Promise<{ creativeId: string; format: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return auth.response;
  }

  const scope = await parseScope(request, context);

  if (!scope.ok) {
    return scope.response;
  }

  if (!scope.value.assignmentId) {
    return json(
      { error: "Choose a valid Trending creative.", ok: false },
      400,
    );
  }

  if (getMissingTrendingCreativeEditEnvVars().length > 0) {
    return json(
      { error: "Trending editing is temporarily unavailable.", ok: false },
      501,
    );
  }

  try {
    const edit = await loadTrendingCreativeEditor({
      assignmentId: scope.value.assignmentId,
      creativeId: scope.value.creativeId,
      format: scope.value.format,
      userId: auth.userId,
    });
    return json({ edit, ok: true });
  } catch (error) {
    return editErrorResponse(error, "Could not open this Trending editor.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return auth.response;
  }

  const scope = await parseScope(request, context, false);

  if (!scope.ok) {
    return scope.response;
  }

  if (getMissingTrendingCreativeEditEnvVars().length > 0) {
    return json(
      { error: "Trending editing is temporarily unavailable.", ok: false },
      501,
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = parsePatch(scope.value.format, body);

  if (!parsed.success) {
    return json(
      { error: "Review the text and placement before saving.", ok: false },
      400,
    );
  }

  try {
    const current = await loadTrendingCreativeEditor({
      assignmentId: parsed.data.assignmentId,
      creativeId: scope.value.creativeId,
      format: scope.value.format,
      userId: auth.userId,
    });
    const input = toSaveInput(scope.value.format, parsed.data, current);
    let edit = await saveTrendingCreativeEditor({
      creativeId: scope.value.creativeId,
      format: scope.value.format,
      input,
      userId: auth.userId,
    });

    if (edit.format === "carousel" && edit.id) {
      const editId = edit.id;

      try {
        await createAndDispatchBackgroundJob(
          {
            idempotencyKey: `trending-carousel-edit:${editId}:${edit.revision}`,
            input: {
              carouselId: edit.creativeId,
              editId,
              revision: edit.revision,
              userId: auth.userId,
            },
            jobType: "render_trending_carousel_edit",
            maxAttempts: 3,
            projectId: "trending-carousel-edit",
            userId: auth.userId,
          },
          {
            beforeDispatch: (createdJob) =>
              attachTrendingCreativeEditRenderJob({
                editId,
                jobId: createdJob.id,
                revision: edit.revision,
                userId: auth.userId,
              }).then(() => undefined),
          },
        );
        edit = await loadTrendingCreativeEditor({
          assignmentId: parsed.data.assignmentId,
          creativeId: scope.value.creativeId,
          format: scope.value.format,
          userId: auth.userId,
        });
      } catch (error) {
        await markTrendingCreativeEditRenderFailed({
          editId,
          errorMessage:
            error instanceof Error ? error.message : "Could not queue the render.",
          revision: edit.revision,
          userId: auth.userId,
        }).catch(() => undefined);
        throw error;
      }
    }

    return json({ edit, ok: true });
  } catch (error) {
    return editErrorResponse(error, "Could not save this Trending edit.");
  }
}

function parsePatch(format: TrendingCreativeEditFormat, body: unknown) {
  return format === "carousel"
    ? CAROUSEL_PATCH_SCHEMA.safeParse(body)
    : format === "hook_video"
      ? HOOK_PATCH_SCHEMA.safeParse(body)
      : WALL_PATCH_SCHEMA.safeParse(body);
}

function toSaveInput(
  format: TrendingCreativeEditFormat,
  data:
    | z.infer<typeof CAROUSEL_PATCH_SCHEMA>
    | z.infer<typeof HOOK_PATCH_SCHEMA>
    | z.infer<typeof WALL_PATCH_SCHEMA>,
  current: Awaited<ReturnType<typeof loadTrendingCreativeEditor>>,
): TrendingCreativeEditSaveInput {
  if (format === "carousel" && "slides" in data) {
    return {
      assignmentId: data.assignmentId,
      expectedRevision: data.expectedRevision,
      content: {
        format: "carousel",
        slides: data.slides,
        version: TRENDING_CREATIVE_EDIT_VERSION,
      },
    };
  }

  if (
    format === "hook_video" &&
    "hookText" in data &&
    current.content.format === "hook_video"
  ) {
    return {
      assignmentId: data.assignmentId,
      expectedRevision: data.expectedRevision,
      content: {
        ...createHookEditContent(data.hookText, current.content),
        position: data.position,
        textColor: data.textColor,
      },
      source: data.source,
    };
  }

  if (
    format === "wall_text" &&
    "fullText" in data &&
    current.content.format === "wall_text"
  ) {
    return {
      assignmentId: data.assignmentId,
      expectedRevision: data.expectedRevision,
      content: {
        ...current.content,
        content: createWallTextEditContent(
          data.fullText,
          current.content.content,
        ),
        layout: {
          ...current.content.layout,
          textBox: data.textBox,
        },
        textColor: data.textColor,
      },
      source: data.source,
    };
  }

  throw new TrendingCreativeEditAccessError(
    "This edit does not match the selected creative format.",
    400,
  );
}

async function parseScope(
  request: Request,
  context: RouteContext,
  requireAssignment = true,
) {
  const params = await context.params;
  const format = FORMAT_SCHEMA.safeParse(params.format);
  const creativeId = z.string().uuid().safeParse(params.creativeId);
  const assignmentId = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("assignmentId"));

  if (
    !format.success ||
    !creativeId.success ||
    (requireAssignment && !assignmentId.success)
  ) {
    return {
      ok: false as const,
      response: json(
        { error: "Choose a valid Trending creative.", ok: false },
        400,
      ),
    };
  }

  return {
    ok: true as const,
    value: {
      ...(assignmentId.success ? { assignmentId: assignmentId.data } : {}),
      creativeId: creativeId.data,
      format: format.data,
    },
  };
}

async function authenticate(request: Request) {
  try {
    return { ok: true as const, userId: (await requireFirebaseUser(request)).uid };
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return {
        ok: false as const,
        response: json(
          {
            error:
              error.status === 401
                ? "Sign in before editing Trending creatives."
                : error.message,
            ok: false,
          },
          error.status,
        ),
      };
    }

    console.error("Failed to verify Trending editor requester:", error);
    return {
      ok: false as const,
      response: json(
        { error: "Could not verify your sign-in session.", ok: false },
        500,
      ),
    };
  }
}

function editErrorResponse(error: unknown, fallback: string) {
  if (error instanceof TrendingCreativeEditAccessError) {
    return json({ error: error.message, ok: false }, error.status);
  }

  console.error(fallback, error);
  return json({ error: fallback, ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
