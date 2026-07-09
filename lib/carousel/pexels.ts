type PexelsPhotoSource = {
  large?: string;
  large2x?: string;
  original?: string;
};

export type PexelsPhoto = {
  alt?: string | null;
  avg_color?: string | null;
  height: number;
  id: number;
  photographer?: string | null;
  photographer_url?: string | null;
  src?: PexelsPhotoSource;
  url?: string | null;
  width: number;
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const MAX_PER_PAGE = 80;

function getPexelsApiKey() {
  const apiKey = process.env.PEXELS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing PEXELS_API_KEY.");
  }

  return apiKey;
}

export function getMissingPexelsEnvVars() {
  return process.env.PEXELS_API_KEY?.trim() ? [] : ["PEXELS_API_KEY"];
}

export function getBestPexelsImageUrl(photo: PexelsPhoto) {
  return photo.src?.large2x ?? photo.src?.large ?? photo.src?.original ?? null;
}

export async function searchPexelsPhotos(params: {
  orientation?: "landscape" | "portrait" | "square";
  page?: number;
  perPage?: number;
  query: string;
}) {
  const page = Math.max(Math.trunc(params.page ?? 1), 1);
  const perPage = Math.min(Math.max(params.perPage ?? 30, 1), MAX_PER_PAGE);
  const searchUrl = new URL(PEXELS_SEARCH_URL);

  searchUrl.searchParams.set("query", params.query);
  searchUrl.searchParams.set("page", String(page));
  searchUrl.searchParams.set("per_page", String(perPage));

  if (params.orientation) {
    searchUrl.searchParams.set("orientation", params.orientation);
  }

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: getPexelsApiKey(),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Pexels search failed for "${params.query}" with HTTP ${response.status}.`,
    );
  }

  const json = (await response.json()) as PexelsSearchResponse;

  return Array.isArray(json.photos) ? json.photos : [];
}

export async function downloadPexelsImage(imageUrl: string) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Pexels image download failed with HTTP ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}
