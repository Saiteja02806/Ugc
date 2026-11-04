"use client";

import Image from "next/image";
import { Bookmark, Sparkles } from "lucide-react";
import type {
  InfluencerSelectionState,
  InfluencerTrait,
} from "@/lib/characters/influencer-registry";
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
  selection: _selection,
  activeJobs,
  isGenerating,
  onSaveCharacter,
  savingJobId,
  onReturnToSession,
  savedCharacterIds = new Set(),
  customCharacters: _customCharacters = [],
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl backdrop-blur-md">
            <Sparkles className="w-8 h-8 text-[#F4F4F5]" />
          </div>

          <h1 className={styles.heroTitle}>Your portrait shows up here</h1>
          <p className={styles.heroSubtitle}>
            Build your AI influencer with the face, body, and style you want.
            Choose traits on the left dock and tap Generate to bring them to life in 4K.
          </p>
        </div>
      )}
    </main>
  );
}
