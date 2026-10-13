import { handleAudioTransferUpload } from "@/lib/audio/transfer";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){return handleAudioTransferUpload(request);}
