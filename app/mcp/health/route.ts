import { getMcpStore } from "@/lib/mcp/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { error } = await getMcpStore()
      .from("mcp_oauth_tokens")
      .select("token_hash")
      .limit(1);
    if (error) throw error;
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
