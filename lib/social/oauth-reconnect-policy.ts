import type {
  SocialOAuthIntent,
  SocialPlatform,
  SocialProvider,
} from "./types.ts";

export type SocialOAuthReconnectTarget = {
  connectionId: string;
  platform: SocialPlatform;
  platformAccountId: string;
  provider: SocialProvider;
  revokedAt: string | null;
  userId: string;
};

export class SocialOAuthReconnectPolicyError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    code: string,
    status: number,
  ) {
    super(message);
    this.name = "SocialOAuthReconnectPolicyError";
    this.code = code;
    this.status = status;
  }
}

export function assertSocialOAuthReconnectTarget(params: {
  expectedConnectionId: string | null;
  intent: SocialOAuthIntent;
  platform: SocialPlatform;
  provider: SocialProvider;
  returnedPlatformAccountId?: string | null;
  target: SocialOAuthReconnectTarget | null;
  userId: string;
}) {
  if (params.intent === "add") {
    if (params.expectedConnectionId) {
      throw new SocialOAuthReconnectPolicyError(
        "Add-account authorization cannot target an existing connection.",
        "unexpected_reconnect_connection",
        400,
      );
    }

    return;
  }

  if (!params.expectedConnectionId) {
    throw new SocialOAuthReconnectPolicyError(
      "Choose the connected account to reconnect.",
      "reconnect_connection_required",
      400,
    );
  }

  const target = params.target;

  if (
    !target ||
    target.connectionId !== params.expectedConnectionId ||
    target.userId !== params.userId ||
    target.platform !== params.platform ||
    target.provider !== params.provider ||
    target.revokedAt
  ) {
    throw new SocialOAuthReconnectPolicyError(
      "This connected account is no longer available. Refresh and try again.",
      "reconnect_connection_unavailable",
      404,
    );
  }

  if (
    params.returnedPlatformAccountId &&
    params.returnedPlatformAccountId !== target.platformAccountId
  ) {
    throw new SocialOAuthReconnectPolicyError(
      "You signed in to a different account. Sign in to the requested account, or add this account separately.",
      "reconnect_account_mismatch",
      409,
    );
  }
}
