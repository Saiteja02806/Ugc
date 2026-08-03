import {
  addMediaAssetsToGroup,
  listCreativeAssetGroupAssets,
  removeMediaAssetFromGroup,
} from "@/lib/media/creative-asset-groups";
import {
  creativeAssetGroupErrorResponse,
  parseCreativeAssetGroupId,
} from "@/lib/media/creative-asset-group-route";
import {
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupItemsRouteContext = {
  params: Promise<{ groupId: string }>;
};

type AddGroupItemsBody = {
  mediaAssetIds?: unknown;
};

type RemoveGroupItemBody = {
  mediaAssetId?: unknown;
};

export async function GET(
  request: Request,
  context: GroupItemsRouteContext,
) {
  try {
    const user = await requireFirebaseUser(request);
    const { groupId: rawGroupId } = await context.params;
    const groupId = parseCreativeAssetGroupId(rawGroupId);

    if (!groupId) {
      return Response.json(
        { error: "Group ID is invalid.", ok: false },
        { status: 400 },
      );
    }

    const result = await listCreativeAssetGroupAssets({
      groupId,
      userId: user.uid,
    });

    if (!result) {
      return Response.json(
        { error: "Group was not found.", ok: false },
        { status: 404 },
      );
    }

    return Response.json(
      { assets: result.assets, group: result.group, ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not load this group.",
    );
  }
}

export async function POST(
  request: Request,
  context: GroupItemsRouteContext,
) {
  try {
    const user = await requireFirebaseUser(request);
    const { groupId: rawGroupId } = await context.params;
    const groupId = parseCreativeAssetGroupId(rawGroupId);
    const body = (await request.json().catch(() => null)) as
      | AddGroupItemsBody
      | null;
    const mediaAssetIds = Array.isArray(body?.mediaAssetIds)
      ? Array.from(
          new Set(
            body.mediaAssetIds
              .map(parseCreativeAssetGroupId)
              .filter((value): value is string => value !== null),
          ),
        )
      : [];

    if (!groupId) {
      return Response.json(
        { error: "Group ID is invalid.", ok: false },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(body?.mediaAssetIds) ||
      mediaAssetIds.length !== body.mediaAssetIds.length ||
      mediaAssetIds.length === 0 ||
      mediaAssetIds.length > 100
    ) {
      return Response.json(
        {
          error: "Choose between 1 and 100 valid assets.",
          ok: false,
        },
        { status: 400 },
      );
    }

    const items = await addMediaAssetsToGroup({
      groupId,
      mediaAssetIds,
      userId: user.uid,
    });

    return Response.json({ items, ok: true });
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not add assets to this group.",
    );
  }
}

export async function DELETE(
  request: Request,
  context: GroupItemsRouteContext,
) {
  try {
    const user = await requireFirebaseUser(request);
    const { groupId: rawGroupId } = await context.params;
    const groupId = parseCreativeAssetGroupId(rawGroupId);
    const body = (await request.json().catch(() => null)) as
      | RemoveGroupItemBody
      | null;
    const mediaAssetId = parseCreativeAssetGroupId(body?.mediaAssetId);

    if (!groupId || !mediaAssetId) {
      return Response.json(
        { error: "Group and media asset IDs are required.", ok: false },
        { status: 400 },
      );
    }

    const removed = await removeMediaAssetFromGroup({
      groupId,
      mediaAssetId,
      userId: user.uid,
    });

    return Response.json({ ok: true, removed });
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not remove this asset from the group.",
    );
  }
}
