import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getLibraryCarouselItemForUser } from "@/lib/library/db";
import {
  createSocialAuthorization,
  SocialOAuthError,
} from "@/lib/social/oauth";
import {
  isProviderPlatformPair,
  isSocialOAuthIntent,
  isSocialOAuthReturnTo,
  isSocialPlatform,
  isSocialProvider,
} from "@/lib/social/types";
import { getUserSubscription } from "@/lib/billing/subscription-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StartBody = {
  carouselId?: unknown;
  forceConsent?: unknown;
  connectionId?: unknown;
  intent?: unknown;
  libraryItemId?: unknown;
  platform?: unknown;
  provider?: unknown;
  returnTo?: unknown;
};

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not verify your sign-in session.",
      },
      status,
    );
  }

  const body = await readJsonBody<StartBody>(request);
  const platform = typeof body?.platform === "string" ? body.platform : "";
  const provider = typeof body?.provider === "string" ? body.provider : "";
  const returnTo = typeof body?.returnTo === "string" ? body.returnTo : "accounts";
  const intent = typeof body?.intent === "string" ? body.intent : "add";
  const expectedConnectionId = normalizeString(body?.connectionId);

  if (!isSocialPlatform(platform) || !isSocialProvider(provider)) {
    return json({ ok: false, message: "Choose a supported social platform." }, 400);
  }

  if (!isProviderPlatformPair(provider, platform)) {
    return json(
      { ok: false, message: "The selected provider does not match this platform." },
      400,
    );
  }

  if (!isSocialOAuthReturnTo(returnTo)) {
    return json({ ok: false, message: "The account connection source is invalid." }, 400);
  }

  if (!isSocialOAuthIntent(intent)) {
    return json({ ok: false, message: "Choose a valid connection action." }, 400);
  }

  if (intent === "reconnect" && !isUuid(expectedConnectionId)) {
    return json(
      { ok: false, message: "Choose the Instagram account to reconnect." },
      400,
    );
  }

  if (intent === "add" && expectedConnectionId) {
    return json(
      {
        ok: false,
        message: "Add another account without selecting an existing connection.",
      },
      400,
    );
  }

  if (intent === "add" && platform === "instagram") {
    const subscription = await getUserSubscription(userId);

    if (
      subscription.connectedInstagramAccounts >= subscription.instagramAccounts
    ) {
      return json(
        {
          code: "instagram_account_limit_reached",
          message:
            subscription.instagramAccounts === 1
              ? `Your ${subscription.isActive ? subscription.displayName : "Free"} plan supports 1 Instagram account. Upgrade to Growth to connect multiple accounts.`
              : `Your ${subscription.displayName} plan supports ${subscription.instagramAccounts} Instagram accounts. Disconnect an account before adding another.`,
          ok: false,
        },
        402,
      );
    }
  }

  let libraryItemId: string | null = null;
  let carouselId: string | null = null;

  if (returnTo === "library" || returnTo === "trending") {
    libraryItemId = normalizeString(body?.libraryItemId);

    if (!libraryItemId) {
      return json(
        {
          ok: false,
          message: "Save this carousel to your online Library before scheduling.",
        },
        400,
      );
    }

    let libraryItem;

    try {
      libraryItem = await getLibraryCarouselItemForUser({
        itemId: libraryItemId,
        userId,
      });
    } catch {
      return json(
        {
          ok: false,
          message: "Could not verify this Library carousel right now.",
        },
        500,
      );
    }

    if (!libraryItem) {
      return json(
        {
          ok: false,
          message: "This Library carousel is not available for your account.",
        },
        404,
      );
    }

    const requestedCarouselId = normalizeString(body?.carouselId);

    if (requestedCarouselId && requestedCarouselId !== libraryItem.sourceId) {
      return json(
        { ok: false, message: "This carousel does not match the Library item." },
        400,
      );
    }

    carouselId = libraryItem.sourceId;
  }

  try {
    const result = await createSocialAuthorization({
      carouselId,
      forceConsent: body?.forceConsent === true,
      expectedConnectionId,
      intent,
      libraryItemId,
      platform,
      provider,
      returnTo,
      userId,
    });

    return json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof SocialOAuthError ? error.status : 500;
    const message =
      error instanceof SocialOAuthError
        ? error.message
        : "Could not start the account connection.";

    return json({ ok: false, message }, status);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

async function readJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
