import { requireFirebaseUser } from "@/lib/firebase/server-auth";
import { audioApiError } from "@/lib/audio/api";
import { AudioSelectionSchema, getAudioVoiceSelection, setAudioVoiceSelection } from "@/lib/audio/selection";
import { AudioError } from "@/worker/src/lib/audio-contract";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    return Response.json({ voiceId: await getAudioVoiceSelection(user.uid) }, { headers });
  } catch (error) { return audioApiError(error); }
}
export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const parsed = AudioSelectionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AudioError("Choose a voice to use.");
    await setAudioVoiceSelection(user.uid, parsed.data.voiceId);
    return Response.json(parsed.data, { headers });
  } catch (error) { return audioApiError(error); }
}
