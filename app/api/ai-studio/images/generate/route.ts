import { handleAIStudioImageGeneration } from "@/lib/ai-studio/image-generation-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAIStudioImageGeneration(request);
}
