"use client";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { useSocialAccountPicture } from "@/components/social/use-social-account-picture";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

export function InstagramAccountAvatar({
  className,
  connection,
}: {
  className?: string;
  connection: SocialConnection;
}) {
  const profilePictureUrl = useSocialAccountPicture(connection);
  return (
    <Avatar
      aria-hidden="true"
      className={cn(
        "bg-brand-soft ring-1 ring-inset ring-primary/10",
        className,
      )}
    >
      {profilePictureUrl ? (
        <AvatarImage
          alt=""
          referrerPolicy="no-referrer"
          src={profilePictureUrl}
        />
      ) : null}
      <AvatarFallback className="bg-brand-soft">
        <SocialPlatformIcon className="size-4" platform="instagram" />
      </AvatarFallback>
    </Avatar>
  );
}
