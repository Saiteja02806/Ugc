import { handleAIStudioFaceSwap } from "@/lib/ai-studio/face-swap-api";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  return handleAIStudioFaceSwap(request);
}
