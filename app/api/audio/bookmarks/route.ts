import { requireFirebaseUser } from "@/lib/firebase/server-auth";
import { audioApiError } from "@/lib/audio/api";
import { AudioBookmarkSchema, getAudioBookmarks, setAudioBookmark } from "@/lib/audio/bookmarks";
import { AudioError } from "@/worker/src/lib/audio-contract";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    return Response.json({ voiceIds: await getAudioBookmarks(user.uid) }, { headers });
  } catch (error) { return audioApiError(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const parsed = AudioBookmarkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AudioError("Choose a voice to bookmark or remove.");
    const { voiceId, bookmarked } = parsed.data;
    await setAudioBookmark(user.uid, voiceId, bookmarked);
    return Response.json({ voiceId, bookmarked }, { headers });
  } catch (error) { return audioApiError(error); }
}
