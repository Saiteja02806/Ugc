import { handleAIStudioVideoGeneration } from "@/lib/ai-studio/video-generation-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAIStudioVideoGeneration(request);
}
