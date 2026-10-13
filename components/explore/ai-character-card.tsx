"use client";

import Image from "next/image";
import Link from "next/link";
import { useCoverPlayback } from "@/components/explore/use-cover-playback";

import { ExploreLinkIndicator } from "@/components/explore/explore-link-indicator";
import styles from "@/components/explore/explore-workspace.module.css";
import { cn } from "@/lib/utils";

const CHARACTER_COVER = "/explore/characters/ai-character-create-yours-v5.mp4";
const CHARACTER_POSTER = "/explore/characters/ai-character-create-yours-v5.webp";

export function AICharacterCard({ localPreview = false }: { localPreview?: boolean }) {
  const videoRef = useCoverPlayback(CHARACTER_COVER);

  return (
    <article aria-labelledby="explore-character-title" className={styles.workflowCard}>
      <Link href={localPreview ? "/explore/build-character?preview=1" : "/explore/build-character"}
        aria-label="Build AI influencer: create an AI influencer for yourself or your business"
        className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-background">
        <div className={cn(styles.cover, styles.characterMotion)} data-character-cover>
          <Image src={CHARACTER_POSTER} alt="" fill sizes="(min-width: 960px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={styles.characterPoster} />
          <video ref={videoRef} poster={CHARACTER_POSTER}
            muted loop playsInline preload="none" width={960} height={540}
            aria-hidden="true" tabIndex={-1} className={styles.characterVideo} />
          <span className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground motion-reduce:transition-none">
            <ExploreLinkIndicator label="AI character builder" className="size-4" />
          </span>
        </div>
        <h3 id="explore-character-title" className="mt-4 text-lg font-semibold tracking-tight text-foreground-strong">Build AI influencer</h3>
        <p className="mt-1.5 max-w-[44ch] text-pretty text-sm leading-6 text-muted">Create an AI influencer for yourself or your business.</p>
      </Link>
    </article>
  );
}
