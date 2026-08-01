import { handleAIStudioImageStatus } from "@/lib/ai-studio/image-generation-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAIStudioImageStatus(request);
}
