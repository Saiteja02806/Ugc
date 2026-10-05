import { handleAudioVoiceSample } from "@/lib/audio/voice-sample";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ voiceId: string }> }) {
  return handleAudioVoiceSample(request, (await context.params).voiceId);
}
