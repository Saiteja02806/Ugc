import { handleTalkingHeadScriptGet, handleTalkingHeadScriptPost } from "@/lib/explore/talking-head-script-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const GET = handleTalkingHeadScriptGet;
export const POST = handleTalkingHeadScriptPost;
