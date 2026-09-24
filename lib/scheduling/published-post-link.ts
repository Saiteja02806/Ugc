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
      if (url.protocol === "https:" && trustedHost && !url.username && !url.password) {
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

  if (target.platform === "tiktok") {
    return {
      href: "https://www.tiktok.com/",
      label: "Open TikTok",
      help: target.settings.privacyLevel === "SELF_ONLY"
        ? "Published as Only me. Open TikTok, switch to this account, then open your private posts. TikTok has not provided a direct post link."
        : "TikTok has not provided a direct post link. Open TikTok and switch to this account to find the post.",
    };
  }

  return null;
}

export function shouldShowExportPreview(targets: Pick<ScheduledPostTarget, "status">[] = []) {
  return !targets.some((target) => target.status === "published");
}
