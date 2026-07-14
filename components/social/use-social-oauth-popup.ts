"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  getProviderForPlatform,
  isSocialOAuthResultMessage,
  type SocialOAuthResultMessage,
  type SocialOAuthReturnTo,
  type SocialPlatform,
} from "@/lib/social/types";

type StartConnectionParams = {
  carouselId?: string;
  libraryItemId?: string;
  platform: SocialPlatform;
  returnTo: SocialOAuthReturnTo;
};

type StartConnectionResponse =
  | {
      authorizationUrl: string;
      ok: true;
      sessionId: string;
    }
  | {
      message: string;
      ok: false;
    };

type PopupClosedContext = {
  platform: SocialPlatform;
  provider: ReturnType<typeof getProviderForPlatform>;
};

export function useSocialOAuthPopup(params?: {
  onPopupClosed?: (context: PopupClosedContext) => boolean | Promise<boolean>;
  onResult?: (result: SocialOAuthResultMessage) => void | Promise<void>;
}) {
  const popupRef = useRef<Window | null>(null);
  const closePollRef = useRef<number | null>(null);
  const onPopupClosedRef = useRef(params?.onPopupClosed);
  const onResultRef = useRef(params?.onResult);
  const [connectingPlatform, setConnectingPlatform] =
    useState<SocialPlatform | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);
  const clearPopupError = useCallback(() => setPopupError(null), []);

  useEffect(() => {
    onPopupClosedRef.current = params?.onPopupClosed;
  }, [params?.onPopupClosed]);

  useEffect(() => {
    onResultRef.current = params?.onResult;
  }, [params?.onResult]);

  const clearClosePoll = useCallback(() => {
    if (closePollRef.current !== null) {
      window.clearInterval(closePollRef.current);
      closePollRef.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    clearClosePoll();

    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }

    popupRef.current = null;
    setConnectingPlatform(null);
  }, [clearClosePoll]);

  useEffect(() => {
    function receiveOAuthResult(event: MessageEvent<unknown>) {
      if (
        !isAllowedOAuthMessageOrigin(event.origin) ||
        event.source !== popupRef.current ||
        !isSocialOAuthResultMessage(event.data)
      ) {
        return;
      }

      clearClosePoll();
      popupRef.current?.close();
      popupRef.current = null;
      setConnectingPlatform(null);

      if (event.data.status === "error") {
        setPopupError(getOAuthResultErrorMessage(event.data));
      } else {
        setPopupError(null);
      }

      void onResultRef.current?.(event.data);
    }

    window.addEventListener("message", receiveOAuthResult);

    return () => {
      window.removeEventListener("message", receiveOAuthResult);
      clearClosePoll();

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, [clearClosePoll]);

  const startConnection = useCallback(
    async (input: StartConnectionParams) => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.focus();
        return;
      }

      setPopupError(null);
      setConnectingPlatform(input.platform);

      const popup = window.open(
        "about:blank",
        `ugc-social-oauth-${input.platform}`,
        "popup=yes,width=620,height=760,resizable=yes,scrollbars=yes",
      );

      if (!popup) {
        setConnectingPlatform(null);
        setPopupError(
          "Your browser blocked the connection window. Allow popups for UGC Pilot and try again.",
        );
        return;
      }

      popupRef.current = popup;

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before connecting a social account.");
        }

        const response = await fetch("/api/social/oauth/start", {
          body: JSON.stringify({
            carouselId: input.carouselId,
            libraryItemId: input.libraryItemId,
            platform: input.platform,
            provider: getProviderForPlatform(input.platform),
            returnTo: input.returnTo,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const data = (await response.json().catch(() => null)) as
          | StartConnectionResponse
          | null;

        if (!response.ok || data?.ok !== true) {
          throw new Error(
            data?.ok === false
              ? data.message
              : "Could not start the account connection.",
          );
        }

        popup.location.replace(data.authorizationUrl);
        popup.focus();
        clearClosePoll();
        closePollRef.current = window.setInterval(() => {
          if (!popup.closed) {
            return;
          }

          clearClosePoll();
          popupRef.current = null;
          setConnectingPlatform(null);

          void (async () => {
            const handled = await onPopupClosedRef.current?.({
              platform: input.platform,
              provider: getProviderForPlatform(input.platform),
            });

            if (handled) {
              setPopupError(null);
              return;
            }

            setPopupError(
              "The connection window was closed before authorization finished.",
            );
          })();
        }, 500);
      } catch (error) {
        clearClosePoll();
        popup.close();
        popupRef.current = null;
        setConnectingPlatform(null);
        setPopupError(
          error instanceof Error
            ? error.message
            : "Could not start the account connection.",
        );
      }
    },
    [clearClosePoll],
  );

  return {
    clearPopupError,
    closePopup,
    connectingPlatform,
    popupError,
    startConnection,
  };
}

function isAllowedOAuthMessageOrigin(origin: string) {
  if (origin === window.location.origin) {
    return true;
  }

  try {
    const current = new URL(window.location.origin);
    const incoming = new URL(origin);

    return (
      current.protocol === incoming.protocol &&
      ((current.hostname === "getugcpilot.com" &&
        incoming.hostname === "www.getugcpilot.com") ||
        (current.hostname === "www.getugcpilot.com" &&
          incoming.hostname === "getugcpilot.com"))
    );
  } catch {
    return false;
  }
}

function getOAuthResultErrorMessage(result: SocialOAuthResultMessage) {
  switch (result.errorCode) {
    case "authorization_denied":
      return `${getPlatformLabel(result.platform)} authorization was cancelled.`;
    case "eligible_instagram_account_missing":
      return "No eligible Instagram professional account was found. Connect it to a Facebook Page and try again.";
    case "invalid_or_expired_state":
      return "This connection request expired. Start the connection again.";
    case "missing_callback_parameters":
      return `${getPlatformLabel(result.platform)} did not return a complete authorization response. Try connecting again.`;
    case "provider_exchange_failed":
      return `${getPlatformLabel(result.platform)} authorized the request, but the token exchange failed. Check the app credentials and redirect URI.`;
    case "account_lookup_failed":
      return `${getPlatformLabel(result.platform)} connected, but the account profile could not be loaded. Check the granted permissions.`;
    case "connection_save_failed":
      return `${getPlatformLabel(result.platform)} connected, but UGC Pilot could not save the account. Try again.`;
    case "youtube_channel_missing":
      return "No YouTube channel was found for this Google account.";
    default:
      return `${getPlatformLabel(result.platform)} could not be connected. Try again.`;
  }
}

function getPlatformLabel(platform: SocialPlatform) {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
  }
}
