import { handleHookKeyframeGeneration, handleHookKeyframeStatus } from "@/lib/explore/hook-keyframe-generation-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const POST = handleHookKeyframeGeneration;
export const GET = handleHookKeyframeStatus;
