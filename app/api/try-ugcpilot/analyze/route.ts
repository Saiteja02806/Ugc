import {
  AnalyzeRequestSchema,
  analyzeWebsite,
  errorResponse,
  getClientIp,
} from "@/lib/try-ugcpilot/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = AnalyzeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "URL_REQUIRED", message: "Enter a product website URL." } },
      { status: 400 },
    );
  }

  try {
    return Response.json(await analyzeWebsite(parsed.data.url, getClientIp(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
