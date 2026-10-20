import { authenticateDemoRequest, jsonResponse } from "@/lib/demo/demo-api";
import { listContentDemoSources } from "@/lib/demo/content-demo-sources";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateDemoRequest(request);
  if (!auth.ok) return auth.response;
  try {
    return jsonResponse({ ok: true, assets: await listContentDemoSources(auth.user.uid) });
  } catch {
    return jsonResponse({ ok: false, error: "Could not load saved demos. Try again." }, 503);
  }
}
