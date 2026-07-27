import { SocialPlatformIcon } from "@/components/social/platform-icon";
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
  return (
    <Avatar
      aria-hidden="true"
      className={cn(
        "bg-brand-soft ring-1 ring-inset ring-primary/10",
        className,
      )}
    >
      {connection.profilePictureUrl ? (
        <AvatarImage
          alt=""
          referrerPolicy="no-referrer"
          src={connection.profilePictureUrl}
        />
      ) : null}
      <AvatarFallback className="bg-brand-soft">
        <SocialPlatformIcon className="size-4" platform="instagram" />
      </AvatarFallback>
    </Avatar>
  );
}
