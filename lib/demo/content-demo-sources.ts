import "server-only";
import { listDemoVideos } from "@/lib/demo/demo-storage";
import { listMediaAssets, serializeMediaAsset } from "@/lib/media/media-storage";
import { DEFAULT_DEMO_PROJECT_ID } from "@/lib/demo/demo-api";

/** Content owns the inventory; media_assets is only its playable projection. */
export async function listContentDemoSources(userId: string) {
  const [demos, media] = await Promise.all([
    listDemoVideos({ userId, projectId: DEFAULT_DEMO_PROJECT_ID }),
    listMediaAssets({ userId, collection: "video", sourceTypes: ["demo_upload"] }),
  ]);
  const byId = new Map(media.filter(row => row.status === "ready" && row.source_type === "demo_upload" && row.user_id === userId).map(row => [row.id, row]));
  return demos.flatMap(demo => {
    const asset = byId.get(demo.id);
    if (!asset || !["ready", "draft", "rendered"].includes(demo.status)) return [];
    return [{ ...serializeMediaAsset(asset), title: demo.title, updatedAt: demo.updated_at }];
  });
}
