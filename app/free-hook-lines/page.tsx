import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Download, FileText, Layers3, MousePointer2 } from "lucide-react";

import collections from "@/lib/marketing/reaction-hooks.json";
import { CopyHookButton } from "./copy-hook-button";
import styles from "./page.module.css";

const pdfPath = "/resources/ugc-pilot-110-hooks.pdf";
const pageUrl = "https://getugcpilot.com/free-hook-lines";
const resourceName = "The Reaction Hook Library";
const title = `${resourceName}: 110 Free Video Hooks`;
const description = "The Reaction Hook Library: 110 natural video hooks for TikTok, Reels, Shorts and app demos. Copy a line or download the free PDF. No signup.";
const hooks = collections.flatMap((collection) => collection.hooks);
const previews = [1, 2, 8, 17].map((id) => hooks.find((hook) => hook.id === id)!);

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/free-hook-lines" },
  openGraph: { title: `${title} | UGC Pilot`, description, url: pageUrl, type: "website", siteName: "UGC Pilot" },
  twitter: { card: "summary_large_image", title, description },
};

function DownloadLink({ compact = false }: { compact?: boolean }) {
  return (
    <a href={pdfPath} download="UGCPilot_The_Reaction_Hook_Library.pdf" className={`${styles.download} ${compact ? styles.downloadCompact : ""}`}>
      <Download size={21} strokeWidth={1.8} aria-hidden="true" />
      Download 110 free hooks
    </a>
  );
}

function Benefits({ small = false }: { small?: boolean }) {
  return <ul className={`${styles.benefits} ${small ? styles.benefitsSmall : ""}`} aria-label="Download details">
    {["Free PDF", "11 collections", "No signup"].map((label) => <li key={label}><Check size={16} aria-hidden="true" />{label}</li>)}
  </ul>;
}

