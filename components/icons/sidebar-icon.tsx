import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type SidebarIconName =
  | "trending"
  | "image-gen"
  | "video-gen"
  | "demos"
  | "creative-assets"
  | "library"
  | "influencers"
  | "avatars"
  | "edit"
  | "scheduling"
  | "analytics"
  | "expand"
  | "collapse"
  | "time";

const sidebarIconPaths: Record<SidebarIconName, string> = {
  trending: "/icons/sidebar/trending.svg",
  "image-gen": "/icons/sidebar/image-gen.svg",
  "video-gen": "/icons/sidebar/video-gen.svg",
  demos: "/icons/sidebar/demos.svg",
  "creative-assets": "/icons/sidebar/creative-assets.svg",
  library: "/icons/sidebar/library.svg",
  influencers: "/icons/sidebar/influencers.svg",
  avatars: "/icons/sidebar/avatars.svg",
  edit: "/icons/sidebar/edit.svg",
  scheduling: "/icons/sidebar/scheduling.svg",
  analytics: "/icons/sidebar/analytics.svg",
  expand: "/icons/sidebar/expand.svg",
  collapse: "/icons/sidebar/collapse.svg",
  time: "/icons/sidebar/time.svg",
};

export function SidebarIcon({
  className,
  name,
}: {
  className?: string;
  name: SidebarIconName;
}) {
  const source = sidebarIconPaths[name];
  const style: CSSProperties = {
    WebkitMaskImage: `url("${source}")`,
    maskImage: `url("${source}")`,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-5 shrink-0 bg-current", className)}
      style={style}
    />
  );
}
