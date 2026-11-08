import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleH2,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/tiktok-slideshow-view-data";
const title = "TikTok Slideshow Data: What 28 Viral Posts and 234M Views Show";
const description =
  "We measured 28 live-verified TikTok slideshows from Vidmake's reference library: 234M total views, median 2.6M. See the slide-count and category numbers, the selection bias, and what they do and do not prove.";
const datePublished = "2026-11-08";

const faqs = [
  {
    question: "How many TikTok slideshows were measured?",
    answer:
      "Twenty-eight TikTok photo carousels with live-verified view counts in Vidmake's reference library, measured on 4 November 2026. Combined they had about 234 million views, with a median of roughly 2.6 million views per post.",
  },
  {
    question: "Do shorter slideshows always get more views?",
    answer:
      "No. In this sample, two-slide decks had the highest median (about 15.6M views from seven posts), but the set is curated and not a controlled experiment. It shows what was collected, not what causes reach.",
  },
  {
    question: "Which category performed best in the data?",
    answer:
      "Fitness posts were the largest group (13 of 28) and had a median of about 8.9M views. The single focus post had the highest individual count at about 43.4M. Category groups are small, so treat these as descriptive, not predictive.",
  },
  {
    question: "Why is the sample only 28 posts?",
    answer:
      "The library only includes slideshows with a public source link and a view count that could be verified live. Posts without a link or with unverifiable counts were excluded, which is why the set is smaller than the full catalogue.",
  },
  {
    question: "Should I copy the top-performing slideshow?",
    answer:
      "Use it as a starting point, not a template to duplicate. Study the opening slide, the number of slides and the payoff, then adapt the structure to your own product and audience. Copying the topic usually produces a weaker post.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "article",
    url: new URL(path, publicOrigin).href,
    siteName: "Vidmake",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function TikTokSlideshowViewDataPage() {
  return (
    <VideoMarketingPage
      eyebrow="Original data study"
      h1={title}
      lede="Most slideshow advice is anecdotal. We measured the live view counts of 28 verified TikTok photo carousels in our reference library — a curated sample, not a controlled test — and this is what the numbers actually look like."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Method, so you can judge the numbers honestly</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Source:</strong> the TikTok photo carousels in Vidmake&apos;s slideshow reference library.</li>
          <li><strong className="text-foreground-strong">Included:</strong> 28 posts with a public source link and a view count verified live on 4 November 2026.</li>
          <li><strong className="text-foreground-strong">Excluded:</strong> posts with no public link, a profile-only link, or a count that could not be verified.</li>
          <li><strong className="text-foreground-strong">What was measured:</strong> view count, category tag and number of slides.</li>
          <li><strong className="text-foreground-strong">What was not measured:</strong> watch time, completion rate, saves, shares, follower count, posting time or the algorithm&apos;s distribution.</li>
        </ul>
        <p>
          This is a <strong className="font-semibold text-foreground-strong">descriptive sample</strong>, not a randomised
          experiment. The posts were collected because they were interesting references, which introduces selection
          bias. Every number below describes this set; none of it proves what will happen to your post.
        </p>

        <ArticleH2>The headline numbers</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Summary statistics for the measured TikTok slideshow sample</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Measure</th>
                <th scope="col" className="p-4 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Posts measured</th><td className="p-4 align-top">28</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Combined views</th><td className="p-4 align-top">≈ 234 million</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Median views per post</th><td className="p-4 align-top">≈ 2.6 million</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Highest single post</th><td className="p-4 align-top">≈ 43.4 million</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Lowest post</th><td className="p-4 align-top">≈ 52 thousand</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          The range is enormous — over 800× between the lowest and highest post — which is the first honest finding:
          &ldquo;TikTok slideshow&rdquo; is not one performance level.
        </p>

        <ArticleH2>Views by number of slides</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[460px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Median views by slide count in the measured sample</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Slides</th>
                <th scope="col" className="p-4 font-semibold">Posts</th>
                <th scope="col" className="p-4 font-semibold">Median views</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">2</th><td className="p-4 align-top">7</td><td className="p-4 align-top">≈ 15.6M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">3</th><td className="p-4 align-top">3</td><td className="p-4 align-top">≈ 1.2M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">4</th><td className="p-4 align-top">3</td><td className="p-4 align-top">≈ 3.0M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">5</th><td className="p-4 align-top">1</td><td className="p-4 align-top">≈ 9.2M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">6</th><td className="p-4 align-top">7</td><td className="p-4 align-top">≈ 2.0M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">7</th><td className="p-4 align-top">5</td><td className="p-4 align-top">≈ 1.5M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">8</th><td className="p-4 align-top">1</td><td className="p-4 align-top">≈ 1.1M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">9</th><td className="p-4 align-top">1</td><td className="p-4 align-top">≈ 153K</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Two-slide posts had the highest median in this set, and every group with fewer than three posts is too small
          to read as a pattern. The safest interpretation: in our sampled references, the long decks did not
          automatically outperform shorter ones. If you are testing, do not assume &ldquo;more slides = more value.&rdquo;
        </p>

        <ArticleH2>Views by category</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Median views by category tag in the measured sample</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Category tag</th>
                <th scope="col" className="p-4 font-semibold">Posts</th>
                <th scope="col" className="p-4 font-semibold">Median views</th>
                <th scope="col" className="p-4 font-semibold">Range</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Focus</th><td className="p-4 align-top">1</td><td className="p-4 align-top">≈ 43.4M</td><td className="p-4 align-top">single post</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Fitness</th><td className="p-4 align-top">13</td><td className="p-4 align-top">≈ 8.9M</td><td className="p-4 align-top">52K – 32.1M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Skincare</th><td className="p-4 align-top">3</td><td className="p-4 align-top">≈ 9.2M</td><td className="p-4 align-top">153K – 9.7M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Calorie tracking</th><td className="p-4 align-top">4</td><td className="p-4 align-top">≈ 6.5M</td><td className="p-4 align-top">667K – 12.2M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Relationship</th><td className="p-4 align-top">4</td><td className="p-4 align-top">≈ 2.6M</td><td className="p-4 align-top">1.7M – 3.4M</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Interior design</th><td className="p-4 align-top">3</td><td className="p-4 align-top">≈ 1.1M</td><td className="p-4 align-top">689K – 1.5M</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Fitness is both the largest group and a high median, which is the most robust observation in the set. The
          focus category is a single post and should not be read as a category average.
        </p>

        <ArticleH2>What this data does not prove</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Causation.</strong> A slide count or category tag does not cause views.</li>
          <li><strong className="text-foreground-strong">Representativeness.</strong> These are curated references, not a random sample of TikTok.</li>
          <li><strong className="text-foreground-strong">Retention.</strong> Views are not the same as watch time or completion.</li>
          <li><strong className="text-foreground-strong">Account effects.</strong> Follower size, posting history and distribution are not controlled.</li>
          <li><strong className="text-foreground-strong">Durability.</strong> Counts change; the numbers are a snapshot from 4 November 2026.</li>
        </ul>

        <ArticleH2>What to do with it in practice</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Test slide count deliberately.</strong> Run the same idea at 2-3 slides and at 6-7 slides, then compare your own results.</li>
          <li><strong className="text-foreground-strong">Make the first slide do the work.</strong> A carousel is judged before slide two; see the <ArticleLink href="/guides/saas-slideshow-opening-slide">opening-slide guide</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">Keep one message per deck.</strong> More slides should mean more explanation, not more topics. The <ArticleLink href="/guides/saas-carousel-feature-story">carousel feature-story guide</ArticleLink> covers the structure.</li>
          <li><strong className="text-foreground-strong">Judge your own numbers.</strong> Use your account&apos;s analytics instead of someone else&apos;s medians; the <ArticleLink href="/guides/saas-format-test-plan">format test plan</ArticleLink> sets up a fair comparison.</li>
          <li><strong className="text-foreground-strong">Review before publishing.</strong> A high-view reference can still be a bad fit for your product; the <ArticleLink href="/guides/saas-carousel-visual-brief">visual brief guide</ArticleLink> keeps the slides on message.</li>
        </ol>

        <ArticleH2>How the slideshows are made</ArticleH2>
        <p>
          The references above are public TikTok carousels collected for study. If you want to produce your own, the
          <ArticleLink href="/instagram-carousel-maker">Instagram carousel maker</ArticleLink> page covers the Vidmake
          workflow: start from business context, review the slide sequence, and download the approved version.
          Instagram carousels and TikTok photo posts are different destinations, so check the current format
          requirements for each before publishing.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/instagram-carousel-maker", title: "Instagram carousel maker", description: "Create and review a complete slide sequence." },
          { href: "/guides/saas-carousel-feature-story", title: "Carousel feature story", description: "Structure a deck around one feature." },
          { href: "/guides/saas-slideshow-opening-slide", title: "Slideshow opening slide", description: "Make the first slide carry the message." },
          { href: "/guides/saas-format-test-plan", title: "Format test plan", description: "Compare formats with your own numbers." },
          { href: "/guides/saas-slideshow-breakdowns", title: "Slideshow breakdowns", description: "Study structure and pacing examples." },
          { href: "/blog/ugc-video-generator-examples", title: "UGC video examples", description: "Real public outputs across formats." },
        ]}
      />
    </VideoMarketingPage>
  );
}