export default function FreeHookLinesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: resourceName,
    description,
    url: pageUrl,
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "UGC Pilot", url: "https://getugcpilot.com" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: hooks.length,
      itemListElement: hooks.map((hook) => ({ "@type": "ListItem", position: hook.id, name: hook.text })),
    },
    hasPart: { "@type": "DigitalDocument", name: resourceName, encodingFormat: "application/pdf", url: `https://getugcpilot.com${pdfPath}`, isAccessibleForFree: true },
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <a className={styles.skipLink} href="#hook-preview">Skip to hook lines</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="UGC Pilot home">
          <Image src="/brand/ugc-pilot-icon-dark-theme.png" alt="" width={30} height={30} unoptimized />
          <span>UGC Pilot</span>
        </Link>
        <Link href="/free-tools" className={styles.headerLabel}>Free tools</Link>
      </header>

      <section className={styles.hero} aria-labelledby="resource-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{resourceName}</p>
          <h1 id="resource-title"><span className={styles.heroCount}>110</span> natural <span className={styles.heroAccent}>hooks</span><br />for your next video.</h1>
          <p className={styles.heroDescription}>Short, casual openings for TikTok, Reels, Shorts and app demos. Pick a feeling, copy a line, and make it yours.</p>
          <DownloadLink />
          <Benefits />
          <a className={styles.previewLink} href="#hook-preview">Try a few first <ArrowDown size={15} aria-hidden="true" /></a>
        </div>
        <div className={styles.paperStack}>
          <Image className={styles.backPaper} src="/resources/ugc-pilot-hooks-preview.webp" alt="" width={778} height={1100} sizes="(max-width: 700px) 220px, 310px" aria-hidden="true" />
          <Image className={styles.frontPaper} src="/resources/reaction-hook-library-cover-v4.webp" alt="The Reaction Hook Library PDF cover: 110 natural video hooks from UGC Pilot" width={778} height={1100} sizes="(max-width: 700px) 250px, (max-width: 1000px) 280px, 340px" preload />
        </div>
      </section>

      <section id="hook-preview" className={styles.previewSection} aria-labelledby="preview-heading">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>A quick preview</p>
            <h2 id="preview-heading">Here are <span>a few hooks</span> from the library.</h2>
            <p>Short, natural, and ready to make your own.</p>
          </div>
          <ul className={styles.hookList}>
            {previews.map((hook, index) => <li key={hook.id} className={styles.hookRow}>
              <span className={styles.hookNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <p id={`preview-hook-${hook.id}`} className={styles.hookText}>{hook.text}</p>
              <CopyHookButton text={hook.text} targetId={`preview-hook-${hook.id}`} />
            </li>)}
          </ul>
          <div className={styles.features}>
            <div><span className={styles.featureIcon}><FileText size={24} aria-hidden="true" /></span><h3>110 ready-to-use hooks</h3><p>Surprise, curiosity, relatable moments, app reveals. Find the feeling that fits.</p></div>
            <div><span className={styles.featureIcon}><MousePointer2 size={24} aria-hidden="true" /></span><h3>Easy to copy</h3><p>Copy a line here or keep the PDF close. Remix the words so they sound like you.</p></div>
            <div><span className={styles.featureIcon}><Layers3 size={24} aria-hidden="true" /></span><h3>Made for short-form video</h3><p>A first line for TikTok, Reels, Shorts, or a hook followed by your app demo.</p></div>
          </div>

          <details className={styles.library}>
            <summary>Browse all 110 hook lines <span>11 collections <ArrowDown size={17} aria-hidden="true" /></span></summary>
            <p className={styles.libraryIntro}>Choose the emotion that fits your video. Every line below is also in the PDF.</p>
            <div className={styles.collections}>
              {collections.map((collection) => <section key={collection.id} aria-labelledby={`collection-${collection.id}`}>
                <h3 id={`collection-${collection.id}`}>{collection.name}</h3>
                <p>{collection.description}</p>
                <ul className={styles.collectionList}>
                  {collection.hooks.map((hook) => <li key={hook.id} className={styles.hookRow}>
                    <span className={styles.hookNumber} aria-hidden="true">{String(hook.id).padStart(3, "0")}</span>
                    <p id={`library-hook-${hook.id}`} className={styles.hookText}>{hook.text}</p>
                    <CopyHookButton text={hook.text} targetId={`library-hook-${hook.id}`} />
                  </li>)}
                </ul>
              </section>)}
            </div>
          </details>
        </div>
      </section>

      <section className={styles.usage} aria-labelledby="usage-heading">
        <div>
          <p className={styles.eyebrow}>From first line to reveal</p>
          <h2 id="usage-heading">Let the reaction open.<br />Let the demo explain.</h2>
          <p>Pick a short hook that fits the feeling of your video. For a 2–4-second reaction opening, keep the words readable and let the expression carry the emotion.</p>
          <p>Then show the thing you promised: a reveal, a real product action, or a useful result. If a line feels too long, shorten it or give viewers more time to read.</p>
          <Link href="/guides/product-demo-to-short-video" className={styles.textLink}>Plan your hook + demo video <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={styles.example}>
          <span className={styles.exampleLabel}>For a casual app reveal</span>
          <blockquote>“okay, watch what happens when i do this”</blockquote>
          <p>Start with a curious reaction. Cut to a real recording of one app action and its result. Keep your exact words readable on a phone.</p>
          <p className={styles.note}>These are creative starting points, not guaranteed viral trends. Keep claims true to your experience and test different openings against your own watch time and retention.</p>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="download-heading">
        <h2 id="download-heading">Keep The Reaction Hook Library close.</h2>
        <p>Keep all 110 hooks close. Pick one, make it yours, and show what comes next.</p>
        <DownloadLink compact />
        <Benefits small />
      </section>
      <footer className={styles.footer}>
        <Link href="/">UGC Pilot</Link>
        <nav aria-label="Resource footer"><Link href="/guides">More guides</Link><Link href="/ai-ugc-video-generator">Create a hook video <ArrowRight size={14} aria-hidden="true" /></Link></nav>
      </footer>
    </main>
  );
}
