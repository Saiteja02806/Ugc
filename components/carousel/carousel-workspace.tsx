"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
  CarouselCandidate,
  CarouselSlide,
} from "@/components/carousel/carousel-candidate-card";
import { CarouselPreviewCanvas } from "@/components/carousel/carousel-preview-canvas";
import {
  CarouselSetupPanel,
  type CarouselFormat,
  type CarouselTextStyle,
  type WebsiteAnalysisState,
} from "@/components/carousel/carousel-setup-panel";

type WorkspaceStatus = "empty" | "loading" | "completed" | "failed";

type WebsiteAnalysisResponse =
  | {
      ok: true;
      analysisId: string;
      normalizedDomain: string;
      analysis: {
        businessName: string | null;
        category: string | null;
      };
    }
  | { ok: false; message: string };

type GenerateResponse =
  | {
      ok: true;
      candidateCount: number;
      candidateIds: string[];
      categorySlug: string;
      generationBatchId: string;
      readinessWarnings?: ReadinessWarning[];
      slideCount: number;
    }
  | { ok: false; message: string };

type ReadinessWarning = {
  code: string;
  message: string;
  severity: "warning";
};

type ApiCarouselSlide = {
  headline: string;
  renderedUrl: string | null;
  slideNumber: number;
  slideType: string | null;
  status: "processing" | "ready" | "failed";
  subtext: string | null;
};

type ApiCarouselCandidate = {
  angle: string | null;
  candidateCount: number;
  candidateIndex: number;
  carouselId: string;
  categorySlug: string | null;
  errorMessage: string | null;
  format: CarouselFormat;
  generationBatchId: string;
  slideCount: number;
  slides: ApiCarouselSlide[];
  status: "processing" | "completed" | "failed";
  websiteAnalysisId: string | null;
};

type CarouselStatusResponse =
  | {
      ok: true;
      candidates: ApiCarouselCandidate[];
      generationBatchId?: string;
      hasMore: boolean;
      limit: number;
      offset: number;
      totalCandidates: number;
    }
  | { ok: false; message: string };

const SLIDE_PRELOAD_TIMEOUT_MS = 6_000;
const CANDIDATE_PAGE_SIZE = 10;
const LAZY_GENERATION_LIMIT = 20;

type LoadCandidatesParams =
  | {
      carouselIds: string[];
      generationBatchId?: null;
      limit?: number;
      offset?: number;
    }
  | {
      carouselIds?: string[];
      generationBatchId: string;
      limit?: number;
      offset?: number;
    };

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function preloadSlideImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(resolve, SLIDE_PRELOAD_TIMEOUT_MS);

    function finish() {
      window.clearTimeout(timeout);
      resolve();
    }

    image.decoding = "async";
    image.onload = () => {
      void image.decode?.().catch(() => undefined).finally(finish);
    };
    image.onerror = finish;
    image.src = url;
  });
}

async function preloadPrimaryCandidateSlides(candidates: CarouselCandidate[]) {
  const primaryCandidate = candidates[0];

  if (!primaryCandidate) {
    return;
  }

  const slideUrls = Array.from(
    new Set(primaryCandidate.slides.map((slide) => slide.renderedUrl)),
  );

  await Promise.all(slideUrls.map(preloadSlideImage));
}

