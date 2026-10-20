import {
  RefillRequestSchema,
  errorResponse,
  generateMorePosts,
  getClientIp,
} from "@/lib/try-ugcpilot/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = RefillRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "REQUEST_INVALID", message: "A valid content session is required." } },
      { status: 400 },
    );
  }

  try {
    return Response.json(
      await generateMorePosts(
        parsed.data.businessContext,
        parsed.data.nextPostNumber,
        parsed.data.recentHooks,
        getClientIp(request),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
