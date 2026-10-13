import { handleClipDraftRead, handleClipDraftSave } from "@/lib/explore/clip-draft-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleClipDraftRead;
export const POST = handleClipDraftSave;
