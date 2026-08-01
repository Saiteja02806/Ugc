import {
  createCreativeAssetGroup,
  isCreativeAssetGroupMediaType,
  listCreativeAssetGroups,
} from "@/lib/media/creative-asset-groups";
import {
  creativeAssetGroupErrorResponse,
  parseCreativeAssetGroupName,
} from "@/lib/media/creative-asset-group-route";
import {
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateGroupBody = {
  mediaType?: unknown;
  name?: unknown;
};

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const rawMediaType = new URL(request.url).searchParams.get("mediaType");

    if (!isCreativeAssetGroupMediaType(rawMediaType)) {
      return Response.json(
        { error: "Choose Videos or Images.", ok: false },
        { status: 400 },
      );
    }

    const groups = await listCreativeAssetGroups({
      mediaType: rawMediaType,
      userId: user.uid,
    });

    return Response.json(
      { groups, ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not load creative asset groups.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | CreateGroupBody
      | null;
    const name = parseCreativeAssetGroupName(body?.name);

    if (!body || !isCreativeAssetGroupMediaType(body.mediaType)) {
      return Response.json(
        { error: "Choose Videos or Images.", ok: false },
        { status: 400 },
      );
    }

    if (!name) {
      return Response.json(
        {
          error: "Enter a group name using 80 characters or fewer.",
          ok: false,
        },
        { status: 400 },
      );
    }

    const group = await createCreativeAssetGroup({
      mediaType: body.mediaType,
      name,
      userId: user.uid,
    });

    return Response.json({ group, ok: true }, { status: 201 });
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not create this group.",
    );
  }
}
