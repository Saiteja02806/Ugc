export const YOUTUBE_RECENT_VIDEO_LIMIT = 20;

export type YouTubeUploadedVideo = {
  commentCount: number | null;
  id: string;
  likeCount: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  viewCount: number | null;
  watchUrl: string;
};

export type YouTubeUploadsChannelResponse = {
  items?: Array<{
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: unknown;
      };
    };
  }>;
};

export type YouTubePlaylistItemsResponse = {
  items?: Array<{
    contentDetails?: {
      videoId?: unknown;
      videoPublishedAt?: unknown;
    };
  }>;
};

export type YouTubeVideosResponse = {
  items?: Array<{
    id?: unknown;
    snippet?: {
      publishedAt?: unknown;
      thumbnails?: {
        default?: { url?: unknown };
        high?: { url?: unknown };
        maxres?: { url?: unknown };
        medium?: { url?: unknown };
        standard?: { url?: unknown };
      };
      title?: unknown;
    };
    statistics?: {
      commentCount?: unknown;
      likeCount?: unknown;
      viewCount?: unknown;
    };
  }>;
};

type YouTubeVideoThumbnails = NonNullable<
  NonNullable<YouTubeVideosResponse["items"]>[number]["snippet"]
>["thumbnails"];

export function buildYouTubeUploadsChannelUrl(params: { apiBaseUrl: string }) {
  const url = buildYouTubeDataApiUrl(params.apiBaseUrl, "channels");
  url.searchParams.set("mine", "true");
  url.searchParams.set("part", "contentDetails");

  return url;
}

export function buildYouTubeUploadsPlaylistUrl(params: {
  apiBaseUrl: string;
  playlistId: string;
}) {
  const url = buildYouTubeDataApiUrl(params.apiBaseUrl, "playlistItems");
  url.searchParams.set("maxResults", String(YOUTUBE_RECENT_VIDEO_LIMIT));
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("playlistId", params.playlistId);

  return url;
}

export function buildYouTubeVideoDetailsUrl(params: {
  apiBaseUrl: string;
  videoIds: string[];
}) {
  const url = buildYouTubeDataApiUrl(params.apiBaseUrl, "videos");
  url.searchParams.set("id", params.videoIds.join(","));
  url.searchParams.set("part", "snippet,statistics");

  return url;
}

export function getYouTubeUploadsPlaylistId(
  response: YouTubeUploadsChannelResponse,
) {
  return getString(response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads);
}

export function getYouTubePlaylistVideoIds(
  response: YouTubePlaylistItemsResponse,
) {
  return Array.from(
    new Set(
      (response.items ?? []).flatMap((item) => {
        const videoId = getString(item.contentDetails?.videoId);
        return videoId ? [videoId] : [];
      }),
    ),
  );
}

export function normalizeYouTubeUploadedVideos(params: {
  playlistItems: YouTubePlaylistItemsResponse;
  videos: YouTubeVideosResponse;
}): YouTubeUploadedVideo[] {
  const videosById = new Map(
    (params.videos.items ?? []).flatMap((video) => {
      const id = getString(video.id);
      return id ? [[id, video] as const] : [];
    }),
  );

  return getYouTubePlaylistVideoIds(params.playlistItems).flatMap((videoId) => {
    const video = videosById.get(videoId);

    if (!video) {
      return [];
    }

    const playlistItem = (params.playlistItems.items ?? []).find(
      (item) => getString(item.contentDetails?.videoId) === videoId,
    );

    return [
      {
        commentCount: getNonNegativeNumber(video.statistics?.commentCount),
        id: videoId,
        likeCount: getNonNegativeNumber(video.statistics?.likeCount),
        publishedAt:
          getString(video.snippet?.publishedAt) ??
          getString(playlistItem?.contentDetails?.videoPublishedAt),
        thumbnailUrl: getYouTubeThumbnailUrl(video.snippet?.thumbnails),
        title: getString(video.snippet?.title),
        viewCount: getNonNegativeNumber(video.statistics?.viewCount),
        watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      },
    ];
  });
}

function buildYouTubeDataApiUrl(apiBaseUrl: string, path: string) {
  const baseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  return new URL(path, baseUrl);
}

function getYouTubeThumbnailUrl(thumbnails: YouTubeVideoThumbnails) {
  return (
    getHttpsUrl(thumbnails?.maxres?.url) ??
    getHttpsUrl(thumbnails?.standard?.url) ??
    getHttpsUrl(thumbnails?.high?.url) ??
    getHttpsUrl(thumbnails?.medium?.url) ??
    getHttpsUrl(thumbnails?.default?.url)
  );
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getHttpsUrl(value: unknown) {
  const candidate = getString(value);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getNonNegativeNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
