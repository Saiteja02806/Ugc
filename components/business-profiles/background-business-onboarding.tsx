"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Link2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { getBusinessProfileGateQueryKey } from "@/lib/business-profiles/profile-gate-query";
import { isStoreProductUrl, type StoreProductMetadata } from "@/lib/business-profiles/store-product-metadata";
import { getOnboardingAnalysisLabel, getStreamlinedSavedBusinessName, isOnboardingJobFailed, type OnboardingAnalysisState, type OnboardingDraft, type OnboardingSession } from "@/lib/business-profiles/onboarding-draft-contract";
import type { PrimaryGoal } from "@/lib/business-profiles/schema";
import { BusinessProfileOnboarding as LegacyOnboarding, BusinessInformationStep, BusinessIdentityStep,
  PrimaryGoalStep, OnboardingFrame, uploadLogo, aiIdePrompt } from "./business-profile-onboarding";

const emptyManual = { businessName: "", brandTone: "", category: "", mainProblem: "", productSummary: "", targetAudience: "", valueProps: "" };
const endpoint = "/api/business-profile/onboarding";
const streamlinedGoals: PrimaryGoal[] = ["brand_awareness"];

const animatedProductUrls = [
  "https://play.google.com/store/apps/details?id=com.todaywise.todaywise",
  "https://datafa.st/",
  "https://apps.apple.com/in/app/duolingo-language-chess/id570060128",
  "https://apps.apple.com/in/app/cal-ai-calorie-tracker/id6480417616",
  "https://play.google.com/store/apps/details?id=com.brainyscreenblocker",
  "https://reachfront.ai/",
] as const;

const contentSetupTimeline = [
  {
    label: "Understanding your brand",
    description: "Analyzing your brand, audience and style",
  },
  {
    label: "Building content strategy",
    description: "Defining formats, themes and content direction",
  },
  {
    label: "Creating automation",
    description: "Connecting your content generation workflow…",
  },
  {
    label: "Preparing first ideas",
    description: "Generating your initial content ideas…",
  },
] as const;

type ProductUrlDemoPhase = "typing" | "holding" | "deleting" | "empty";

async function requestSession(userId: string, payload?: Record<string, unknown>, signal?: AbortSignal): Promise<OnboardingSession> {
  const token = await getCurrentUserIdToken(userId);
  if (!token) throw new Error("Sign in to continue your business setup.");
  const response = await fetch(endpoint, { method: payload ? "POST" : "GET", signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || "Could not save your setup. Please try again.");
  return data;
}

export function BackgroundBusinessOnboarding() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["business-onboarding-session", user?.uid],
    enabled: !loading && !!user,
    queryFn: ({ signal }) => requestSession(user!.uid, undefined, signal),
    refetchInterval: query => query.state.data?.draft && !query.state.data.draft.completed ? 3000 : false,
    refetchOnWindowFocus: true,
  });
  if (!user || !query.data) return <OnboardingFrame><div className="rounded-2xl border border-border bg-card p-6" role="status">
    {query.isError ? <><p>We couldn’t load your saved setup.</p><Button className="mt-4" onClick={() => void query.refetch()}>Try again</Button></> : "Checking your business profile…"}
  </div></OnboardingFrame>;
  if (query.data.mode === "legacy") return <LegacyOnboarding />;
  return <DraftOnboarding key={user?.uid} session={query.data} statusUnavailable={query.isError} userId={user!.uid} />;
}

