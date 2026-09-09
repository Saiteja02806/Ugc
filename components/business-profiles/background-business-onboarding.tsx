"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { getBusinessProfileGateQueryKey } from "@/lib/business-profiles/profile-gate-query";
import { getOnboardingAnalysisLabel, isOnboardingJobFailed, type OnboardingAnalysisState, type OnboardingDraft, type OnboardingSession } from "@/lib/business-profiles/onboarding-draft-contract";
import type { PrimaryGoal } from "@/lib/business-profiles/schema";
import { BusinessProfileOnboarding as LegacyOnboarding, BusinessInformationStep, BusinessIdentityStep,
  PrimaryGoalStep, OnboardingFrame, uploadLogo, aiIdePrompt } from "./business-profile-onboarding";

const emptyManual = { businessName: "", brandTone: "", category: "", mainProblem: "", productSummary: "", targetAudience: "", valueProps: "" };
const endpoint = "/api/business-profile/onboarding";

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
  const unmounted = useRef(false);
  const submitted = !!draft?.submitted;
  const displayedName = identityDirty ? businessName : businessName || draft?.suggestedName || "";

  useEffect(() => {
    unmounted.current = false;
    return () => { unmounted.current = true; if (goalTimer.current) clearTimeout(goalTimer.current); };
  }, []);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  useEffect(() => {
    if (!draft?.completed) return;
    cache.setQueryData(getBusinessProfileGateQueryKey(userId), { onboardingComplete: true });
    router.replace("/dashboard");
    router.refresh();
  }, [draft?.completed, cache, router, userId]);
  useEffect(() => {
    if (!identityDirty && !logoFile && logoKey === (draft?.logoStorageKey ?? null) && JSON.stringify(primaryGoals) === JSON.stringify(draft?.primaryGoals ?? [])) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [identityDirty, logoFile, logoKey, draft?.logoStorageKey, primaryGoals, draft?.primaryGoals]);

  function move(next: 1 | 2 | 3) { setStep(next); setError(null); requestAnimationFrame(() => headingRef.current?.focus()); }
  function accept(result: OnboardingSession) { knownDraft.current = result.draft; cache.setQueryData(queryKey, result); }

  // Only our own acknowledged mutations advance the editing revision. A poll
  // from another tab must not authorize overwriting its newer answers.
  function mutate(action: string, values: Record<string, unknown> = {}) {
    const operation = saveChain.current.catch(() => undefined).then(async () => {
      if (unmounted.current) return null;
      await cache.cancelQueries({ queryKey });
      const current = knownDraft.current;
      const result = await requestSession(userId, { action, ...(current ? { draftId: current.id, revision: current.revision } : {}), ...values });
      await cache.cancelQueries({ queryKey });
      if (unmounted.current) return null;
      accept(result);
      return result.draft;
    });
    saveChain.current = operation;
    return operation;
  }

  async function run(action: () => Promise<void>) {
    if (savingRef.current) return;
    savingRef.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save your setup. Please try again."); }
    finally { savingRef.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
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
      if (!saved) return;
      setBusinessName(saved.businessName); setIdentityDirty(false); setPrimaryGoals(saved.primaryGoals); latestGoals.current = saved.primaryGoals;
      setLogoKey(saved.logoStorageKey); setLogoUrl(saved.logoUrl); setLogoFile(null); setLogoPreview(null);
      setIntakeType(saved.sourceInput.intakeType); setWebsiteUrl(saved.sourceInput.websiteUrl ?? "");
      setAiIdeContext(saved.sourceInput.aiIdeContext ?? ""); setManual({ ...emptyManual, ...saved.sourceInput.manual }); move(saved.step);
    });
  }

  const failedJob = draft && (draft.analysisReady ? draft.finalizationJob : draft.analysisJob);
  const failed = !!failedJob && isOnboardingJobFailed(failedJob);
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
      <Button className="mt-5" variant="outline" disabled={busy} onClick={() => void run(async () => { await mutate("edit"); })}>Edit my answers</Button>
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

export function OnboardingAnalysisStatus({ draft, unavailable = false }: { draft: OnboardingAnalysisState; unavailable?: boolean }) {
  const failed = isOnboardingJobFailed(draft.analysisJob);
  const Icon = unavailable || failed && !draft.analysisReady ? AlertCircle : draft.analysisReady ? CheckCircle2 : LoaderCircle;
  const label = getOnboardingAnalysisLabel(draft, unavailable).replaceAll("website", draft.sourceInput.intakeType === "website" ? "website" : "business").replaceAll("Website", draft.sourceInput.intakeType === "website" ? "Website" : "Business");
  return <div className="sticky top-3 z-20 mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm" role="status" aria-live="polite" aria-atomic="true">
    <Icon className={`size-4 shrink-0 text-primary ${Icon === LoaderCircle ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
    <span>{label}</span>
  </div>;
}
