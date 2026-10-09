import { handleWorkflowFinishingStart, handleWorkflowFinishingStatus } from "@/lib/explore/workflow-finishing-api";

export const runtime = "nodejs";
export async function POST(request: Request) { return handleWorkflowFinishingStart(request); }
export async function GET(request: Request) { return handleWorkflowFinishingStatus(request); }