function titleCaseSlug(value: string | null) {
  if (!value) {
    return "Analyze a website first";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((word) => {
      const acronyms: Record<string, string> = {
        ai: "AI",
        saas: "SaaS",
        ugc: "UGC",
      };

      return acronyms[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function getFriendlyCarouselError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("needs") && lowerMessage.includes("ready images")) {
    return "This category needs image assets before carousel generation.";
  }

  if (lowerMessage.includes("trigger.dev") || lowerMessage.includes("generation task")) {
    return "The rendering worker is unavailable. Start the worker and try again.";
  }

  return message || "Could not generate the carousel versions. Please try again.";
}

function mapCandidate(candidate: ApiCarouselCandidate): CarouselCandidate {
  const slides = candidate.slides
    .filter((slide) => slide.status === "ready" && Boolean(slide.renderedUrl))
    .map(
      (slide) =>
        ({
          headline: slide.headline,
          renderedUrl: slide.renderedUrl as string,
          slideNumber: slide.slideNumber,
          slideType: slide.slideType ?? "content",
          status: slide.status,
          subtext: slide.subtext,
        }) satisfies CarouselSlide,
    );

  return {
    angle: candidate.angle,
    candidateIndex: candidate.candidateIndex,
    carouselId: candidate.carouselId,
    categorySlug: candidate.categorySlug,
    format: candidate.format,
    slideCount: candidate.slideCount,
    slides,
    status: candidate.status,
  };
}

function getCompletedCandidates(candidates: ApiCarouselCandidate[]) {
  return candidates
    .map(mapCandidate)
    .filter(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.slides.length > 0 &&
        candidate.slides.length === candidate.slideCount,
    )
    .sort((first, second) => first.candidateIndex - second.candidateIndex);
}

function mergeCandidatesById(
  currentCandidates: CarouselCandidate[],
  incomingCandidates: CarouselCandidate[],
) {
  const candidateMap = new Map<string, CarouselCandidate>();

  for (const candidate of currentCandidates) {
    candidateMap.set(candidate.carouselId, candidate);
  }

  for (const candidate of incomingCandidates) {
    candidateMap.set(candidate.carouselId, candidate);
  }

  return Array.from(candidateMap.values()).sort(
    (first, second) => first.candidateIndex - second.candidateIndex,
  );
}

export function CarouselWorkspace({
  initialCarouselIds = [],
  initialGenerationBatchId = null,
}: {
  initialCarouselIds?: string[];
  initialGenerationBatchId?: string | null;
}) {
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [activeSlideByCandidateId, setActiveSlideByCandidateId] = useState<
    Record<string, number>
  >({});
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<WebsiteAnalysisState>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzedDomain, setAnalyzedDomain] = useState<string | null>(null);
  const [candidateCount, setCandidateCount] = useState(10);
  const [candidateIds, setCandidateIds] = useState<string[]>(initialCarouselIds);
  const [candidates, setCandidates] = useState<CarouselCandidate[]>([]);
  const [categoryLabel, setCategoryLabel] = useState("Analyze a website first");
  const [format, setFormat] = useState<CarouselFormat>("4:5");
  const [generationBatchId, setGenerationBatchId] = useState<string | null>(
    initialGenerationBatchId,
  );
  const [goal, setGoal] = useState("Drive signups");
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [isLoadingMoreCandidates, setIsLoadingMoreCandidates] = useState(false);
  const [lazyLoadError, setLazyLoadError] = useState<string | null>(null);
  const [readinessWarning, setReadinessWarning] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState(5);
  const [status, setStatus] = useState<WorkspaceStatus>(
    initialGenerationBatchId || initialCarouselIds.length ? "loading" : "empty",
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [textStyle, setTextStyle] = useState<CarouselTextStyle>("highlight");
  const [totalCandidates, setTotalCandidates] = useState(initialCarouselIds.length);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const candidatesRef = useRef<CarouselCandidate[]>([]);
  const generatedMoreBatchRef = useRef<Set<string>>(new Set());
  const isLoadingMoreRef = useRef(false);
  const lazyLoadToken = useRef(0);
  const requestToken = useRef(0);

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMoreCandidates;
  }, [isLoadingMoreCandidates]);

  async function readCandidateStatuses(params: LoadCandidatesParams) {
    const searchParams = new URLSearchParams();

    if (params.generationBatchId) {
      searchParams.set("generationBatchId", params.generationBatchId);
      searchParams.set("limit", String(params.limit ?? CANDIDATE_PAGE_SIZE));
      searchParams.set("offset", String(params.offset ?? 0));
    } else {
      searchParams.set("carouselIds", (params.carouselIds ?? []).join(","));
    }

    const response = await fetch(`/api/carousel/status?${searchParams.toString()}`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as CarouselStatusResponse | null;

    if (!response.ok || !data?.ok) {
      const message = data && !data.ok ? data.message : "Candidate status is unavailable.";
      throw new Error(message);
    }

    return data;
  }

  async function loadCandidatesUntilTerminal(params: LoadCandidatesParams) {
    const token = ++requestToken.current;
    setStatus("loading");
    setStatusError(null);
    setLazyLoadError(null);
    setHasMoreCandidates(false);
    setTotalCandidates(0);
    setActiveCandidateIndex(0);
    setActiveSlideByCandidateId({});

    for (let attempt = 0; attempt < 150; attempt += 1) {
      try {
        const data = await readCandidateStatuses({
          ...params,
          limit: params.generationBatchId ? CANDIDATE_PAGE_SIZE : params.limit,
          offset: params.generationBatchId ? 0 : params.offset,
        });

        if (token !== requestToken.current) {
          return;
        }

        const firstCandidate = data.candidates[0];

        setCandidateIds(data.candidates.map((candidate) => candidate.carouselId));
        setCandidateCount(data.totalCandidates || data.candidates.length);
        setTotalCandidates(data.totalCandidates || data.candidates.length);
        setHasMoreCandidates(Boolean(data.hasMore));

        if (params.generationBatchId && data.candidates.length === 0) {
          await sleep(2_000);
          continue;
        }

        if (firstCandidate) {
          setCategoryLabel(titleCaseSlug(firstCandidate.categorySlug));
          setFormat(firstCandidate.format);
          setSlideCount(firstCandidate.slideCount);
          setGenerationBatchId(firstCandidate.generationBatchId);

          if (firstCandidate.websiteAnalysisId) {
            setAnalysisId(firstCandidate.websiteAnalysisId);
            setAnalysisState("ready");
          }
        }

        const allTerminal = data.candidates.every(
          (candidate) => candidate.status !== "processing",
        );

        if (allTerminal) {
          const completedCandidates = getCompletedCandidates(data.candidates);

          if (completedCandidates.length > 0) {
            await preloadPrimaryCandidateSlides(completedCandidates);

            if (token !== requestToken.current) {
              return;
            }

            setCandidates(completedCandidates);
            setCandidateIds(completedCandidates.map((candidate) => candidate.carouselId));
            setStatus("completed");
            return;
          }

          const firstError = data.candidates.find((candidate) => candidate.errorMessage)
            ?.errorMessage;
          setStatusError(
            getFriendlyCarouselError(
              firstError ??
                "No safe complete carousel versions are available. Regenerate after approving image assets.",
            ),
          );
          setStatus("failed");
          return;
        }
      } catch (error) {
        if (token !== requestToken.current) {
          return;
        }

        setStatusError(
          getFriendlyCarouselError(
            error instanceof Error ? error.message : "Candidate status is unavailable.",
          ),
        );
        setStatus("failed");
        return;
      }

      await sleep(2_000);
    }

    if (token === requestToken.current) {
      setStatusError("Carousel version rendering is taking longer than expected. Please try again.");
      setStatus("failed");
    }
  }

  async function loadCandidatePageUntilTerminal(batchId: string, offset: number) {
    const token = ++lazyLoadToken.current;

    setIsLoadingMoreCandidates(true);
    setLazyLoadError(null);

    for (let attempt = 0; attempt < 150; attempt += 1) {
      try {
        const data = await readCandidateStatuses({
          generationBatchId: batchId,
          limit: CANDIDATE_PAGE_SIZE,
          offset,
        });

        if (token !== lazyLoadToken.current) {
          return;
        }

        setTotalCandidates(data.totalCandidates || candidatesRef.current.length);
        setHasMoreCandidates(Boolean(data.hasMore));

        if (data.candidates.length === 0) {
          await sleep(2_000);
          continue;
        }

        const allTerminal = data.candidates.every(
          (candidate) => candidate.status !== "processing",
        );

        if (allTerminal) {
          const completedCandidates = getCompletedCandidates(data.candidates);

          if (completedCandidates.length > 0) {
            setCandidates((currentCandidates) => {
              const mergedCandidates = mergeCandidatesById(
                currentCandidates,
                completedCandidates,
              );
              setCandidateIds(mergedCandidates.map((candidate) => candidate.carouselId));
              return mergedCandidates;
            });
          } else {
            setLazyLoadError("More versions could not render.");
          }

          setIsLoadingMoreCandidates(false);
          return;
        }
      } catch (error) {
        if (token !== lazyLoadToken.current) {
          return;
        }

        setLazyLoadError(
          getFriendlyCarouselError(
            error instanceof Error ? error.message : "More versions are unavailable.",
          ),
        );
        setIsLoadingMoreCandidates(false);
        return;
      }

      await sleep(2_000);
    }

    if (token === lazyLoadToken.current) {
      setLazyLoadError("More versions are taking longer than expected.");
      setIsLoadingMoreCandidates(false);
    }
  }

  async function generateMoreCandidates(batchId: string, currentTotal: number) {
    const remainingCandidates = Math.max(0, LAZY_GENERATION_LIMIT - currentTotal);

    if (remainingCandidates <= 0 || generatedMoreBatchRef.current.has(batchId)) {
      return false;
    }

    generatedMoreBatchRef.current.add(batchId);
    setIsLoadingMoreCandidates(true);

    try {
      const response = await fetch("/api/carousel/generate-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationBatchId: batchId,
          candidateCount: Math.min(CANDIDATE_PAGE_SIZE, remainingCandidates),
          textStyle,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; readinessWarnings?: ReadinessWarning[] }
        | { ok: false; message: string }
        | null;

      if (!response.ok || !data?.ok) {
        const message = data && !data.ok ? data.message : "More versions could not start.";
        throw new Error(message);
      }

      setReadinessWarning(data.readinessWarnings?.[0]?.message ?? null);
      setTotalCandidates(Math.min(LAZY_GENERATION_LIMIT, currentTotal + remainingCandidates));
      setHasMoreCandidates(true);
      return true;
    } catch (error) {
      generatedMoreBatchRef.current.delete(batchId);
      throw error;
    }
  }

  async function ensureMoreCandidates() {
    const batchId = generationBatchId;

    if (!batchId || status !== "completed" || isLoadingMoreRef.current) {
      return;
    }

    const loadedCount = candidatesRef.current.length;
    const currentTotal = totalCandidates || loadedCount;

    if (loadedCount >= LAZY_GENERATION_LIMIT) {
      return;
    }

    isLoadingMoreRef.current = true;

    try {
      if (!hasMoreCandidates) {
        const startedGeneration = await generateMoreCandidates(batchId, currentTotal);

        if (!startedGeneration) {
          setIsLoadingMoreCandidates(false);
          isLoadingMoreRef.current = false;
          return;
        }
      }

      await loadCandidatePageUntilTerminal(batchId, loadedCount);
    } catch (error) {
      setLazyLoadError(
        getFriendlyCarouselError(
          error instanceof Error ? error.message : "More versions are unavailable.",
        ),
      );
      setIsLoadingMoreCandidates(false);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }

  useEffect(() => {
    if (!initialGenerationBatchId && initialCarouselIds.length === 0) {
      return;
    }

    const startupTimer = window.setTimeout(() => {
      void loadCandidatesUntilTerminal(
        initialGenerationBatchId
          ? { generationBatchId: initialGenerationBatchId }
          : { carouselIds: initialCarouselIds },
      );
    }, 0);

    return () => {
      window.clearTimeout(startupTimer);
      requestToken.current += 1;
    };
    // URL-provided batch/candidate IDs are intentionally loaded only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGenerationBatchId, initialCarouselIds.join(",")]);

  function replaceCarouselUrl(nextGenerationBatchId: string) {
    const searchParams = new URLSearchParams({
      generationBatchId: nextGenerationBatchId,
    });

    window.history.replaceState(null, "", `/carousel?${searchParams.toString()}`);
  }

  async function analyzeWebsite() {
    if (!websiteUrl.trim() || analysisState === "loading") {
      return;
    }

    setAnalysisState("loading");
    setAnalysisError(null);

    try {
      const response = await fetch("/api/website-analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "test-project-001",
          websiteUrl: websiteUrl.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as WebsiteAnalysisResponse | null;

      if (!response.ok || !data?.ok) {
        const message = data && !data.ok ? data.message : "Website analysis is unavailable.";
        throw new Error(message);
      }

      setAnalysisId(data.analysisId);
      setAnalyzedDomain(data.normalizedDomain);
      setCategoryLabel(data.analysis.category ?? "Productivity SaaS");
      setAnalysisState("ready");
    } catch (error) {
      setAnalysisId(null);
      setAnalysisState("failed");
      setAnalysisError(
        error instanceof Error ? error.message : "Could not analyze this website.",
      );
    }
  }

  async function generateCandidates() {
    if (!analysisId || status === "loading") {
      return;
    }

    requestToken.current += 1;
    setStatus("loading");
    setStatusError(null);
    setLazyLoadError(null);
    setReadinessWarning(null);
    setCandidates([]);
    setCandidateIds([]);
    setGenerationBatchId(null);
    generatedMoreBatchRef.current.clear();
    setHasMoreCandidates(false);
    setTotalCandidates(0);
    setActiveCandidateIndex(0);
    setActiveSlideByCandidateId({});

    try {
      const response = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          candidateCount,
          format,
          goal,
          projectId: "test-project-001",
          slideCount,
          textStyle,
        }),
      });
      const data = (await response.json().catch(() => null)) as GenerateResponse | null;

      if (!response.ok || !data?.ok) {
        const message = data && !data.ok ? data.message : "Carousel version generation could not start.";
        throw new Error(message);
      }

      setCandidateIds(data.candidateIds);
      setCandidateCount(data.candidateCount);
      setTotalCandidates(data.candidateCount);
      setCategoryLabel(titleCaseSlug(data.categorySlug));
      setGenerationBatchId(data.generationBatchId);
      setReadinessWarning(data.readinessWarnings?.[0]?.message ?? null);
      replaceCarouselUrl(data.generationBatchId);
      await loadCandidatesUntilTerminal({
        carouselIds: data.candidateIds,
        generationBatchId: data.generationBatchId,
      });
    } catch (error) {
      setStatusError(
        getFriendlyCarouselError(
          error instanceof Error ? error.message : "Could not generate versions.",
        ),
      );
      setStatus("failed");
    }
  }

  useEffect(() => {
    if (status !== "completed" || !generationBatchId || candidates.length < CANDIDATE_PAGE_SIZE) {
      return;
    }

    const isNearLoadedEnd = activeCandidateIndex >= candidates.length - 3;

    if (isNearLoadedEnd) {
      const timer = window.setTimeout(() => {
        void ensureMoreCandidates();
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
    // The effect intentionally observes user position; navigation handlers stay local-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCandidateIndex, candidates.length, generationBatchId, status]);

  const activeCandidate = candidates[activeCandidateIndex] ?? candidates[0];
  const statusLabel =
    status === "completed"
      ? `${candidates.length} ready`
      : status === "loading"
        ? "Rendering versions"
        : status === "failed"
          ? "Needs attention"
          : "Ready to create";

  return (
    <section className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#f7f5f2]">
      <header className="border-b border-[#e8e1d9] bg-white px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Creative workspace</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Carousel Ads</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#5e7185] sm:text-base">
              Generate complete carousel versions, compare their angles, and review every slide.
            </p>
          </div>
          <span
            className={`inline-flex h-9 w-fit items-center gap-2 rounded-full border px-3.5 text-xs font-bold ${
              status === "completed"
                ? "border-[#bce6d0] bg-[#effaf4] text-[#16764a]"
                : status === "failed"
                  ? "border-[#f4c7c2] bg-[#fff5f4] text-error"
                  : "border-[#eadfd6] bg-[#fffaf7] text-[#52677d]"
            }`}
          >
            {status === "completed" ? (
              <CheckCircle2 className="size-4" />
            ) : status === "failed" ? (
              <CircleAlert className="size-4" />
            ) : status === "loading" ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <span className="size-2 rounded-full bg-primary" />
            )}
            {statusLabel}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <CarouselSetupPanel
          analyzedDomain={analyzedDomain}
          analysisState={analysisState}
          analysisError={analysisError}
          canGenerate={Boolean(analysisId)}
          candidateCount={candidateCount}
          categoryLabel={categoryLabel}
          format={format}
          generationStatus={status}
          goal={goal}
          slideCount={slideCount}
          textStyle={textStyle}
          websiteUrl={websiteUrl}
          onAnalyze={() => void analyzeWebsite()}
          onCandidateCountChange={setCandidateCount}
          onFormatChange={setFormat}
          onGenerate={() => void generateCandidates()}
          onGoalChange={setGoal}
          onSlideCountChange={setSlideCount}
          onTextStyleChange={setTextStyle}
          onWebsiteUrlChange={(value) => {
            setWebsiteUrl(value);
            if (analysisState !== "loading") {
              setAnalysisState("idle");
              setAnalysisId(null);
              setAnalyzedDomain(null);
              setCategoryLabel("Analyze a website first");
              setReadinessWarning(null);
            }
          }}
        />

        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {readinessWarning ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f0d9b5] bg-[#fff8ed] px-3.5 py-3 text-sm font-semibold leading-5 text-[#7a4e12]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{readinessWarning}</span>
            </div>
          ) : null}

          <CarouselPreviewCanvas
            activeCandidateIndex={activeCandidateIndex}
            activeSlideByCandidateId={activeSlideByCandidateId}
            candidates={candidates}
            errorMessage={statusError}
            expectedCandidateCount={candidateCount}
            isLoadingMore={isLoadingMoreCandidates}
            lazyLoadError={lazyLoadError}
            status={status}
            totalCandidates={totalCandidates}
            onActiveCandidateChange={setActiveCandidateIndex}
            onActiveSlideChange={(candidateId, slideIndex) => {
              setActiveSlideByCandidateId((current) => ({
                ...current,
                [candidateId]: slideIndex,
              }));
            }}
          />

          {status === "completed" && activeCandidate ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-sm font-semibold text-[#5e7185]">
              <span>
                {categoryLabel} <span className="px-1 text-[#c5bbb2]">/</span> {candidates.length} versions <span className="px-1 text-[#c5bbb2]">/</span> {activeCandidate.slides.length} slides each
              </span>
              <button
                type="button"
                disabled
                className="h-10 rounded-lg border border-[#ded6ce] bg-white px-4 text-sm font-bold text-[#304963] disabled:cursor-not-allowed disabled:opacity-55"
                title="Export workflow will be connected in the next slice"
              >
                Use version {activeCandidate.candidateIndex + 1}
              </button>
            </div>
          ) : null}

          {candidateIds.length ? (
            <span className="sr-only">Loaded {candidateIds.length} carousel versions</span>
          ) : null}
          {generationBatchId ? (
            <span className="sr-only">Generation batch {generationBatchId}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
