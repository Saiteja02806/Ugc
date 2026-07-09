import {
  resolveCarouselBusinessVisualProfile,
  type CarouselBusinessVisualProfile,
} from "@/lib/carousel/business-visual-profile";
import {
  resolveCarouselCategory,
  type ResolvedCarouselCategory,
} from "@/lib/carousel/category-resolver";

export type CarouselCategoryProfileInput = {
  category?: unknown;
  pexelsImageQueries?: unknown;
  productSummary?: unknown;
  valueProps?: unknown;
  visualKeywords?: unknown;
};

export type ResolvedCarouselCategoryProfile = {
  businessVisualProfile: CarouselBusinessVisualProfile;
  candidateCategorySlugs: string[];
  categorySlug: string;
  legacyCategory: ResolvedCarouselCategory;
  legacyCategorySlug: string;
  profileCategorySlug: string;
  queries: string[];
  usesProfileCategorySlug: boolean;
  visualKeywords: string[];
};

function unique(values: string[]) {
  return values.filter((value, index, items) => value && items.indexOf(value) === index);
}

export function resolveCarouselCategoryProfile(
  input: CarouselCategoryProfileInput,
): ResolvedCarouselCategoryProfile {
  const legacyCategory = resolveCarouselCategory(input);
  const businessVisualProfile = resolveCarouselBusinessVisualProfile(input);
  const profileCategorySlug = businessVisualProfile.categorySlug;
  const shouldUseProfileCategory = businessVisualProfile.id !== "generic-business";
  const categorySlug = shouldUseProfileCategory
    ? profileCategorySlug
    : legacyCategory.categorySlug;

  return {
    businessVisualProfile,
    candidateCategorySlugs: unique([categorySlug, legacyCategory.categorySlug]),
    categorySlug,
    legacyCategory,
    legacyCategorySlug: legacyCategory.categorySlug,
    profileCategorySlug,
    queries: legacyCategory.queries,
    usesProfileCategorySlug: categorySlug === profileCategorySlug,
    visualKeywords: legacyCategory.visualKeywords,
  };
}
