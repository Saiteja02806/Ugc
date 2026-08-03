import type { SocialPlatform } from "@/lib/social/types";
import { cn } from "@/lib/utils";

export function SocialPlatformIcon({
  className,
  platform,
}: {
  className?: string;
  platform: SocialPlatform;
}) {
  if (platform === "instagram") {
    return (
      <svg
        aria-hidden="true"
        className={cn("text-instagram-rose", className)}
        fill="none"
        viewBox="0 0 24 24"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle
          cx="12"
          cy="12"
          r="4.25"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle cx="17.5" cy="6.7" r="1.25" fill="currentColor" />
      </svg>
    );
  }

  if (platform === "youtube") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        viewBox="0 0 24 24"
      >
        <path
          d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.54 12 3.54 12 3.54s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.19 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.81Z"
          fill="#ff0000"
        />
        <path d="m9.6 15.6 6.23-3.6L9.6 8.4v7.2Z" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={cn("fill-[#111111]", className)}
      viewBox="0 0 24 24"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.11 1.11 2.64 1.62 4.15 1.79v4.32c-1.42-.05-2.85-.31-4.14-.93-.56-.26-1.08-.59-1.59-.94-.01 3.13.01 6.26-.02 9.39-.08 1.5-.58 2.99-1.45 4.22-1.41 2.09-3.85 3.45-6.37 3.49-1.55.09-3.1-.34-4.42-1.12-2.19-1.29-3.73-3.65-3.96-6.19-.03-.55-.04-1.1-.01-1.64.2-2.06 1.22-4.03 2.82-5.35 1.82-1.59 4.36-2.35 6.75-1.9.02 1.59-.04 3.18-.04 4.77-1.09-.35-2.36-.25-3.28.47-.67.49-1.17 1.24-1.33 2.06-.13.61-.09 1.24.05 1.84.42 1.38 1.75 2.35 3.2 2.22.96-.01 1.89-.57 2.39-1.39.16-.28.35-.57.36-.9.09-1.64.05-3.27.06-4.91.01-3.7-.01-7.39.02-11.08Z" />
    </svg>
  );
}
