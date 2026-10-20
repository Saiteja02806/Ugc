"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PhoneWorkflowComposer, AppScreenPicker } from "@/components/explore/phone-workflow-composer";
import { WorkflowCompositionPanel } from "@/components/explore/workflow-composition-panel";
import { WorkflowCreationPanel, type WorkflowSection } from "@/components/explore/workflow-creation-panel";
import { WorkflowScheduleWorkspace } from "@/components/explore/workflow-edit-workspace";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { selectWorkflowAccount, workflowSelectedAccounts, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { WorkflowPreviewCanvas } from "@/components/explore/workflow-preview-canvas";
import { WorkflowSectionHeading, WorkflowSectionNavigation, useWorkflowSectionOrientation } from "@/components/explore/workflow-section-navigation";
import { useLocalAppScreen } from "@/components/explore/use-local-app-screen";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { useLocalWorkflowImages } from "@/components/explore/use-local-workflow-images";
import { useWorkflowGenerationSettings } from "@/components/explore/use-workflow-generation-settings";
import { WorkflowAccountBoundary, WorkflowGenerationBoundary } from "@/components/explore/workflow-generation-boundary";
import { WorkflowFinishingBoundary } from "@/components/explore/workflow-finishing-boundary";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import { cn } from "@/lib/utils";
import type { ExploreBackgroundPlayback } from "@/worker/src/lib/explore-background-audio";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";

export function PhoneWorkflowPreview({ generationEnabled = false, demoFramingEnabled = false }: { generationEnabled?: boolean; demoFramingEnabled?: boolean }) {
  return <WorkflowAccountBoundary enabled={generationEnabled}>{(ownerId) => <PhoneWorkflowLayout key={ownerId ?? "preview"} ownerId={ownerId} generationEnabled={generationEnabled} demoFramingEnabled={demoFramingEnabled} />}</WorkflowAccountBoundary>;
}

function PhoneWorkflowLayout({ generationEnabled, ownerId, demoFramingEnabled }: { generationEnabled: boolean; ownerId: string | null; demoFramingEnabled: boolean }) {
  const [section, setSection] = useState<WorkflowSection>("create");
  const [previewOpen, setPreviewOpen] = useState(false);
  const orientation = useWorkflowSectionOrientation();
  const [scheduleDraft, setScheduleDraft] = useState(EMPTY_SCHEDULE_DRAFT);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const selection = useWorkflowSourceVideo({ enabled: generationEnabled, ownerId });
  const [audioMode, setAudioMode] = useState<"voice" | "recording">("voice");
  const [instructions, setInstructions] = useState("");
  const generation = useWorkflowGenerationSettings();
  const appScreen = useLocalAppScreen();
  const videoReference = useLocalWorkflowMedia("video");
  const creatorAudio = useLocalWorkflowMedia("audio");
  const creator = useLocalWorkflowImages(Math.max(0, (generation.settings.model === "kling_3_0" ? 2 : 6) - Number(Boolean(appScreen.asset)) - Number(Boolean(videoReference.asset)) - Number(Boolean(creatorAudio.asset))));
  const demo = useLocalWorkflowMedia("video");
  const demoAudio = useLocalWorkflowMedia("audio");
  const [demoAudioPlayback, setDemoAudioPlayback] = useState<ExploreBackgroundPlayback>("once");
  const [demoFraming, setDemoFraming] = useState<{ frame: DemoFraming; aspect: number } | null>(null);
  const dirty = Boolean(selection.dirty || generation.dirty || instructions.length || appScreen.asset || creator.asset || videoReference.asset || creatorAudio.asset || demo.asset || demoAudio.asset || Object.values(scheduleDraft).some(Boolean));

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

  return <WorkflowGenerationBoundary enabled={generationEnabled} ownerId={ownerId} draft={{ kind: "phone", instructions, settings: generation.settings, creator: creator.asset, referenceImages: creator.assets, appScreen: appScreen.asset, videoReference: videoReference.asset, audioReference: creatorAudio.asset, referencesPending: creator.loading || appScreen.loading || videoReference.loading || creatorAudio.loading, referencesError: creator.error || appScreen.error || videoReference.error || creatorAudio.error || null }}>{(run) => {
    const source = selection.mode === "generate" ? run?.selected ?? null : selection.source;
    const sourcePreview = selection.mode === "generate" ? source ? { name: source.title, url: source.url, duration: source.durationSeconds } : null : selection.preview;
    const outputAspect = source?.width && source.height ? source.width / source.height : generation.settings.aspectRatio === "16:9" ? 16 / 9 : 9 / 16;
    const framingError = demoFramingEnabled && demoFraming && Math.abs(demoFraming.aspect / outputAspect - 1) > .015 ? "Video shape changed. Record framing again for this shape, or reset it." : null;
    const demoSelectionError = demo.loading || demoAudio.loading ? "Wait for your selected demo media to finish loading." : demo.error || demoAudio.error || null;
    const currentFraming = demoFramingEnabled && !framingError ? demoFraming?.frame ?? null : null;
    const createPreviewAvailable = selection.mode === "generate" ? Boolean(run?.results.length || run?.busy || run?.error) : Boolean(selection.preview);
    const previewVisible = section !== "create" || createPreviewAvailable || previewOpen;
    return <WorkflowFinishingBoundary enabled={generationEnabled} ownerId={ownerId} kind="phone" source={source} demo={demo.asset} demoAudio={demoAudio.asset} playback={demoAudioPlayback} scheduleDraft={scheduleDraft} demoFraming={currentFraming} demoFramingError={framingError ?? demoSelectionError}>{(finish) => <section className={cn(studio.studio, creation.shell, "min-w-0")}>
    {/* The Library follows the complete first-screen workspace, never its initial viewport. */}
    <Tabs.Root ref={workspaceRef} value={section} orientation={orientation} data-section={section} onValueChange={changeSection} data-phone-first-screen className={sections.workspace}>
      <header className={cn(creation.header, sections.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8")}>
        <Link href={generationEnabled ? "/explore" : "/explore?preview=1"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && dirty && !window.confirm("Leave this workflow? Your local changes are not saved.")) event.preventDefault();
        }}><ArrowLeft className="size-4" aria-hidden="true" /></Link>
        <span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span>
        <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">Creator Shows App on Phone</h1></div>
      </header>

      <div className={sections.layout}>
        <div className={sections.stage} data-preview-visible={previewVisible} data-focused-workflow data-stage={section} data-editing={false}>
        <WorkflowCreationPanel kind="phone" section={section} generation={selection.mode === "generate" ? run ?? undefined : undefined} create={selection.mode === "generate" ? undefined : { disabled: !selection.ready, busy: selection.busy, message: selection.ready ? "Your selected video is ready. Continue to add optional edits." : "Upload or choose a video to continue. Up to 120 seconds.", onAction: () => changeSection("edit") }} edit={generationEnabled ? finish.edit : undefined} schedule={generationEnabled ? finish.schedule : undefined}
          navigation={<WorkflowSectionNavigation presentation="panel" editLabel="Edit" />}
          heading={<WorkflowSectionHeading kind="phone" section={section} previewVisible={previewVisible} previewId="phone-workflow-preview" onTogglePreview={section === "create" && !createPreviewAvailable ? () => setPreviewOpen(current => !current) : undefined} />}>
          <Tabs.Panel value="create" keepMounted className={creation.sectionPanel}>
            <WorkflowVideoSourceSection kind="phone" selection={selection} />
            <div className={creation.generationFields} hidden={selection.mode !== "generate"}>
            <PhoneWorkflowComposer ownerId={ownerId} instructions={instructions} onInstructionsChange={setInstructions} creator={creator} imageReferences={creator} videoReference={videoReference} generationSettings={generation.settings} onGenerationSettingsChange={generation.changeSettings} appScreenControl={<AppScreenPicker attachment={appScreen} model={generation.settings.model} />} audioLabel="Creator audio" audio={creatorAudio} audioMode={audioMode} onAudioModeChange={setAudioMode} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="edit" keepMounted className={creation.sectionPanel}>
            <WorkflowCompositionPanel videoLabel="Phone video" connected={generationEnabled} ownerId={ownerId} options={finish.options} onOptionsChange={finish.setOptions} captions={finish.captions}
              demoFramingEnabled={demoFramingEnabled} demoFraming={currentFraming} demoFramingError={framingError} onDemoFramingChange={frame => setDemoFraming(frame ? { frame, aspect: outputAspect } : null)} editingBusy={finish.edit?.busy}
              outputAspect={outputAspect} onDemoControlsOpen={() => workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause())}
              demo={{ ...demo, choose: chooseDemo, remove: removeDemo }} demoAudio={{ ...demoAudio, choose: chooseDemoAudio, remove: removeDemoAudio }} demoAudioPlayback={demoAudioPlayback} onDemoAudioPlaybackChange={setDemoAudioPlayback} />
          </Tabs.Panel>
          <Tabs.Panel value="schedule" keepMounted className={creation.sectionPanel}>
            <WorkflowSchedulingPanel draft={scheduleDraft} onChange={setScheduleDraft} accountsControl={<WorkflowConnectedAccounts enabled={generationEnabled} active={section === "schedule"} ownerId={ownerId} platforms={workflowSelectedPlatforms(scheduleDraft)} selectedIds={workflowSelectedAccounts(scheduleDraft)} onSelect={(platform, id) => setScheduleDraft(current => selectWorkflowAccount(current, platform, id))} />} />
          </Tabs.Panel>
        </WorkflowCreationPanel>
        <section id="phone-workflow-preview" aria-label="Phone video creation workspace" className={cn(creation.main, sections.preview)} hidden={!previewVisible}>
          {section === "create" ? <WorkflowPreviewCanvas kind="phone" generation={selection.mode === "generate" ? run ?? undefined : undefined} source={selection.preview} mode={selection.mode} onContinue={selection.ready ? () => changeSection("edit") : undefined} />
            : section === "edit" ? <WorkflowScheduleWorkspace kind="phone" onChangeSource={() => changeSection("create")} editingPreview draft={scheduleDraft} source={source} sourcePreview={sourcePreview} demo={demo.asset} demoAudio={demoAudio.asset} demoAudioPlayback={demoAudioPlayback} demoFraming={currentFraming} rawDemoFraming={currentFraming} options={finish.options} captions={finish.captions.transcript} ownerId={ownerId} enabled={generationEnabled} previewDisabledReason={framingError ?? demoSelectionError} />
            : <WorkflowScheduleWorkspace kind="phone" draft={scheduleDraft} finishedVideo={finish.output} source={source} sourcePreview={sourcePreview} demo={demo.asset} demoAudio={demoAudio.asset} demoAudioPlayback={demoAudioPlayback} demoFraming={currentFraming} rawDemoFraming={currentFraming} options={finish.options} captions={finish.captions.transcript} ownerId={ownerId} enabled={generationEnabled} />}
          {section === "create" && selection.mode === "generate" && source ? <div className={cn(sections.nextStage, "mx-5 mb-5")}><Button type="button" onClick={() => changeSection("edit")}>Continue to edit</Button></div> : section === "edit" && finish.output ? <div className={cn(sections.nextStage, "mx-5 mb-5")}><Button type="button" onClick={() => changeSection("schedule")}>Continue to schedule</Button></div> : null}
          <div className={creation.canvasFooter}>
            <a href="#phone-reference-library" aria-label="Scroll to Library" className={creation.libraryShortcut} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              const library = document.getElementById("phone-reference-library");
              if (!library) return;
              event.preventDefault();
              library.focus({ preventScroll: true });
              library.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
            }}>Library ↓</a>
          </div>
        </section>
        </div>

      </div>
    </Tabs.Root>

    <PhoneLibrary />
  </section>}</WorkflowFinishingBoundary>;
  }}</WorkflowGenerationBoundary>;
}

function PhoneLibrary() {
  // No cover, videos or substitutes until approved media is supplied.
  return <section aria-label="Reference library" data-phone-library className="px-4 pt-10 pb-16 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[944px]">
      <div className="flex items-center gap-2.5"><BookOpen className="size-4 text-primary" aria-hidden="true" /><h2 id="phone-reference-library" tabIndex={-1} className="scroll-mt-6 rounded-lg text-lg font-semibold tracking-tight text-foreground-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">Library</h2></div>
      <p className="mt-2 text-xs leading-5 text-muted">Examples to explore when you want inspiration.</p>
      <p className="mt-6 text-sm text-muted">No videos yet.</p>
    </div>
  </section>;
}