function DraftOnboarding({ session, statusUnavailable, userId }: { session: OnboardingSession; statusUnavailable: boolean; userId: string }) {
  const cache = useQueryClient();
  const router = useRouter();
  const draft = session.draft;
  const queryKey = ["business-onboarding-session", userId];
  const [step, setStep] = useState<1 | 2 | 3>(draft?.step ?? 1);
  const [intakeType, setIntakeType] = useState<OnboardingDraft["sourceInput"]["intakeType"]>(draft?.sourceInput.intakeType ?? "website");
  const [websiteUrl, setWebsiteUrl] = useState(draft?.sourceInput.websiteUrl ?? "");
  const [aiIdeContext, setAiIdeContext] = useState(draft?.sourceInput.aiIdeContext ?? "");
  const [manual, setManual] = useState({ ...emptyManual, ...draft?.sourceInput.manual });
  const [streamlinedScreen, setStreamlinedScreen] = useState<1 | 2>(draft ? 2 : 1);
  const [streamlinedSource, setStreamlinedSource] = useState<"manual" | "website">(
    draft?.sourceInput.intakeType === "manual" ? "manual" : "website",
  );
  const [streamlinedBusinessName, setStreamlinedBusinessName] = useState(
    draft?.sourceInput.businessName ?? "",
  );
  const [streamlinedDescription, setStreamlinedDescription] = useState(
    draft?.sourceInput.description ?? "",
  );
  const [businessName, setBusinessName] = useState(draft?.businessName ?? "");
  const [identityDirty, setIdentityDirty] = useState(false);
  const [primaryGoals, setPrimaryGoals] = useState<PrimaryGoal[]>(draft?.primaryGoals ?? []);
  const [logoKey, setLogoKey] = useState<string | null>(draft?.logoStorageKey ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(draft?.logoUrl ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const sourceRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const savingRef = useRef(false);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGoals = useRef(primaryGoals);
  const knownDraft = useRef(draft);
  const streamlinedCompletionAttempt = useRef<string | null>(null);
  const manualFallbackAttempt = useRef<string | null>(null);
  const unmounted = useRef(false);
  const submitted = !!draft?.submitted;
  const displayedName = identityDirty ? businessName : businessName || draft?.suggestedName || "";
  const isStreamlined = !draft || draft.sourceInput.experience === "streamlined";
  const streamlinedSavedName = draft ? getStreamlinedSavedBusinessName(draft) : "";
  const mutate = useCallback((action: string, values: Record<string, unknown> = {}) => {
    const operation = saveChain.current.catch(() => undefined).then(async () => {
      if (unmounted.current) return null;
      await cache.cancelQueries({ queryKey: ["business-onboarding-session", userId] });
      const current = knownDraft.current;
      const result = await requestSession(userId, { action, ...(current ? { draftId: current.id, revision: current.revision } : {}), ...values });
      await cache.cancelQueries({ queryKey: ["business-onboarding-session", userId] });
      if (unmounted.current) return null;
      knownDraft.current = result.draft;
      cache.setQueryData(["business-onboarding-session", userId], result);
      return result.draft;
    });
    saveChain.current = operation;
    return operation;
  }, [cache, userId]);

  useEffect(() => {
    unmounted.current = false;
    return () => { unmounted.current = true; if (goalTimer.current) clearTimeout(goalTimer.current); };
  }, []);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  useEffect(() => {
    if (!identityDirty && !logoFile && logoKey === (draft?.logoStorageKey ?? null) && JSON.stringify(primaryGoals) === JSON.stringify(draft?.primaryGoals ?? [])) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [identityDirty, logoFile, logoKey, draft?.logoStorageKey, primaryGoals, draft?.primaryGoals]);

  useEffect(() => {
    if (!draft || draft.sourceInput.intakeType !== "website") return;
    const analysisFailed = !draft.analysisReady && isOnboardingJobFailed(draft.analysisJob);
    const nameMissing = isStreamlined && draft.analysisReady && !streamlinedSavedName;
    if (!analysisFailed && !nameMissing) return;

    const attempt = `${draft.id}:${draft.sourceRevision}`;
    if (manualFallbackAttempt.current === attempt) return;
    const timer = window.setTimeout(() => {
      if (manualFallbackAttempt.current === attempt) return;
      manualFallbackAttempt.current = attempt;
      if (isStreamlined) {
        setStreamlinedSource("manual");
        setStreamlinedScreen(1);
        setError("Unable to analyze that URL. Try entering your product details manually.");
        return;
      }
      void (async () => {
        try {
          if (draft.submitted) await mutate("edit");
          if (unmounted.current) return;
          if (goalTimer.current) clearTimeout(goalTimer.current);
          setIntakeType("manual");
          setStep(1);
          setError("Unable to analyze that URL. Try entering your product details manually.");
        } catch (error) {
          if (!unmounted.current) setError(error instanceof Error ? error.message : "Could not open manual entry. Please try again.");
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft, isStreamlined, mutate, streamlinedSavedName]);

  function move(next: 1 | 2 | 3) { setStep(next); setError(null); requestAnimationFrame(() => headingRef.current?.focus()); }
  function accept(result: OnboardingSession) { knownDraft.current = result.draft; cache.setQueryData(queryKey, result); }

  // Only our own acknowledged mutations advance the editing revision. A poll
  // from another tab must not authorize overwriting its newer answers.
  const run = useCallback(async (action: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save your setup. Please try again."); }
    finally { savingRef.current = false; setBusy(false); }
  }, []);

  const finishStreamlinedSetup = useCallback(async () => {
    if (!streamlinedSavedName) return;
    await run(async () => {
      const savedIdentity = await mutate("identity", {
        businessName: streamlinedSavedName,
        logoStorageKey: null,
      });
      if (!savedIdentity) return;
      await mutate("submit", {
        primaryGoals: streamlinedGoals,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
    });
  }, [mutate, run, streamlinedSavedName]);

  useEffect(() => {
    if (!isStreamlined || !draft?.analysisReady || draft.submitted || draft.completed || isOnboardingJobFailed(draft.analysisJob)) return;
    if (!streamlinedSavedName) return;
    const attempt = `${draft.id}:${draft.sourceRevision}:${draft.revision}`;
    if (streamlinedCompletionAttempt.current === attempt) return;
    streamlinedCompletionAttempt.current = attempt;
    void finishStreamlinedSetup();
  }, [draft?.analysisJob, draft?.analysisReady, draft?.completed, draft?.id, draft?.revision, draft?.sourceRevision, draft?.submitted, finishStreamlinedSetup, isStreamlined, streamlinedSavedName]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (isStreamlined) {
        await saveChain.current.catch(() => undefined);
        const input = streamlinedSource === "website"
          ? { experience: "streamlined" as const, intakeType: "website" as const, websiteUrl }
          : {
              businessName: streamlinedBusinessName,
              description: streamlinedDescription,
              experience: "streamlined" as const,
              intakeType: "manual" as const,
            };
        const fingerprint = JSON.stringify(input);
        if (sourceRequest.current?.fingerprint !== fingerprint) sourceRequest.current = { fingerprint, key: crypto.randomUUID() };
        await cache.cancelQueries({ queryKey });
        const current = knownDraft.current;
        const result = await requestSession(userId, { action: "start", input, requestKey: sourceRequest.current.key, ...(current ? { revision: current.revision } : {}) });
        await cache.cancelQueries({ queryKey });
        if (unmounted.current) return;
        accept(result);
        setStreamlinedScreen(2);
        return;
      }

      if (step === 1) {
        if (goalTimer.current) clearTimeout(goalTimer.current);
        await saveChain.current.catch(() => undefined);
        const input = intakeType === "website" ? { intakeType, websiteUrl } : intakeType === "manual" ? { intakeType, manual } : { intakeType, aiIdeContext };
        const fingerprint = JSON.stringify(input);
        if (sourceRequest.current?.fingerprint !== fingerprint) sourceRequest.current = { fingerprint, key: crypto.randomUUID() };
        await cache.cancelQueries({ queryKey });
        const current = knownDraft.current;
        const result = await requestSession(userId, { action: "start", input, requestKey: sourceRequest.current.key, ...(current ? { revision: current.revision } : {}) });
        await cache.cancelQueries({ queryKey });
        if (unmounted.current) return;
        accept(result);
        if (intakeType === "manual" && !identityDirty && !businessName) setBusinessName(manual.businessName);
        move(2);
      } else if (step === 2) {
        const token = await getCurrentUserIdToken(userId);
        if (!token) throw new Error("Sign in to save your business details.");
        const key = logoFile ? await uploadLogo(logoFile, token) : logoKey;
        const saved = await mutate("identity", { businessName: displayedName, logoStorageKey: key });
        if (saved) {
          setBusinessName(saved.businessName); setIdentityDirty(false); setLogoKey(saved.logoStorageKey);
          setLogoUrl(saved.logoUrl); setLogoFile(null); setLogoPreview(null); move(3);
        }
      } else {
        if (goalTimer.current) clearTimeout(goalTimer.current);
        await mutate("submit", { primaryGoals: latestGoals.current, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
      }
    });
  }

  function toggleGoal(goal: PrimaryGoal) {
    const goals = latestGoals.current.includes(goal) ? latestGoals.current.filter(value => value !== goal) : [...latestGoals.current, goal];
    latestGoals.current = goals; setPrimaryGoals(goals);
    if (goalTimer.current) clearTimeout(goalTimer.current);
    goalTimer.current = setTimeout(() => {
      void mutate("goals", { primaryGoals: goals }).catch(err => setError(err instanceof Error ? err.message : "Your goals could not be saved yet."));
    }, 700);
  }

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
      setError("Choose a PNG, JPEG, or WebP logo smaller than 2 MB."); return;
    }
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); setError(null);
  }

  async function reloadSaved() {
    await run(async () => {
      if (goalTimer.current) clearTimeout(goalTimer.current);
      await saveChain.current.catch(() => undefined);
      await cache.cancelQueries({ queryKey });
      const result = await requestSession(userId);
      await cache.cancelQueries({ queryKey });
      if (unmounted.current) return;
      accept(result);
      const saved = result.draft;
      if (!saved) {
        setStreamlinedScreen(1);
        return;
      }
      if (isStreamlined) {
        setStreamlinedSource(saved.sourceInput.intakeType === "manual" ? "manual" : "website");
        setWebsiteUrl(saved.sourceInput.websiteUrl ?? "");
        setStreamlinedBusinessName(saved.sourceInput.businessName ?? "");
        setStreamlinedDescription(saved.sourceInput.description ?? "");
        setStreamlinedScreen(2);
        return;
      }
      setBusinessName(saved.businessName); setIdentityDirty(false); setPrimaryGoals(saved.primaryGoals); latestGoals.current = saved.primaryGoals;
      setLogoKey(saved.logoStorageKey); setLogoUrl(saved.logoUrl); setLogoFile(null); setLogoPreview(null);
      setIntakeType(saved.sourceInput.intakeType); setWebsiteUrl(saved.sourceInput.websiteUrl ?? "");
      setAiIdeContext(saved.sourceInput.aiIdeContext ?? ""); setManual({ ...emptyManual, ...saved.sourceInput.manual }); move(saved.step);
    });
  }

  const failedJob = draft && (draft.analysisReady ? draft.finalizationJob : draft.analysisJob);
  const failed = !!failedJob && isOnboardingJobFailed(failedJob);
  if (isStreamlined) {
    return <OnboardingFrame minimal>
      {streamlinedScreen === 1 ? <StreamlinedSourceStep
        businessName={streamlinedBusinessName}
        description={streamlinedDescription}
        error={error}
        isSaving={busy}
        source={streamlinedSource}
        websiteUrl={websiteUrl}
        onBusinessNameChange={(value) => { setStreamlinedBusinessName(value); setError(null); }}
        onDescriptionChange={(value) => { setStreamlinedDescription(value); setError(null); }}
        onSourceChange={(source) => { setStreamlinedSource(source); setError(null); }}
        onSubmit={submit}
        onWebsiteUrlChange={setWebsiteUrl}
      /> : draft ? <StreamlinedProgressStep
        draft={draft}
        error={error}
        isSaving={busy}
        statusUnavailable={statusUnavailable}
        onChangeSource={() => void run(async () => {
          if (submitted) await mutate("edit");
          setStreamlinedScreen(1);
        })}
        onContinue={() => {
          cache.setQueryData(getBusinessProfileGateQueryKey(userId), { onboardingComplete: true });
          router.replace("/dashboard");
          router.refresh();
        }}
        onRetry={failedJob?.error?.retryable ? () => void run(async () => {
          await cache.cancelQueries({ queryKey });
          const result = await requestSession(userId, { action: "retry", draftId: draft.id });
          await cache.cancelQueries({ queryKey });
          if (!unmounted.current) accept(result);
        }) : error && draft.analysisReady && !draft.submitted ? () => void finishStreamlinedSetup() : undefined}
      /> : null}
    </OnboardingFrame>;
  }

  return <OnboardingFrame compact={step !== 3}>
    {draft && <OnboardingAnalysisStatus draft={draft} unavailable={statusUnavailable} />}
    {failed && <div className="mb-4 flex flex-wrap gap-3">
      {failedJob?.error?.retryable && <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
        await cache.cancelQueries({ queryKey });
        const result = await requestSession(userId, { action: "retry", draftId: draft!.id });
        await cache.cancelQueries({ queryKey });
        if (!unmounted.current) cache.setQueryData(queryKey, result);
      })}>Retry setup</Button>}
      {!draft?.analysisReady && <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
        if (submitted) await mutate("edit"); setIntakeType("manual"); move(1);
      })}>Enter details manually</Button>}
    </div>}
    {submitted ? <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Your details are saved</h2>
      <p className="mt-2 text-sm text-muted" role="status">{failed ? "Your setup needs a retry. Your answers are still saved." : draft?.analysisReady ? "Finishing your setup. We'll open Trending when it's ready." : "We're finishing your business analysis. You can safely close this page and come back."}</p>
    </div> : <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-floating lg:overflow-visible">
      <div className="h-1.5 rounded-t-2xl bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]" aria-hidden="true" />
      {step === 1 && <BusinessInformationStep aiIdeContext={aiIdeContext} copied={copied} error={error} intakeType={intakeType} isSaving={busy}
        manual={manual} websiteUrl={websiteUrl} onAiIdeContextChange={setAiIdeContext} onIntakeTypeChange={setIntakeType} onManualChange={setManual} onWebsiteUrlChange={setWebsiteUrl}
        backgroundMode onCopyPrompt={() => { void navigator.clipboard.writeText(aiIdePrompt).then(() => setCopied(true)).catch(() => setError("Could not copy the prompt. Select and copy it manually.")); }} />}
      {step === 2 && <BusinessIdentityStep businessName={displayedName} error={error} headingRef={headingRef} isSaving={busy} logoPreviewUrl={logoPreview ?? logoUrl}
        profile={null} onBack={() => move(1)} onBusinessNameChange={value => { setBusinessName(value); setIdentityDirty(true); }} onLogoChange={chooseLogo}
        onRemoveLogo={() => { setLogoFile(null); setLogoPreview(null); setLogoUrl(null); setLogoKey(null); }} />}
      {step === 3 && <PrimaryGoalStep error={error} headingRef={headingRef} isSaving={busy} primaryGoals={primaryGoals} onBack={() => move(2)} onPrimaryGoalToggle={toggleGoal} />}
    </form>}
    {(error || statusUnavailable) && <div className="mt-4 text-sm"><p role="alert">{submitted ? error : null}</p><Button variant="outline" disabled={busy} onClick={() => void reloadSaved()}>Reload saved progress</Button></div>}
  </OnboardingFrame>;
}

export function StreamlinedSourceStep({
  businessName,
  description,
  error,
  isSaving,
  onBusinessNameChange,
  onDescriptionChange,
  onSourceChange,
  onSubmit,
  onWebsiteUrlChange,
  source,
  websiteUrl,
}: {
  businessName: string;
  description: string;
  error: string | null;
  isSaving: boolean;
  onBusinessNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSourceChange: (value: "manual" | "website") => void;
  onSubmit: (event: FormEvent) => void;
  onWebsiteUrlChange: (value: string) => void;
  source: "manual" | "website";
  websiteUrl: string;
}) {
  const isManual = source === "manual";
  const [isUrlDemoActive, setIsUrlDemoActive] = useState(() => !websiteUrl);
  const [urlDemoIndex, setUrlDemoIndex] = useState(0);
  const [urlDemoLength, setUrlDemoLength] = useState(0);
  const [urlDemoPhase, setUrlDemoPhase] = useState<ProductUrlDemoPhase>("typing");
  const urlDemoScrollRef = useRef<HTMLDivElement>(null);
  const demoUrl = animatedProductUrls[urlDemoIndex].slice(0, urlDemoLength);

  const stopUrlDemo = useCallback(() => {
    setIsUrlDemoActive(false);
    setUrlDemoLength(0);
  }, []);

  useEffect(() => {
    if (!isUrlDemoActive || isManual || websiteUrl) return;

    const targetUrl = animatedProductUrls[urlDemoIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (urlDemoPhase === "typing") {
      if (urlDemoLength < targetUrl.length) {
        timeout = setTimeout(() => setUrlDemoLength((length) => length + 1), 30);
      } else {
        timeout = setTimeout(() => setUrlDemoPhase("holding"), 0);
      }
    } else if (urlDemoPhase === "holding") {
      timeout = setTimeout(() => setUrlDemoPhase("deleting"), 900);
    } else if (urlDemoPhase === "deleting") {
      timeout = setTimeout(() => {
        if (urlDemoLength > 0) {
          setUrlDemoLength((length) => length - 1);
          return;
        }
        setUrlDemoPhase("empty");
      }, urlDemoLength > 0 ? 18 : 0);
    } else {
      timeout = setTimeout(() => {
        setUrlDemoIndex((index) => (index + 1) % animatedProductUrls.length);
        setUrlDemoPhase("typing");
      }, 320);
    }

    return () => clearTimeout(timeout);
  }, [isManual, isUrlDemoActive, urlDemoIndex, urlDemoLength, urlDemoPhase, websiteUrl]);

  useEffect(() => {
    const scrollContainer = urlDemoScrollRef.current;
    if (!isUrlDemoActive || !scrollContainer) return;
    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
  }, [demoUrl, isUrlDemoActive]);

  return (
    <section className="w-full max-w-[460px] text-center">
      <header>
        <h2 className="whitespace-nowrap text-[clamp(1.35rem,3vw,2.1rem)] font-bold leading-[1.12] tracking-[-0.045em] text-foreground-strong">
          Tell us about your product
        </h2>
        <p className="mx-auto mt-3 max-w-[400px] text-balance text-[clamp(1rem,1.7vw,1.2rem)] leading-snug tracking-[-0.02em] text-muted">
          {isManual ? "Share a few details and we’ll learn your brand, audience and style." : "Paste your link and we’ll learn your brand, audience and style."}
        </p>
      </header>

      <form className="mt-5" onSubmit={onSubmit}>
        {!isManual ? (
          <>
            <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-strong bg-card px-3.5 text-left transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Link2 className="size-4.5 shrink-0 text-muted" aria-hidden="true" />
              <div className="relative min-w-0 flex-1 self-stretch">
                {isUrlDemoActive && !websiteUrl ? (
                  <div
                    ref={urlDemoScrollRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-sm text-foreground"
                  >
                    <span>{demoUrl}</span>
                    <span className="ml-px inline-block h-[1.1em] w-px shrink-0 animate-pulse bg-foreground/90 motion-reduce:animate-none" />
                  </div>
                ) : null}
                <input
                  id="streamlined-website-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  required
                  disabled={isSaving}
                  value={websiteUrl}
                  onFocus={stopUrlDemo}
                  onChange={(event) => {
                    stopUrlDemo();
                    onWebsiteUrlChange(event.target.value);
                  }}
                  placeholder={isUrlDemoActive ? "" : "https://yourbusiness.com"}
                  aria-label="Product URL"
                  className="relative h-full min-w-0 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-subtle"
                />
              </div>
            </div>

          </>
        ) : (
          <div className="mt-1 space-y-4 text-left">
            <input
              id="streamlined-business-name"
              autoComplete="organization"
              required
              maxLength={120}
              disabled={isSaving}
              value={businessName}
              onChange={(event) => onBusinessNameChange(event.target.value)}
              placeholder="Your business or product name"
              aria-label="Business or product name"
              className="h-12 w-full rounded-xl border border-border-strong bg-card px-3.5 text-sm text-foreground outline-none placeholder:text-muted-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <textarea
              id="streamlined-business-description"
              required
              minLength={20}
              maxLength={4_000}
              disabled={isSaving}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Describe what it does and who it helps."
              aria-label="Product description"
              rows={4}
              className="w-full resize-y rounded-xl border border-border-strong bg-card px-3.5 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        )}

        {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" disabled={isSaving} className="mt-8 h-11 min-w-48 rounded-xl px-5 text-sm font-semibold">
          {isSaving ? <LoaderCircle data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {isSaving ? "Starting…" : "Continue"}
        </Button>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSourceChange(isManual ? "website" : "manual")}
          className="mt-5 block w-full text-[13px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isManual ? "Use a product URL" : "Enter manually"}
        </button>
      </form>
    </section>
  );
}

export function StreamlinedProgressStep({
  draft,
  error,
  isSaving,
  onChangeSource,
  onContinue,
  onRetry,
  statusUnavailable,
}: {
  draft: OnboardingDraft;
  error: string | null;
  isSaving: boolean;
  onChangeSource: () => void;
  onContinue?: () => void;
  onRetry?: () => void;
  statusUnavailable: boolean;
}) {
  const sourceIsWebsite = draft.sourceInput.intakeType === "website";
  const analysisFailed = isOnboardingJobFailed(draft.analysisJob);
  const finalizationFailed = isOnboardingJobFailed(draft.finalizationJob);
  const completed = draft.completed;
  const failed = analysisFailed || finalizationFailed || Boolean(error);
  const businessLabel = getStreamlinedBusinessLabel(draft.sourceInput, draft.suggestedName);
  const businessDomain = getStreamlinedBusinessDomain(draft.sourceInput);

  return (
    <section className="relative mx-auto w-full max-w-[500px] self-center px-5 py-4 sm:px-0">
      <header className="text-center">
        <h2 className="mx-auto max-w-[480px] text-balance text-[clamp(1.85rem,3.15vw,2.65rem)] font-medium leading-[1.06] tracking-[-0.045em] text-foreground-strong">
          <span className="block">Setting up your</span>
          <span className="mt-1 block">content engine for</span>
        </h2>

        <StreamlinedBusinessIdentity
          businessDomain={businessDomain}
          businessLabel={businessLabel}
          key={draft.sourceInput.websiteUrl ?? draft.sourceInput.businessName ?? "manual"}
          logoUrl={draft.logoUrl}
          sourceUrl={draft.sourceInput.websiteUrl}
        />
      </header>

      <StreamlinedSetupTimeline
        analysisReady={draft.analysisReady}
        analysisFailed={analysisFailed}
        completed={completed}
        error={error}
        finalizationFailed={finalizationFailed}
        onContinue={onContinue}
        sourceIsWebsite={sourceIsWebsite}
        statusUnavailable={statusUnavailable}
      />

      {failed ? (
        <div className="mt-8 flex flex-wrap gap-3">
          {onRetry ? <Button type="button" size="lg" disabled={isSaving} onClick={onRetry} className="h-11 rounded-xl px-5"><RotateCcw data-icon="inline-start" aria-hidden="true" />Retry setup</Button> : null}
          <Button type="button" variant="outline" size="lg" disabled={isSaving} onClick={onChangeSource} className="h-11 rounded-xl px-5">Use a different source</Button>
        </div>
      ) : null}

    </section>
  );
}

function StreamlinedBusinessIdentity({
  businessDomain,
  businessLabel,
  logoUrl,
  sourceUrl,
}: {
  businessDomain: string | null;
  businessLabel: string;
  logoUrl: string | null;
  sourceUrl: string | undefined;
}) {
  const [storedLogoFailed, setStoredLogoFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [storeIconFailed, setStoreIconFailed] = useState(false);
  const [storeProduct, setStoreProduct] = useState<StoreProductMetadata | null>(null);

  useEffect(() => {
    if (!isStoreProductUrl(sourceUrl)) return;

    const controller = new AbortController();
    void fetch(`/api/business-profile/store-metadata?sourceUrl=${encodeURIComponent(sourceUrl ?? "")}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json() as { ok?: boolean; product?: StoreProductMetadata | null };
        return payload.ok ? payload.product ?? null : null;
      })
      .then((product) => { if (!controller.signal.aborted) setStoreProduct(product); })
      .catch(() => { if (!controller.signal.aborted) setStoreProduct(null); });

    return () => controller.abort();
  }, [sourceUrl]);

  const isStoreSource = isStoreProductUrl(sourceUrl);
  const faviconUrl = businessDomain
    ? `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(businessDomain)}`
    : null;
  const displayedLabel = storeProduct?.name ?? businessLabel;
  const displayedDomain = storeProduct?.sourceLabel ?? businessDomain ?? "Your product details";
  const initial = displayedLabel.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto mt-5 flex min-h-12 w-fit max-w-full items-center justify-center gap-3 text-left">
      {logoUrl && !storedLogoFailed ? (
        // The uploaded brand asset can be served from a user-specific storage host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover"
          onError={() => setStoredLogoFailed(true)}
          src={logoUrl}
        />
      ) : storeProduct && !storeIconFailed ? (
        // Store artwork is returned only after validating a fixed Apple or Google source.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover"
          onError={() => setStoreIconFailed(true)}
          src={storeProduct.iconUrl}
        />
      ) : !isStoreSource && faviconUrl && !faviconFailed ? (
        <Image
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover"
          height={48}
          onError={() => setFaviconFailed(true)}
          sizes="48px"
          src={faviconUrl}
          width={48}
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-card text-[17px] font-medium text-foreground-strong ring-1 ring-border" aria-hidden="true">
          {initial}
        </span>
      )}
      <div>
        <p className="text-[clamp(1.2rem,2vw,1.55rem)] font-medium leading-none tracking-[-0.028em] text-foreground-strong">
          {displayedLabel}
        </p>
        <p className="mt-1.5 text-[13px] leading-none text-muted">
          {displayedDomain}
        </p>
      </div>
    </div>
  );
}

function StreamlinedSetupTimeline({
  analysisReady,
  analysisFailed,
  completed,
  error,
  finalizationFailed,
  onContinue,
  sourceIsWebsite,
  statusUnavailable,
}: {
  analysisReady: boolean;
  analysisFailed: boolean;
  completed: boolean;
  error: string | null;
  finalizationFailed: boolean;
  onContinue?: () => void;
  sourceIsWebsite: boolean;
  statusUnavailable: boolean;
}) {
  const failed = Boolean(error) || analysisFailed || finalizationFailed || statusUnavailable;
  const activeIndex = completed ? -1 : analysisReady ? 2 : 0;
  const failedIndex = analysisFailed ? 0 : 2;
  const firstStep = contentSetupTimeline[0];
  const steps = [
    {
      ...firstStep,
      label: sourceIsWebsite ? firstStep.label : "Understanding your product",
      description: sourceIsWebsite ? firstStep.description : "Reviewing the details you shared with us",
    },
    ...contentSetupTimeline.slice(1),
  ];

  return (
    <div className="mx-auto mt-8 w-full max-w-[410px] text-left sm:translate-x-8" role="status" aria-live="polite" aria-atomic="true">
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isComplete = completed || index < activeIndex;
          const isActive = index === activeIndex && !failed;
          const isFailed = failed && index === failedIndex;
          const isPending = !isComplete && !isActive && !isFailed;

          return (
            <li key={step.label} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0">
              {index < steps.length - 1 ? <span className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] border-l-2 border-dashed border-muted-subtle" aria-hidden="true" /> : null}
              <div className="relative z-10 flex size-9 items-center justify-center" aria-hidden="true">
                {isComplete ? (
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_color-mix(in_srgb,var(--primary)_22%,transparent)]">
                    <Check className="size-4 stroke-[3]" />
                  </span>
                ) : isActive ? (
                  <span className="flex size-9 items-center justify-center rounded-full border-[2px] border-muted-subtle border-t-primary border-r-primary animate-spin [animation-duration:1.1s] motion-reduce:animate-none">
                    <span className="size-4 rounded-full bg-background" />
                  </span>
                ) : isFailed ? (
                  <span className="flex size-9 items-center justify-center rounded-full border-2 border-destructive/50 bg-destructive/10 text-destructive">
                    <AlertCircle className="size-4" />
                  </span>
                ) : (
                  <span className="size-9 rounded-full border-[2px] border-muted-subtle" />
                )}
              </div>
              <div className={isPending ? "pt-0.5 opacity-55" : "pt-0.5"}>
                <p className={`text-[clamp(0.95rem,1.3vw,1.1rem)] font-medium leading-5 tracking-[-0.018em] ${isFailed ? "text-destructive" : "text-foreground-strong"}`}>
                  {isFailed ? error || "This step needs another try" : step.label}
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted">
                  {isFailed ? "Your saved details are safe. Retry when you are ready." : step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 flex flex-wrap items-center gap-3 text-left">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
            <Clock3 className="size-5" />
          </span>
          <p>
            <span className="block text-[15px] font-medium tracking-[-0.015em] text-foreground-strong">{completed ? "Your content system is ready." : "We’re building your content system."}</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-muted">{completed ? "Continue when you are ready to start creating." : "This usually takes less than a minute."}</span>
          </p>
        </div>
        {completed && onContinue ? (
          <Button type="button" size="lg" onClick={onContinue} className="h-10 min-w-28 rounded-lg px-4 text-sm">
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function getStreamlinedBusinessLabel(source: OnboardingDraft["sourceInput"] | undefined, suggestedName?: string | null) {
  const explicitName = source?.businessName?.trim() || suggestedName?.trim();
  if (explicitName) return explicitName;
  const websiteUrl = source?.websiteUrl;
  if (!websiteUrl) return "your business";
  if (isStoreProductUrl(websiteUrl)) return "your product";
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "your business";
  }
}

function getStreamlinedBusinessDomain(source: OnboardingDraft["sourceInput"] | undefined) {
  const websiteUrl = source?.websiteUrl;
  if (!websiteUrl) return null;
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

export function OnboardingAnalysisStatus({ draft, unavailable = false }: { draft: OnboardingAnalysisState; unavailable?: boolean }) {
  const failed = isOnboardingJobFailed(draft.analysisJob);
  const Icon = unavailable || failed && !draft.analysisReady ? AlertCircle : draft.analysisReady ? CheckCircle2 : LoaderCircle;
  const label = getOnboardingAnalysisLabel(draft, unavailable).replaceAll("website", draft.sourceInput.intakeType === "website" ? "website" : "business").replaceAll("Website", draft.sourceInput.intakeType === "website" ? "Website" : "Business");
  return <div className="sticky top-3 z-20 mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm" role="status" aria-live="polite" aria-atomic="true">
    <Icon className={`size-4 shrink-0 text-primary ${Icon === LoaderCircle ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
    <span>{label}</span>
  </div>;
}
