import { handleAIStudioVideoStatus } from "@/lib/ai-studio/video-generation-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAIStudioVideoStatus(request);
}
