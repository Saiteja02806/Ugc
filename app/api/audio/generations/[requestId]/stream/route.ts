import { handleAudioStream } from "@/lib/audio/api";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) { return handleAudioStream(request, (await params).requestId); }
