import { handleAudioTransferDownload } from "@/lib/audio/transfer";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:Promise<{assetId:string}>}){return handleAudioTransferDownload(request,(await params).assetId);}
