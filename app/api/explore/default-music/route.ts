import { handleWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-api";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) { return handleWorkflowDefaultMusic(request); }
