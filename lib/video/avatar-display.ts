export function getAvatarDisplayName(label: string) {
  const normalized = label.trim();

  if (!normalized) {
    return "Influencer";
  }

  return normalized.split(/\s+-\s+/, 1)[0]?.trim() || "Influencer";
}

export function getAvatarFallbackText(label: string) {
  const displayName = getAvatarDisplayName(label);
  const words = displayName.split(/\s+/).filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "IN";
}
