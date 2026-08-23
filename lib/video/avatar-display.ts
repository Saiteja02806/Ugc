export function formatCreatorDisplayName(label: string): string {
  const normalized = label.trim();

  if (!normalized) {
    return "Influencer";
  }

  const base = normalized.split(/\s+-\s+/, 1)[0]?.trim() || normalized;

  const creatorMatch = base.match(/^(?:creator|creater|influencer)[_\s-]*0*(\d+)$/i);
  if (creatorMatch) {
    const num = parseInt(creatorMatch[1], 10);
    return `Creator ${num}`;
  }

  return base.replace(/\b(?:creator|creater|influencer)[_\s-]+0*(\d+)\b/gi, (_, numStr) => {
    return `Creator ${parseInt(numStr, 10)}`;
  });
}

export function getAvatarDisplayName(label: string) {
  const normalized = label.trim();

  if (!normalized) {
    return "Influencer";
  }

  return formatCreatorDisplayName(normalized);
}

export function getAvatarFallbackText(label: string) {
  const displayName = getAvatarDisplayName(label);
  const words = displayName.split(/\s+/).filter(Boolean);

  if (words.length >= 2 && !Number.isNaN(Number(words[1]))) {
    return `C${words[1]}`;
  }

  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "IN"
  );
}
