import "server-only";
import type { DemoVideoRow } from "@/lib/demo/demo-storage";
import { getMcpStore } from "@/lib/mcp/store";

export class DemoLibraryError extends Error {
  constructor(public code: "NOT_FOUND" | "DEMO_CONFLICT" | "INVALID_INPUT" | "DEMOS_UNAVAILABLE", message: string) { super(message); }
}

function fail(error: { message?: string } | null): never {
  const message = error?.message ?? "";
  if (message.includes("mcp_demo_not_found")) throw new DemoLibraryError("NOT_FOUND", "Demo or confirmed upload not found.");
  if (message.includes("mcp_demo_conflict")) throw new DemoLibraryError("DEMO_CONFLICT", "This media is already registered differently or its Demo record has changed.");
  if (message.includes("mcp_demo_input_invalid")) throw new DemoLibraryError("INVALID_INPUT", "Register a confirmed IDE video upload of 1–60 seconds and at most 100 MB.");
  throw new DemoLibraryError("DEMOS_UNAVAILABLE", "The Demo library is temporarily unavailable. Keep the asset ID to retry safely.");
}

export async function registerDemoForOwner(input: { userId: string; assetId: string; projectId: string }) {
  const { data, error } = await getMcpStore().rpc("mcp_register_demo", {
    p_user_id: input.userId, p_asset_id: input.assetId, p_project_id: input.projectId,
  });
  if (error || !data || data.demo_id !== input.assetId || data.asset_id !== input.assetId || data.project_id !== input.projectId) fail(error);
  return { demo_id: input.assetId, asset_id: input.assetId, project_id: input.projectId };
}

export async function deleteDemoForOwner(input: { userId: string; demoId: string; projectId: string }) {
  const { data, error } = await getMcpStore().rpc("mcp_delete_demo", {
    p_user_id: input.userId, p_demo_id: input.demoId, p_project_id: input.projectId,
  });
  if (error || data !== true) fail(error);
}

export async function listDemosForOwner(input: {
  userId: string; projectId: string; limit: number; after?: { updatedAt: string; id: string };
}): Promise<DemoVideoRow[]> {
  let query = getMcpStore().from("demo_videos").select("*")
    .eq("user_id", input.userId).eq("project_id", input.projectId).is("deleted_at", null)
    .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(input.limit + 1);
  if (input.after) query = query.or(`updated_at.lt.${input.after.updatedAt},and(updated_at.eq.${input.after.updatedAt},id.lt.${input.after.id})`);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) fail(error);
  return data as DemoVideoRow[];
}

/** An IDE-registered Demo may use the generic media namespace rather than demos/raw. */
export async function isRegisteredMcpDemoForOwner(input: {
  userId: string; demoId: string; projectId: string; key: string;
}) {
  const { data, error } = await getMcpStore().from("media_assets")
    .select("id").eq("id", input.demoId).eq("user_id", input.userId)
    .eq("project_id", input.projectId).eq("source_type", "demo_upload")
    .eq("source_record_id", input.demoId).eq("storage_key", input.key)
    .eq("collection", "video").contains("metadata", { mcpUpload: true, mcpDemo: true })
    .is("deleted_at", null).maybeSingle();
  if (error) fail(error);
  return !!data;
}
