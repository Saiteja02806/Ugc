import { getAvatarDisplayName } from "./avatar-display.ts";

export type CreatorGroupedAvatar = {
  creatorKey: string | null;
  label: string;
};

export type AvatarCreatorGroup<TAvatar extends CreatorGroupedAvatar> = {
  creatorKey: string;
  label: string;
  options: TAvatar[];
};

export function groupAvatarsByCreator<TAvatar extends CreatorGroupedAvatar>(
  avatars: readonly TAvatar[],
): AvatarCreatorGroup<TAvatar>[] {
  const groups = new Map<string, AvatarCreatorGroup<TAvatar>>();

  for (const avatar of avatars) {
    const label = getAvatarDisplayName(avatar.label);
    const creatorKey = normalizeCreatorKey(avatar.creatorKey) ||
      normalizeCreatorKey(label) ||
      "influencer";
    const existing = groups.get(creatorKey);

    if (existing) {
      existing.options.push(avatar);
    } else {
      groups.set(creatorKey, { creatorKey, label, options: [avatar] });
    }
  }

  return Array.from(groups.values());
}

function normalizeCreatorKey(value: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") ?? "";
}
