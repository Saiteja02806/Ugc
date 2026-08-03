import {
  deleteCreativeAssetGroup,
  renameCreativeAssetGroup,
} from "@/lib/media/creative-asset-groups";
import {
  creativeAssetGroupErrorResponse,
  parseCreativeAssetGroupId,
  parseCreativeAssetGroupName,
} from "@/lib/media/creative-asset-group-route";
import {
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupRouteContext = {
  params: Promise<{ groupId: string }>;
};

type RenameGroupBody = {
  name?: unknown;
};

export async function PATCH(
  request: Request,
  context: GroupRouteContext,
) {
  try {
    const user = await requireFirebaseUser(request);
    const { groupId: rawGroupId } = await context.params;
    const groupId = parseCreativeAssetGroupId(rawGroupId);
    const body = (await request.json().catch(() => null)) as
      | RenameGroupBody
      | null;
    const name = parseCreativeAssetGroupName(body?.name);

    if (!groupId) {
      return Response.json(
        { error: "Group ID is invalid.", ok: false },
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

    const group = await renameCreativeAssetGroup({
      groupId,
      name,
      userId: user.uid,
    });

    if (!group) {
      return Response.json(
        { error: "Group was not found.", ok: false },
        { status: 404 },
      );
    }

    return Response.json({ group, ok: true });
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not rename this group.",
    );
  }
}

export async function DELETE(
  request: Request,
  context: GroupRouteContext,
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

    const deleted = await deleteCreativeAssetGroup({
      groupId,
      userId: user.uid,
    });

    if (!deleted) {
      return Response.json(
        { error: "Group was not found.", ok: false },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return creativeAssetGroupErrorResponse(
      error,
      "Could not delete this group.",
    );
  }
}
