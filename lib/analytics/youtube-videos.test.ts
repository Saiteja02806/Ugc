import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYouTubeUploadsChannelUrl,
  buildYouTubeUploadsPlaylistUrl,
  buildYouTubeVideoDetailsUrl,
  getYouTubePlaylistVideoIds,
  getYouTubeUploadsPlaylistId,
  normalizeYouTubeUploadedVideos,
} from "./youtube-videos.ts";

test("builds authenticated YouTube Data API requests for recent uploads", () => {
  const channelUrl = buildYouTubeUploadsChannelUrl({
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
  });
  const playlistUrl = buildYouTubeUploadsPlaylistUrl({
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
    playlistId: "uploads-playlist",
  });
  const videoUrl = buildYouTubeVideoDetailsUrl({
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
    videoIds: ["video-a", "video-b"],
  });

  assert.equal(channelUrl.pathname, "/youtube/v3/channels");
  assert.equal(channelUrl.searchParams.get("mine"), "true");
  assert.equal(channelUrl.searchParams.get("part"), "contentDetails");
  assert.equal(playlistUrl.pathname, "/youtube/v3/playlistItems");
  assert.equal(playlistUrl.searchParams.get("playlistId"), "uploads-playlist");
  assert.equal(playlistUrl.searchParams.get("maxResults"), "20");
  assert.equal(videoUrl.pathname, "/youtube/v3/videos");
  assert.equal(videoUrl.searchParams.get("id"), "video-a,video-b");
  assert.equal(videoUrl.searchParams.get("part"), "snippet,statistics");
});

test("preserves uploaded-video order and explicit zero analytics", () => {
  const playlistItems = {
    items: [
      { contentDetails: { videoId: "new-video", videoPublishedAt: "2026-09-22T12:00:00Z" } },
      { contentDetails: { videoId: "older-video", videoPublishedAt: "2026-09-21T12:00:00Z" } },
      { contentDetails: { videoId: "new-video" } },
    ],
  };

  assert.equal(
    getYouTubeUploadsPlaylistId({
      items: [{ contentDetails: { relatedPlaylists: { uploads: "uploads-playlist" } } }],
    }),
    "uploads-playlist",
  );
  assert.deepEqual(getYouTubePlaylistVideoIds(playlistItems), ["new-video", "older-video"]);

  assert.deepEqual(
    normalizeYouTubeUploadedVideos({
      playlistItems,
      videos: {
        items: [
          {
            id: "older-video",
            snippet: {
              title: "An existing upload",
              thumbnails: { medium: { url: "https://img.example/older.jpg" } },
            },
            statistics: { commentCount: "4", likeCount: "5", viewCount: "12" },
          },
          {
            id: "new-video",
            snippet: {
              publishedAt: "2026-09-22T12:00:00Z",
              title: "New upload with zero views",
              thumbnails: { high: { url: "https://img.example/new.jpg" } },
            },
            statistics: { commentCount: "0", likeCount: 0, viewCount: 0 },
          },
        ],
      },
    }),
    [
      {
        commentCount: 0,
        id: "new-video",
        likeCount: 0,
        publishedAt: "2026-09-22T12:00:00Z",
        thumbnailUrl: "https://img.example/new.jpg",
        title: "New upload with zero views",
        viewCount: 0,
        watchUrl: "https://www.youtube.com/watch?v=new-video",
      },
      {
        commentCount: 4,
        id: "older-video",
        likeCount: 5,
        publishedAt: "2026-09-21T12:00:00Z",
        thumbnailUrl: "https://img.example/older.jpg",
        title: "An existing upload",
        viewCount: 12,
        watchUrl: "https://www.youtube.com/watch?v=older-video",
      },
    ],
  );
});

test("does not trust non-HTTPS thumbnails or invalid metric values", () => {
  assert.deepEqual(
    normalizeYouTubeUploadedVideos({
      playlistItems: { items: [{ contentDetails: { videoId: "video-a" } }] },
      videos: {
        items: [
          {
            id: "video-a",
            snippet: { thumbnails: { high: { url: "http://img.example/video.jpg" } } },
            statistics: { commentCount: -1, likeCount: "not-a-number", viewCount: null },
          },
        ],
      },
    }),
    [
      {
        commentCount: null,
        id: "video-a",
        likeCount: null,
        publishedAt: null,
        thumbnailUrl: null,
        title: null,
        viewCount: null,
        watchUrl: "https://www.youtube.com/watch?v=video-a",
      },
    ],
  );
});
