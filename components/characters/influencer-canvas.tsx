"use client";

import Image from "next/image";
import { Bookmark } from "lucide-react";
import type {
  InfluencerSelectionState,
  InfluencerTrait,
} from "@/lib/characters/influencer-registry";
import { STUDIO_HERO_FAN_CARDS } from "@/lib/characters/studio-showcase";
import type { CharacterJobStatusResponse } from "@/lib/characters/types";
import { ImageDownloadButton } from "./image-download-button";
import styles from "./influencer-studio.module.css";

interface InfluencerCanvasProps {
  userId: string | null;
  selection: InfluencerSelectionState;
  activeJobs: CharacterJobStatusResponse["job"][];
  isGenerating: boolean;
  onSaveCharacter: (jobId: string) => void;
  savingJobId: string | null;
  onReturnToSession?: () => void;
  savedCharacterIds?: Set<string>;
  customCharacters?: InfluencerTrait[];
}

export function InfluencerCanvas({
  userId,
  activeJobs,
  isGenerating,
  onSaveCharacter,
  savingJobId,
  onReturnToSession,
  savedCharacterIds = new Set(),
}: InfluencerCanvasProps) {
  const completedJobs = activeJobs.filter(
    (job) => job.isTerminal && job.output?.url
  );
  const failedJobs = activeJobs.filter(
    (job) => job.isTerminal && !job.output?.url
  );

  return (
    <main className={styles.canvasContainer}>
      {onReturnToSession ? (
        <div className={styles.canvasTopNav}>
          <button type="button" className={styles.canvasTab} onClick={onReturnToSession}>
            Back to session
          </button>
        </div>
      ) : null}

      {/* Generating State */}
      {isGenerating && (
        <div className={styles.generatingState}>
          <div className={styles.generatingPulse} />
          <div className={styles.generatingText}>Synthesizing your AI Influencer...</div>
          <div className={styles.generatingSubtext}>
            Sculpting facial geometry, applying selected proportions & rendering 8K portrait
          </div>
        </div>
      )}

      {/* Generated Candidates Results */}
      {!isGenerating && failedJobs.length > 0 && (
        <p className={styles.candidateError} role="alert">{failedJobs[0].error || "The portrait could not be generated."}</p>
      )}

      {!isGenerating && completedJobs.length > 0 && (
        <div className={styles.resultsGrid}>
          {completedJobs.map((job) => {
            const isSaved = savedCharacterIds.has(job.output!.mediaAssetId) || savedCharacterIds.has(job.id);
            const isSaving = savingJobId === job.id;

            return (
              <div key={job.id} className={styles.candidateResultCard}>
                <div className={styles.candidateImageFrame}>
                  <Image
                    src={job.output!.url}
                    alt="Generated AI Influencer"
                    fill
                    sizes="(max-width: 768px) 100vw, 360px"
                    className={styles.candidateImage}
                    unoptimized
                  />
                </div>

                <div className={styles.candidateActions}>
                  <button
                    type="button"
                    className={styles.actionButtonPrimary}
                    onClick={() => onSaveCharacter(job.id)}
                    disabled={isSaved || isSaving}
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                    {isSaved ? "Saved to Influencers" : isSaving ? "Saving..." : "Save to My Influencers"}
                  </button>
                  <ImageDownloadButton
                    assetId={job.output!.mediaAssetId}
                    userId={userId}
                    name="AI Influencer"
                    label="Download"
                    className={styles.actionButtonSecondary}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty Hero State (Before Generation) */}
      {!isGenerating && completedJobs.length === 0 && failedJobs.length === 0 && (
        <div className={styles.heroStudioStage}>
          <div className={styles.heroFanDeck} aria-label="Featured AI influencers">
            {STUDIO_HERO_FAN_CARDS.map((card, index) => (
              <div
                key={card.id}
                className={`${styles.heroFanCard} ${styles[`heroFanCardSlot${index}`] ?? ""}`}
              >
                <Image
                  src={card.url}
                  alt={card.title}
                  fill
                  sizes="220px"
                  className={styles.heroFanCardImage}
                  unoptimized
                />
              </div>
            ))}
          </div>

          <h2 className={styles.heroTitle}>
            YOUR INFLUENCER,
            <br />
            YOUR VIRAL HIT
          </h2>
          <p className={styles.heroSubtitle}>
            Build your AI influencer with the face, body, and style you want.
            Choose traits on the left dock and tap Generate to bring them to life in 4K.
          </p>
        </div>
      )}
    </main>
  );
}
