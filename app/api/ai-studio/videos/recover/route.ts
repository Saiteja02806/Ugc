import { handleWorkflowGenerationRecovery, handleWorkflowGenerationResolution } from "@/lib/explore/workflow-generation-recovery-api";

export const runtime = "nodejs";
export async function GET(request: Request) { return handleWorkflowGenerationRecovery(request); }
export async function POST(request: Request) { return handleWorkflowGenerationResolution(request); }
