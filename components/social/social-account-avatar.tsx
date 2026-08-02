import { SocialPlatformIcon } from "@/components/social/platform-icon";
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
  const accountName =
    connection.platformAccountName ??
    connection.platformAccountUsername ??
    `${connection.platform} account`;

  return (
    <Avatar size={size}>
      {connection.profilePictureUrl ? (
        <AvatarImage
          src={connection.profilePictureUrl}
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
