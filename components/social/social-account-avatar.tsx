"use client";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { useSocialAccountPicture } from "@/components/social/use-social-account-picture";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import type { SocialConnection } from "@/lib/social/types";

export function SocialAccountAvatar({
  connection,
  size = "default",
}: {
  connection: SocialConnection;
  size?: "default" | "sm" | "lg";
}) {
  const profilePictureUrl = useSocialAccountPicture(connection);
  const accountName =
    connection.platformAccountName ??
    connection.platformAccountUsername ??
    `${connection.platform} account`;

  return (
    <Avatar size={size}>
      {profilePictureUrl ? (
        <AvatarImage
          src={profilePictureUrl}
          referrerPolicy="no-referrer"
          alt={`${accountName} profile picture`}
        />
      ) : null}
      <AvatarFallback>
        <SocialPlatformIcon
          platform={connection.platform}
          className={size === "sm" ? "size-3" : "size-4"}
        />
      </AvatarFallback>
    </Avatar>
  );
}
