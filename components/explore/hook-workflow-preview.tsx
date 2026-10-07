"use client";

import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { HookWorkflowComposer } from "@/components/explore/hook-workflow-composer";
import { WorkflowCompositionPanel } from "@/components/explore/workflow-composition-panel";
import { WorkflowCreationPanel, type WorkflowSection } from "@/components/explore/workflow-creation-panel";
import { WorkflowEditWorkspace, WorkflowScheduleWorkspace } from "@/components/explore/workflow-edit-workspace";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { selectWorkflowAccount, workflowSelectedAccounts, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { WorkflowPreviewCanvas } from "@/components/explore/workflow-preview-canvas";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { useWorkflowGenerationSettings } from "@/components/explore/use-workflow-generation-settings";
import { WorkflowAccountBoundary, WorkflowGenerationBoundary } from "@/components/explore/workflow-generation-boundary";
import { WorkflowFinishingBoundary } from "@/components/explore/workflow-finishing-boundary";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import { cn } from "@/lib/utils";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import type { ExploreBackgroundPlayback } from "@/worker/src/lib/explore-background-audio";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";

export function HookWorkflowPreview({ initialDuration = 5, initialModel, generationEnabled = false, demoFramingEnabled = false }: { initialDuration?: number; initialModel?: AIStudioVideoModel; generationEnabled?: boolean; demoFramingEnabled?: boolean }) {
  return <WorkflowAccountBoundary enabled={generationEnabled}>{(ownerId) => <HookWorkflowLayout key={ownerId ?? "preview"} ownerId={ownerId} initialDuration={initialDuration} initialModel={initialModel} generationEnabled={generationEnabled} demoFramingEnabled={demoFramingEnabled} />}</WorkflowAccountBoundary>;
}

function HookWorkflowLayout({ initialDuration, initialModel, generationEnabled, ownerId, demoFramingEnabled }: { initialDuration: number; initialModel?: AIStudioVideoModel; generationEnabled: boolean; ownerId: string | null; demoFramingEnabled: boolean }) {
  const [section, setSection] = useState<WorkflowSection>("create");
  const [scheduleDraft, setScheduleDraft] = useState(EMPTY_SCHEDULE_DRAFT);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const selection = useWorkflowSourceVideo({ enabled: generationEnabled, ownerId });
  const [audioMode, setAudioMode] = useState<"voice" | "recording">("voice");
  const [instructions, setInstructions] = useState("");
  const generation = useWorkflowGenerationSettings(initialDuration, initialModel);
  const creator = useLocalWorkflowMedia("image");
  const videoReference = useLocalWorkflowMedia("video");
  const hookAudio = useLocalWorkflowMedia("audio");
  const demo = useLocalWorkflowMedia("video");
  const demoAudio = useLocalWorkflowMedia("audio");
  const [demoAudioPlayback, setDemoAudioPlayback] = useState<ExploreBackgroundPlayback>("once");
  const [demoFraming, setDemoFraming] = useState<{ frame: DemoFraming; aspect: number } | null>(null);
  const dirty = Boolean(selection.dirty || generation.dirty || instructions.length || creator.asset || videoReference.asset || hookAudio.asset || demo.asset || demoAudio.asset || Object.values(scheduleDraft).some(Boolean));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeSection(value: string) {
    if (value !== "create" && value !== "edit" && value !== "schedule") return;
    workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause());
    setSection(value);
    window.requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLButtonElement>('[role="tab"][data-active]')?.focus());
  }

  function removeDemo() {
    setDemoFraming(null);
    demoAudio.remove();
    demo.remove();
    setDemoAudioPlayback("once");
  }

  async function chooseDemo(file: File) {
    const accepted = await demo.choose(file);
    if (accepted) { demoAudio.remove(); setDemoAudioPlayback("once"); setDemoFraming(null); }
    return accepted;
  }

  async function chooseDemoAudio(file: File) {
    const accepted = await demoAudio.choose(file);
    if (accepted) setDemoAudioPlayback("once");
    return accepted;
  }

  function removeDemoAudio() {
    demoAudio.remove();
    setDemoAudioPlayback("once");
  }

  return <WorkflowGenerationBoundary enabled={generationEnabled} ownerId={ownerId} draft={{ kind: "hook", instructions, settings: generation.settings, creator: creator.asset, videoReference: videoReference.asset, audioReference: hookAudio.asset, referencesPending: creator.loading || videoReference.loading || hookAudio.loading }}>{(run) => {
    const source = selection.mode === "generate" ? run?.selected ?? null : selection.source;
    const sourcePreview = selection.mode === "generate" ? source ? { name: source.title, url: source.url, duration: source.durationSeconds } : null : selection.preview;
    const outputAspect = source?.width && source.height ? source.width / source.height : generation.settings.aspectRatio === "16:9" ? 16 / 9 : 9 / 16;
    const framingError = demoFramingEnabled && demoFraming && Math.abs(demoFraming.aspect / outputAspect - 1) > .015 ? "Video shape changed. Record framing again for this shape, or reset it." : null;
    const currentFraming = demoFramingEnabled && !framingError ? demoFraming?.frame ?? null : null;
    return <WorkflowFinishingBoundary enabled={generationEnabled} ownerId={ownerId} kind="hook" source={source} demo={demo.asset} demoAudio={demoAudio.asset} playback={demoAudioPlayback} scheduleDraft={scheduleDraft} demoFraming={currentFraming} demoFramingError={framingError}>{(finish) => <section className={cn(studio.studio, creation.shell, "min-w-0")}>
    {/* The Library follows the complete first-screen workspace, never its initial viewport. */}
    <div data-hook-first-screen className="flex min-h-[calc(100dvh-4rem)] flex-col md:min-h-dvh">
      <header className={cn(creation.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8")}>
        <Link href={generationEnabled ? "/explore" : "/explore?preview=1"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && dirty && !window.confirm("Leave this workflow? Your local changes are not saved.")) event.preventDefault();
        }}><ArrowLeft className="size-4" aria-hidden="true" /></Link>
        <span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span>
        <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">Create a Hook</h1></div>
      </header>

      <Tabs.Root ref={workspaceRef} value={section} className={creation.layout} onValueChange={changeSection}>
        <WorkflowCreationPanel kind="hook" section={section} generation={selection.mode === "generate" ? run ?? undefined : undefined} create={selection.mode === "generate" ? undefined : { disabled: !selection.ready, busy: selection.busy, message: selection.ready ? "Your selected video is ready. Continue to add optional edits." : "Upload or choose a video to continue. Up to 120 seconds.", onAction: () => changeSection("edit") }} edit={generationEnabled ? finish.edit : undefined} schedule={generationEnabled ? finish.schedule : undefined}>
          <Tabs.Panel value="create" keepMounted className={creation.sectionPanel}>
            <WorkflowVideoSourceSection kind="hook" selection={selection} />
            <div className={creation.generationFields} hidden={selection.mode !== "generate"}>
            <HookWorkflowComposer ownerId={ownerId} instructions={instructions} onInstructionsChange={setInstructions} creator={creator} videoReference={videoReference} generationSettings={generation.settings} onGenerationSettingsChange={generation.changeSettings} audioLabel="Hook audio" audio={hookAudio} audioMode={audioMode} onAudioModeChange={setAudioMode} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="edit" keepMounted className={creation.sectionPanel}>
            <WorkflowCompositionPanel videoLabel="Hook" connected={generationEnabled} ownerId={ownerId} options={finish.options} onOptionsChange={finish.setOptions}
              demoFramingEnabled={demoFramingEnabled} demoFraming={currentFraming} demoFramingError={framingError} onDemoFramingChange={frame => setDemoFraming(frame ? { frame, aspect: outputAspect } : null)} editingBusy={finish.edit?.busy}
              outputAspect={outputAspect} onDemoControlsOpen={() => workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause())}
              demo={{ ...demo, choose: chooseDemo, remove: removeDemo }} demoAudio={{ ...demoAudio, choose: chooseDemoAudio, remove: removeDemoAudio }} demoAudioPlayback={demoAudioPlayback} onDemoAudioPlaybackChange={setDemoAudioPlayback} />
          </Tabs.Panel>
          <Tabs.Panel value="schedule" keepMounted className={creation.sectionPanel}>
            <WorkflowSchedulingPanel draft={scheduleDraft} onChange={setScheduleDraft} accountsControl={<WorkflowConnectedAccounts enabled={generationEnabled} active={section === "schedule"} ownerId={ownerId} platforms={workflowSelectedPlatforms(scheduleDraft)} selectedIds={workflowSelectedAccounts(scheduleDraft)} onSelect={(platform, id) => setScheduleDraft(current => selectWorkflowAccount(current, platform, id))} />} />
          </Tabs.Panel>
        </WorkflowCreationPanel>
        <section aria-label="Hook creation workspace" className={creation.main}>
          {section === "create" ? <WorkflowPreviewCanvas kind="hook" generation={selection.mode === "generate" ? run ?? undefined : undefined} source={selection.preview} mode={selection.mode} onContinue={selection.ready ? () => changeSection("edit") : undefined} />
            : section === "edit" ? <WorkflowEditWorkspace kind="hook" demo={demo} demoAudio={demoAudio} generatedVideo={source} sourcePreview={sourcePreview} onChangeSource={() => changeSection("create")} finishedVideo={finish.output} demoFraming={currentFraming} />
            : <WorkflowScheduleWorkspace draft={scheduleDraft} finishedVideo={finish.output} />}
          <div className={creation.canvasFooter}>
            <a href="#hook-reference-library" aria-label="Scroll to Library" className={creation.libraryShortcut} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              const library = document.getElementById("hook-reference-library");
              if (!library) return;
              event.preventDefault();
              library.focus({ preventScroll: true });
              library.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
            }}>Library ↓</a>
          </div>
        </section>

      </Tabs.Root>
    </div>

    <LibrarySection />
  </section>}</WorkflowFinishingBoundary>;
  }}</WorkflowGenerationBoundary>;
}

function LibrarySection() {
  // No cover, videos or substitutes until approved media is supplied.
  return <section aria-label="Reference library" data-hook-library className="px-4 pt-10 pb-16 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[944px]">
      <div className="flex items-center gap-2.5"><BookOpen className="size-4 text-primary" aria-hidden="true" /><h2 id="hook-reference-library" tabIndex={-1} className="scroll-mt-6 rounded-lg text-lg font-semibold tracking-tight text-foreground-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">Library</h2></div>
      <p className="mt-2 text-xs leading-5 text-muted">Examples to explore when you want inspiration.</p>
      <p className="mt-6 text-sm text-muted">No videos yet.</p>
    </div>
  </section>;
}
