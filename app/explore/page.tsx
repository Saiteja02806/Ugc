import type { Metadata } from "next";
import { Suspense } from "react";

import { ExploreWorkspace } from "@/components/explore/explore-workspace";
import { ExplorePreviewEntry } from "@/components/explore/explore-preview-entry";
import { JsonLd } from "@/components/marketing/json-ld";
import { publicOrigin } from "@/lib/marketing/public-origin";

const title = "AI UGC Video Generator";
const description =
  "Vidmake is an AI UGC video generator for hook videos, text on screen, slideshows, and app marketing clips. Open Explore, review every asset, and download the version you approve.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: `${publicOrigin}/`,
    siteName: "Vidmake",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Vidmake",
      url: `${publicOrigin}/`,
      description,
    },
    {
      "@type": "WebPage",
      name: title,
      description,
      url: `${publicOrigin}/`,
      isPartOf: { "@type": "WebSite", name: "Vidmake", url: `${publicOrigin}/` },
    },
  ],
};

export default function ExplorePage() {
  // Explore contains shared presentation only. Reading searchParams on the
  // server made every production return dynamically render this static menu.
  // The JSON-LD script is head metadata for the indexable homepage rewrite.
  const workspace = process.env.NODE_ENV === "development"
    ? <Suspense fallback={<ExploreWorkspace />}><ExplorePreviewEntry /></Suspense>
    : <ExploreWorkspace />;
  return (
    <>
      <JsonLd data={homeJsonLd} />
      {workspace}
    </>
  );
}
