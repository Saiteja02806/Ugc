export const publicOrigin = "https://getugcpilot.com";

export type BrandYouTubeVideo = {
  id: string;
  pageUrl: string;
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  note: string;
};

/** Fields below come from YouTube oEmbed on 24 Oct 2026. Duration and view count were not in that response. */
export const brandYouTubeVideos = {
  founderShort: {
    id: "2P1whMHDqi8",
    pageUrl: "https://www.youtube.com/shorts/2P1whMHDqi8",
    title: "If you are SAAS founder , we must watch this",
    authorName: "Teja Chundu",
    authorUrl: "https://www.youtube.com/@Teja.Chundu",
    thumbnailUrl: "https://i.ytimg.com/vi/2P1whMHDqi8/hq2.jpg",
    width: 113,
    height: 200,
    note: "Vertical Short. The owner features this one first in the series. The public title is the YouTube title above.",
  },
  toolVideo: {
    id: "9bIweHdRdVw",
    pageUrl: "https://www.youtube.com/watch?v=9bIweHdRdVw",
    title: "Founders Marketing problem solved with this tool #SaaS #marketingdigital #founders #startup",
    authorName: "Teja Chundu",
    authorUrl: "https://www.youtube.com/@Teja.Chundu",
    thumbnailUrl: "https://i.ytimg.com/vi/9bIweHdRdVw/hqdefault.jpg",
    width: 200,
    height: 113,
    note: "Horizontal video on the same channel. The public title is about a founders' marketing problem and a tool.",
  },
  strugglingShort: {
    id: "GDXJqTrVpIw",
    pageUrl: "https://www.youtube.com/shorts/GDXJqTrVpIw",
    title: "SAAS Founders struggling with marketing #saas #saasmarketing",
    authorName: "Teja Chundu",
    authorUrl: "https://www.youtube.com/@Teja.Chundu",
    thumbnailUrl: "https://i.ytimg.com/vi/GDXJqTrVpIw/hq2.jpg",
    width: 113,
    height: 200,
    note: "Vertical Short on the same channel. The public title is the YouTube title above.",
  },
} as const satisfies Record<string, BrandYouTubeVideo>;

export const instagramReels = [
  "DePXM_Pg_Lv",
  "DeW8kYYN_lz",
  "DeqrNISlQ0Z",
  "De1snSfiDeK",
] as const;

export const tiktokVideos = [
  { id: "7698234106957548814", handle: "@clara_iami" },
  { id: "7698738756915907862", handle: "@clara_iamm" },
  { id: "7699988037559700758", handle: "@clara_iamm" },
] as const;

export function instagramReelUrl(code: string) {
  return `https://www.instagram.com/reel/${code}/`;
}

export function tiktokVideoUrl(video: (typeof tiktokVideos)[number]) {
  return `https://www.tiktok.com/${video.handle}/video/${video.id}`;
}

/** Founder profile linked from the homepage. */
export const brandXProfileUrl = "https://x.com/Teja_chundu";

export const brandInstagramProfileUrls = [
  "https://www.instagram.com/mira_handles/",
  "https://www.instagram.com/juliarose.daily/",
  "https://www.instagram.com/clara_iamm/",
] as const;

/** Profiles linked from the homepage Organization node and the README. */
export const brandOrganizationSameAs = [
  brandXProfileUrl,
  ...new Set(Object.values(brandYouTubeVideos).map((video) => video.authorUrl)),
  ...brandInstagramProfileUrls,
  ...new Set(tiktokVideos.map((video) => `https://www.tiktok.com/${video.handle}`)),
];

export function videoObjectJsonLd(video: BrandYouTubeVideo) {
  return {
    "@type": "VideoObject",
    name: video.title,
    description: `YouTube video by ${video.authorName}. Public title: ${video.title}.`,
    thumbnailUrl: video.thumbnailUrl,
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
    url: video.pageUrl,
    author: { "@type": "Person", name: video.authorName, url: video.authorUrl },
  };
}

export function articleJsonLd(input: { path: string; headline: string; description: string; imagePath: string; datePublished?: string }) {
  const url = new URL(input.path, publicOrigin).href;
  return {
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: url,
    image: new URL(input.imagePath, publicOrigin).href,
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    author: {
      "@type": "Organization",
      name: "UGC Pilot",
      url: publicOrigin,
    },
    publisher: {
      "@type": "Organization",
      name: "UGC Pilot",
      url: publicOrigin,
      logo: `${publicOrigin}/brand/ugc-pilot-logo.png`,
    },
  };
}
