import type { ScheduledPostTarget, SchedulePlatform } from "./types";

const platformNames: Record<SchedulePlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const trustedDomains: Record<SchedulePlatform, readonly string[]> = {
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
};

type PublishedPostLink = {
  href: string;
  label: string;
  help: string | null;
};

export function getPublishedPostLink(
  target: Pick<ScheduledPostTarget, "platform" | "status" | "platformPostUrl" | "settings">,
): PublishedPostLink | null {
  if (target.status !== "published") return null;

  if (target.platformPostUrl) {
    try {
      const url = new URL(target.platformPostUrl);
      const trustedHost = trustedDomains[target.platform].some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      );
      if (
        url.protocol === "https:" && trustedHost && !url.username && !url.password &&
        isPostDestination(target.platform, url)
      ) {
        return {
          href: url.toString(),
          label: `Open on ${platformNames[target.platform]}`,
          help: null,
        };
      }
    } catch {
      // A missing or invalid post URL must never fall back to the exported MP4.
    }
  }

  return null;
}

function isPostDestination(platform: SchedulePlatform, url: URL) {
  if (platform === "instagram") {
    return /^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  }
  if (platform === "youtube") {
    if (url.hostname === "youtu.be") {
      return /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
    }
    return (url.pathname === "/watch" && /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") ?? "")) ||
      /^\/(?:shorts|live|embed)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
  }
  if (url.hostname === "vm.tiktok.com" || url.hostname === "vt.tiktok.com") {
    return /^\/[A-Za-z0-9]+\/?$/.test(url.pathname);
  }
  return /^\/@[^/]+\/(?:video|photo)\/\d+\/?$/.test(url.pathname);
}

export function getPostLinkUnavailableReason(
  target: Pick<ScheduledPostTarget, "platform" | "settings">,
) {
  if (target.platform === "tiktok" && target.settings.privacyLevel === "SELF_ONLY") {
    return "This private TikTok post has no direct link available from TikTok. It cannot be opened from here.";
  }
  return `${platformNames[target.platform]} has not provided a direct link to this post.`;
}

export function shouldShowExportPreview(targets: Pick<ScheduledPostTarget, "status">[] = []) {
  return !targets.some((target) => target.status === "published");
}
