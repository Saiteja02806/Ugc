"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ExploreLinkIndicator } from "@/components/explore/explore-link-indicator";
import styles from "@/components/explore/explore-workspace.module.css";

const CHARACTER_COVER = "/explore/characters/ai-character-create-yours-v5.mp4";
const CHARACTER_POSTER = "/explore/characters/ai-character-create-yours-v5.webp";

export function AICharacterCard({ localPreview = false }: { localPreview?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      const video = videoRef.current;
      if (!video) return;
      video.autoplay = !preference.matches;
      if (preference.matches) video.pause();
      else void video.play().catch(() => {});
    };
    syncPlayback();
    preference.addEventListener("change", syncPlayback);
    return () => preference.removeEventListener("change", syncPlayback);
  }, []);

  return (
    <section aria-labelledby="explore-character-title" className={styles.characterSection}>
      <h2 id="explore-character-title" className="text-lg font-semibold tracking-tight text-foreground-strong">Build AI influencer</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Create an AI influencer for yourself or your business.</p>
      <Link href={localPreview ? "/explore/build-character?preview=1" : "/explore/build-character"}
        aria-label="Build AI influencer: create an AI influencer for yourself or your business"
        className={styles.characterCard}>
        <div className={styles.characterMotion} data-character-cover>
          <Image src={CHARACTER_POSTER} alt="" fill sizes="(min-width: 1200px) 500px, (min-width: 768px) 50vw, 100vw"
            className={styles.characterPoster} />
          <video ref={videoRef} src={CHARACTER_COVER} poster={CHARACTER_POSTER}
            autoPlay muted loop playsInline preload="auto" width={960} height={540}
            onCanPlay={(event) => {
              if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                void event.currentTarget.play().catch(() => {});
              }
            }}
            aria-hidden="true" tabIndex={-1} className={styles.characterVideo} />
        </div>
        <div className={styles.characterCaption}>
          <span>Example AI influencers</span>
          <span className={styles.characterAction}>Create yours <ExploreLinkIndicator label="AI character builder" className="size-3.5" /></span>
        </div>
      </Link>
    </section>
  );
}
