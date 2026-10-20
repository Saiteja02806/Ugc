import { handleGenerationRequestRecovery } from "@/lib/ai-studio/generation-request-api";
export const runtime = "nodejs";
export async function GET(request: Request) { return handleGenerationRequestRecovery(request); }
