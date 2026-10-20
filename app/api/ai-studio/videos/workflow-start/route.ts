import { handleWorkflowGenerationStart } from "@/lib/explore/workflow-generation-start-api";

export const runtime = "nodejs";
export async function POST(request: Request) { return handleWorkflowGenerationStart(request); }
