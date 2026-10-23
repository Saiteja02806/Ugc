import { handleAIStudioImageGeneration } from "@/lib/ai-studio/image-generation-api";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  return handleAIStudioImageGeneration(request);
}
