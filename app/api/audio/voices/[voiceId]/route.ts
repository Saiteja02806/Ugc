import { handleDeleteAudioVoice } from "@/lib/audio/api";
export const runtime = "nodejs";
export async function DELETE(request: Request, { params }: { params: Promise<{ voiceId: string }> }) { return handleDeleteAudioVoice(request, (await params).voiceId); }
