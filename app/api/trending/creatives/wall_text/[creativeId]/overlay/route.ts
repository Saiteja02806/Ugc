import { z } from "zod";
import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { loadTrendingCreativeEditor } from "@/lib/trending/creative-edit-service";
import { TrendingCreativeEditAccessError } from "@/lib/trending/creative-edits";
import { ensureStoredWallTextOverlay } from "@/lib/trending/wall-text-overlay-storage";
import type { WallTextOverlayInput } from "@/worker/src/lib/wall-text-overlay-renderer";
import { createAuthoritativeWallTextContent } from "@/lib/trending/wall-layout-engine";
import { getBackfillWallTextFormatId } from "@/lib/trending/wall-formats";
import { TRENDING_TEXT_COLOR_VALUES } from "@/lib/trending/text-color";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const draftSchema = z.object({
  fullText: z.string().trim().min(1).max(600),
  textColor: z.enum(TRENDING_TEXT_COLOR_VALUES),
  textBox: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1),
    width: z.number().positive().max(1), height: z.number().positive().max(1) }),
});

export async function POST(request: Request, context: { params: Promise<{ creativeId: string }> }) {
  return GET(request, context);
}

export async function GET(request: Request, context: { params: Promise<{ creativeId: string }> }) {
  try {
    const user = await requireFirebaseUser(request);
    const { creativeId } = await context.params;
    const url = new URL(request.url);
    const assignmentId = z.string().uuid().parse(url.searchParams.get("assignmentId"));
    z.string().uuid().parse(creativeId);
    const revision = z.coerce.number().int().nonnegative().parse(url.searchParams.get("revision"));
    const record = await loadTrendingCreativeEditor({ assignmentId, creativeId, userId: user.uid, format: "wall_text" });
    if (record.content.format !== "wall_text" || record.revision !== revision) {
      return Response.json({ error: "This text changed. Refresh the card to load its latest version." }, { status: 409 });
    }
    let { content, layout, textColor } = record.content;
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > 4096) return Response.json({ error: "Preview request is too large." }, { status: 413 });
      const draft = draftSchema.parse(JSON.parse(raw));
      const box = draft.textBox;
      if (box.x < layout.safeArea.left || box.y < layout.safeArea.top ||
          box.x + box.width > 1 - layout.safeArea.right + 0.000001 ||
          box.y + box.height > 1 - layout.safeArea.bottom + 0.000001) {
        return Response.json({ error: "Text must remain inside the safe area." }, { status: 400 });
      }
      const prepared = await createAuthoritativeWallTextContent({
        content: { kind: "text", text: draft.fullText },
        formatId: getBackfillWallTextFormatId(content.formatId ?? "niche_insight"),
        layout: { ...layout, textBox: box },
      });
      content = prepared.content; layout = prepared.layout; textColor = draft.textColor;
    }
    const input = { text: content, textBox: layout.textBox, placement: layout.placement,
      safeArea: layout.safeArea, textColor } as WallTextOverlayInput;
    const { asset, png } = await ensureStoredWallTextOverlay(user.uid, input);
    return new Response(new Uint8Array(png), { headers: {
      "Content-Type": "image/png", "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "X-Overlay-Sha256": asset.sha256,
      "X-Overlay-Input-Hash": asset.inputHash,
    } });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError || error instanceof TrendingCreativeEditAccessError
      ? error.status : error instanceof z.ZodError ? 400 : 503;
    console.error("Wall text overlay request failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Text preview could not load. Please retry." }, { status });
  }
}
