"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { HookWorkflowComposer } from "@/components/explore/hook-workflow-composer";
import { WorkflowCompositionPanel } from "@/components/explore/workflow-composition-panel";
import { WorkflowCreationPanel, type WorkflowSection } from "@/components/explore/workflow-creation-panel";
import { WorkflowEditWorkspace, WorkflowScheduleWorkspace } from "@/components/explore/workflow-edit-workspace";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { selectWorkflowAccount, workflowSelectedAccounts, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { WorkflowPreviewCanvas } from "@/components/explore/workflow-preview-canvas";
import { WorkflowSectionHeading, WorkflowSectionNavigation, useWorkflowSectionOrientation } from "@/components/explore/workflow-section-navigation";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";
import { WorkflowNavigationButton } from "@/components/layout/workflow-navigation";
import scrollbars from "@/components/ui/quiet-scrollbar.module.css";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { useWorkflowGenerationSettings } from "@/components/explore/use-workflow-generation-settings";
import { WorkflowAccountBoundary, WorkflowGenerationBoundary } from "@/components/explore/workflow-generation-boundary";
import { WorkflowFinishingBoundary } from "@/components/explore/workflow-finishing-boundary";
import { TalkingHeadClipEditing } from "@/components/explore/talking-head-clip-editing";
import { TalkingHeadScheduleActions, TalkingHeadScheduleSummary } from "@/components/explore/talking-head-schedule-review";
import scheduleReview from "@/components/explore/workflow-schedule-review.module.css";
import scheduleLayout from "@/components/explore/talking-head-schedule-preview.module.css";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import { cn } from "@/lib/utils";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import type { ExploreBackgroundPlayback } from "@/worker/src/lib/explore-background-audio";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";

export function HookWorkflowPreview({ initialDuration = 5, initialModel, generationEnabled = false, demoFramingEnabled = false }: { initialDuration?: number; initialModel?: AIStudioVideoModel; generationEnabled?: boolean; demoFramingEnabled?: boolean }) {
  return <WorkflowAccountBoundary enabled={generationEnabled}>{(ownerId) => <HookWorkflowLayout key={ownerId ?? "preview"} ownerId={ownerId} initialDuration={initialDuration} initialModel={initialModel} generationEnabled={generationEnabled} demoFramingEnabled={demoFramingEnabled} />}</WorkflowAccountBoundary>;
}

function HookWorkflowLayout({ initialDuration, initialModel, generationEnabled, ownerId, demoFramingEnabled }: { initialDuration: number; initialModel?: AIStudioVideoModel; generationEnabled: boolean; ownerId: string | null; demoFramingEnabled: boolean }) {
  const [section, setSection] = useState<WorkflowSection>("create");
  const [previewOpen, setPreviewOpen] = useState(false);
  const orientation = useWorkflowSectionOrientation();
  const [scheduleDraft, setScheduleDraft] = useState(EMPTY_SCHEDULE_DRAFT);
  const [timezone, setTimezone] = useState<string>();
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
  const [clipsDirty, setClipsDirty] = useState(false);
  const markClipsDirty = useCallback(() => setClipsDirty(true), []);
  const dirty = Boolean(clipsDirty || selection.dirty || generation.dirty || instructions.length || creator.asset || videoReference.asset || hookAudio.asset || demo.asset || demoAudio.asset || Object.values(scheduleDraft).some(Boolean));

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeSection(value: string) {
    if (value !== "create" && value !== "edit" && value !== "schedule") return;
    if (value === section) return;
    workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause());
    setSection(value);
    window.requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      workspaceRef.current?.querySelectorAll<HTMLElement>('[data-workflow-section-content], #hook-workflow-preview').forEach(panel => { panel.scrollTop = 0; });
      workspaceRef.current?.querySelector<HTMLButtonElement>('[role="tab"][data-active]')?.focus({ preventScroll: true });
    });
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
    const createPreviewAvailable = selection.mode === "generate" ? Boolean(run?.results.length || run?.busy || run?.error) : Boolean(selection.preview);
    const previewVisible = section !== "create" || createPreviewAvailable || previewOpen;
    return <TalkingHeadClipEditing enabled={generationEnabled} ownerId={ownerId} source={source} sourcePreview={sourcePreview} demo={demo} demoFraming={currentFraming} active={section === "edit"} onDirty={markClipsDirty}>{(clips) =>
    <WorkflowFinishingBoundary enabled={generationEnabled} ownerId={ownerId} kind="hook" source={clips.source} demo={clips.demo} demoSource={clips.demoSource} demoAudio={demoAudio.asset} playback={demoAudioPlayback} scheduleDraft={scheduleDraft} demoFraming={clips.demoFraming} demoFramingError={framingError ?? clips.error} fastStatus>{(finish) => <section className={cn(studio.studio, creation.shell, "min-w-0")}>
    {/* The Library follows the complete first-screen workspace, never its initial viewport. */}
    <Tabs.Root ref={workspaceRef} value={section} orientation={orientation} data-section={section} onValueChange={changeSection} data-hook-first-screen className={cn(sections.workspace, scheduleLayout.shell, scrollbars.surface, scrollbars.page)}>
      <header className={cn(creation.header, sections.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8")}>
        <WorkflowNavigationButton />
        <Link href={generationEnabled ? "/explore" : "/explore?preview=1"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && dirty && !window.confirm("Leave this workflow? Your local changes are not saved.")) event.preventDefault();
        }}><ArrowLeft className="size-4" aria-hidden="true" /></Link>
        <span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span>
        <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">Talking Head + Demo</h1></div>
        <WorkflowSectionNavigation />
      </header>

      <div className={cn(sections.layout, scheduleLayout.layout)}>
        <div className={cn(sections.stage, scheduleLayout.stage)} data-preview-visible={previewVisible} data-focused-workflow data-stage={section} data-editing={clips.editing}>
        <WorkflowCreationPanel kind="hook" section={section} generation={selection.mode === "generate" ? run ?? undefined : undefined} create={selection.mode === "generate" ? undefined : { disabled: !selection.ready, busy: selection.busy, message: selection.ready ? "Your selected video is ready. Continue to add optional edits." : "Upload or choose a video to continue. Up to 120 seconds.", onAction: () => changeSection("edit") }} edit={generationEnabled ? finish.edit : undefined} schedule={generationEnabled ? finish.schedule : undefined}
          actionContent={section === "schedule" ? <></> : clips.editing ? clips.actions : undefined}
          heading={<WorkflowSectionHeading kind="hook" section={section} previewVisible={previewVisible} previewId="hook-workflow-preview" onTogglePreview={section === "create" && !createPreviewAvailable ? () => setPreviewOpen(current => !current) : undefined} />}>
          <Tabs.Panel value="create" keepMounted className={creation.sectionPanel}>
            <WorkflowVideoSourceSection kind="hook" presentation="focused" selection={selection} />
            <div className={creation.generationFields} hidden={selection.mode !== "generate"}>
            <HookWorkflowComposer ownerId={ownerId} instructions={instructions} onInstructionsChange={setInstructions} creator={creator} videoReference={videoReference} generationSettings={generation.settings} onGenerationSettingsChange={generation.changeSettings} audioLabel="Hook audio" audio={hookAudio} audioMode={audioMode} onAudioModeChange={setAudioMode} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="edit" keepMounted className={creation.sectionPanel}>
            {clips.controls}
            <div hidden={clips.editing}>
            <WorkflowCompositionPanel videoLabel="Talking head" connected={generationEnabled} ownerId={ownerId} options={finish.options} onOptionsChange={finish.setOptions}
              demoFramingEnabled={demoFramingEnabled} demoFraming={currentFraming} demoFramingError={framingError} onDemoFramingChange={frame => setDemoFraming(frame ? { frame, aspect: outputAspect } : null)} editingBusy={finish.edit?.busy}
              outputAspect={outputAspect} onDemoControlsOpen={() => workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause())}
              demo={{ ...demo, choose: chooseDemo, remove: removeDemo }} demoAudio={{ ...demoAudio, choose: chooseDemoAudio, remove: removeDemoAudio }} demoAudioPlayback={demoAudioPlayback} onDemoAudioPlaybackChange={setDemoAudioPlayback} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="schedule" keepMounted className={creation.sectionPanel}>
            <div className={scheduleReview.panel}>
            <WorkflowSchedulingPanel draft={scheduleDraft} onChange={setScheduleDraft} timezone={timezone} presentation="review" accountsControl={<WorkflowConnectedAccounts enabled={generationEnabled} active={section === "schedule"} ownerId={ownerId} platforms={workflowSelectedPlatforms(scheduleDraft)} selectedIds={workflowSelectedAccounts(scheduleDraft)} onSelect={(platform, id) => setScheduleDraft(current => selectWorkflowAccount(current, platform, id))} />} />
            <TalkingHeadScheduleSummary draft={scheduleDraft} timezone={timezone} />
            </div>
          </Tabs.Panel>
        </WorkflowCreationPanel>
        <section id="hook-workflow-preview" aria-label="Hook creation workspace" className={cn(creation.main, sections.preview)} hidden={!previewVisible}>
          {section === "create" ? <WorkflowPreviewCanvas kind="hook" generation={selection.mode === "generate" ? run ?? undefined : undefined} source={selection.preview} mode={selection.mode} onContinue={selection.ready ? () => changeSection("edit") : undefined} />
            : section === "edit" ? <>{clips.preview}<div hidden={clips.editing}><WorkflowEditWorkspace kind="hook" demo={demo} demoAudio={demoAudio} generatedVideo={clips.source} sourcePreview={clips.source ? { name: clips.source.title, url: clips.source.url, duration: clips.source.durationSeconds } : sourcePreview} onChangeSource={() => changeSection("create")} finishedVideo={finish.output} demoFraming={clips.demoFraming} demoPreview={clips.demoSource ? { name: clips.demoSource.title, url: clips.demoSource.url, duration: clips.demoSource.durationSeconds } : undefined} onEditSource={clips.openOpening} onEditDemo={clips.openDemo} editingBusy={finish.edit.busy || clips.busy} /></div></>
            : <WorkflowScheduleWorkspace draft={scheduleDraft} finishedVideo={finish.output} source={clips.source} sourcePreview={sourcePreview} demoSource={clips.demoSource} demo={demo.asset} demoAudio={demoAudio.asset} demoAudioPlayback={demoAudioPlayback} openingPreview={clips.openingPreview} demoPreview={clips.demoPreview} demoFraming={clips.demoFraming} rawDemoFraming={currentFraming} options={finish.options} ownerId={ownerId} enabled={generationEnabled} previewDisabledReason={framingError} active={section === "schedule"} />}
          {section === "create" && selection.mode === "generate" && source ? <div className={cn(sections.nextStage, "mx-5 mb-5")}><Button type="button" onClick={() => changeSection("edit")}>Continue to edit</Button></div> : section === "edit" && finish.output && !clips.editing ? <div className={cn(sections.nextStage, "mx-5 mb-5")}><Button type="button" onClick={() => changeSection("schedule")}>Continue to schedule</Button></div> : null}
          {section !== "schedule" ? <div className={creation.canvasFooter}>
            <a href="#hook-reference-library" aria-label="Scroll to Library" className={creation.libraryShortcut} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              const library = document.getElementById("hook-reference-library");
              if (!library) return;
              event.preventDefault();
              library.focus({ preventScroll: true });
              library.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
            }}>Library ↓</a>
          </div> : null}
        </section>
        </div>

      </div>
      {section === "schedule" ? <footer className={scheduleLayout.actions} aria-label="Schedule actions"><TalkingHeadScheduleActions action={finish.schedule} enabled={generationEnabled} onBackToEdit={() => changeSection("edit")} /></footer> : null}
    </Tabs.Root>

    <LibrarySection />
  </section>}</WorkflowFinishingBoundary>}</TalkingHeadClipEditing>;
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
