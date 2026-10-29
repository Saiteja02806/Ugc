import type { Metadata } from "next";
import { Fragment } from "react";
import guides from "@/lib/marketing/founder-workflow-guides.json";
import { articleJsonLd } from "@/lib/marketing/brand-videos";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleCommand, ArticleLink, ArticleExternalLink } from "@/components/marketing/seo-article";

export const founderWorkflowGuides = guides;
type Guide = (typeof guides)[number];

export function workflowGuide(slug: string): Guide {
  const guide = guides.find((entry) => entry.slug === slug);
  if (!guide) throw new Error(`Missing founder workflow guide: ${slug}`);
  return guide;
}

export function workflowGuideMetadata(guide: Guide): Metadata {
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: { type: "article", title: guide.title, description: guide.description, url: path, siteName: "UGC Pilot" },
    twitter: { card: "summary", title: guide.title, description: guide.description },
  };
}

export function FounderWorkflowGuide({ guide }: { guide: Guide }) {
  return <VideoMarketingPage eyebrow="Practical founder guide" h1={guide.title} lede={guide.lede} jsonLd={{
    "@context": "https://schema.org",
    ...articleJsonLd({ path: `/guides/${guide.slug}`, headline: guide.title, description: guide.description, imagePath: "/guides/opengraph-image" }),
    "@type": "TechArticle",
  }}>
    <ArticleBody>
      {guide.sections.map((section, index) => <Fragment key={section.heading}>
        <ArticleH2>{section.heading}</ArticleH2>
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {index === 1 && <>
          {guide.panels.length > 0 && <figure className="space-y-3">
            <figcaption className="text-sm text-muted">Original illustrative planning diagram. These boxes are not product screenshots.</figcaption>
            <div className="grid gap-3 sm:grid-cols-3">
              {guide.panels.map((panel) => <div key={panel.title} className="rounded-[16px] border border-border bg-card p-4">
                <p className="font-semibold text-primary">{panel.title}</p>
                <p className="mt-3 whitespace-pre-line text-sm text-foreground-strong">{panel.text}</p>
              </div>)}
            </div>
          </figure>}
          <div className="overflow-x-auto rounded-[16px] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" role="region" aria-label={`${guide.title}: example table, scroll horizontally on small screens`} tabIndex={0}>
            <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
              <caption className="bg-card p-4 text-left font-semibold text-foreground-strong">{guide.table.caption}</caption>
              <thead className="bg-card-muted text-foreground-strong"><tr>{guide.table.columns.map((column) => <th scope="col" key={column} className="border-t border-border p-4">{column}</th>)}</tr></thead>
              <tbody>{guide.table.rows.map((row) => <tr key={row[0]}>
                <th scope="row" className="border-t border-border p-4 align-top font-semibold text-foreground-strong">{row[0]}</th>
                {row.slice(1).map((cell, cellIndex) => <td key={cellIndex} className="border-t border-border p-4 align-top">{cell}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </Fragment>)}
      <ArticleH2>Copy the planning worksheet</ArticleH2>
      <p>Use this worksheet in your own notes. Fill it with verified product details and actual review observations before sharing an asset.</p>
      <ArticleCommand>{guide.worksheet}</ArticleCommand>
      {guide.sources.length > 0 && <>
        <ArticleH2>Official references</ArticleH2>
        <p>Requirements and reporting can change. Check the current source for your destination before relying on a specification.</p>
        <ul className="list-disc space-y-2 pl-6">{guide.sources.map((source) => <li key={source.href}><ArticleExternalLink href={source.href}>{source.label}</ArticleExternalLink></li>)}</ul>
      </>}
      <p><ArticleLink href="/guides">Browse the founder guide library</ArticleLink> for the next task in your workflow.</p>
    </ArticleBody>
    <VideoRelatedLinks links={guide.links} />
  </VideoMarketingPage>;
}
