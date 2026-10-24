import { createAnalyticsRoute } from "@/lib/analytics/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createAnalyticsRoute("youtube_channel");
export const GET = handlers.GET;
export const POST = handlers.POST;
