import { NextResponse } from "next/server";
import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import { getTalkingHeadReferences } from "@/lib/explore/talking-head-reference-catalog";
import { visibleTalkingHeadReferences } from "@/lib/explore/talking-head-reference";
import { PUBLIC_REFERENCE_WORKFLOWS, publicReferencePreview, type PublicReferenceWorkflow } from "@/lib/explore/public-reference-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Published discovery media only. Authenticated catalogs retain their existing guards. */
export function GET(request: Request) {
  const workflow = new URL(request.url).searchParams.get("workflow");
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!PUBLIC_REFERENCE_WORKFLOWS.includes(workflow as PublicReferenceWorkflow)) {
    return NextResponse.json({ ok: false, message: "Unknown reference workflow." }, { status: 400, headers });
  }
  const items = workflow === "talking_head" ? visibleTalkingHeadReferences(getTalkingHeadReferences()) : getRecreateReferences();
  return NextResponse.json({ ok: true, items: publicReferencePreview(items, workflow as PublicReferenceWorkflow) }, { headers });
}
