import { studioCatalogUrl } from "./studio-catalog.ts";
import {
  findTraitById,
  type InfluencerSelectionState,
  type InfluencerTrait,
} from "./influencer-registry.ts";

const STUDIO_IMAGE_PREFIX = "/explore/influencer-studio/";
const MAX_STUDIO_REFERENCES = 10;
export const STUDIO_REFERENCE_MAX_SIDE = 1280;

/** Longest side used when a catalog photo is prepared for a signed-in portrait. */
export function studioReferenceSize(width: number, height: number, maxSide = STUDIO_REFERENCE_MAX_SIDE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("A selected look has no usable size.");
  }
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const SINGLE_REFERENCES: readonly { field: keyof InfluencerSelectionState; role: string }[] = [
  { field: "characterTypeId", role: "character face" },
  { field: "backgroundId", role: "background" },
  { field: "ethnicityId", role: "ethnicity" },
  { field: "headShapeId", role: "head shape" },
  { field: "eyeShapeId", role: "eye shape" },
  { field: "hairStyleId", role: "hairstyle" },
  { field: "outfitId", role: "outfit" },
  { field: "buildId", role: "build" },
  { field: "neckId", role: "neck" },
  { field: "heightId", role: "height" },
];

export type StudioReference = { id: string; role: string; imagePath: string };

export function orderedStudioReferences(
  selection: InfluencerSelectionState,
  customTraits: readonly InfluencerTrait[] = [],
  limit = MAX_STUDIO_REFERENCES,
): StudioReference[] {
  const chosen: StudioReference[] = [];
  const seen = new Set<string>();
  const add = (id: string, role: string) => {
    if (chosen.length >= limit || seen.has(id)) return;
    const trait = findTraitById(id, customTraits);
    const imagePath = trait?.imagePath;
    if (!trait || trait.isCustomUpload || !isStudioImagePath(imagePath)) return;
    seen.add(id);
    chosen.push({ id, role, imagePath });
  };
  for (const item of SINGLE_REFERENCES) {
    const id = selection[item.field];
    if (typeof id === "string") add(id, item.role);
  }
  for (const id of selection.accessoryIds) add(id, "accessory");
  return chosen;
}

export function studioReferenceOrderLine(labels: readonly string[], framing: "full" | "half" = "full") {
  if (!labels.length) return "";
  const order = labels.map((label, index) => `${index + 1} ${label}`).join("; ");
  const subject = framing === "half"
    ? "one person framed from the head through the waist in the selected room"
    : "one full-body person standing in the selected room";
  return `\nCombine these reference images into one new vertical 9:16 photograph of ${subject}. Each image supplies only its named trait. Do not copy a white backdrop, a cropped head, or a floating-head composition. Reference image order: ${order}.`;
}

/** Resolve registered logical paths to immutable shared backend images. */
export function resolveStudioReferenceUrls(ids: readonly string[]) {
  if (ids.length > MAX_STUDIO_REFERENCES || new Set(ids).size !== ids.length) {
    throw new Error("Choose up to 10 different studio references.");
  }
  return ids.map((id) => {
    const trait = findTraitById(id);
    if (!trait || trait.isCustomUpload || !isStudioImagePath(trait.imagePath)) {
      throw new Error("Choose influencer references from the studio.");
    }
    return studioCatalogUrl(trait.imagePath);
  });
}

function isStudioImagePath(imagePath: string | undefined): imagePath is string {
  return Boolean(imagePath?.startsWith(STUDIO_IMAGE_PREFIX) && !imagePath.includes(".."));
}
