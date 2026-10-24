"use client";

import Image from "next/image";
import { Check, Plus, Smartphone } from "lucide-react";
import { useCallback, useRef, type ReactNode } from "react";

import { RemoveMediaButton } from "@/components/explore/hook-workflow-media-controls";
import { type useLocalAppScreen, type LocalAppScreen } from "@/components/explore/use-local-app-screen";
import { WorkflowCreationForm, type WorkflowCreationFormProps } from "@/components/explore/workflow-creation-form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { getVideoReferencePolicy } from "@/lib/ai-studio/video-reference-policy";

export type AppScreenAttachment = ReturnType<typeof useLocalAppScreen>;

export function PhoneWorkflowComposer(props: WorkflowCreationFormProps & { appScreenControl?: ReactNode }) {
  return <WorkflowCreationForm kind="phone" {...props} />;
}

export function AppScreenPicker({ attachment, model = "seedance_2_5" }: { attachment: AppScreenAttachment; model?: AIStudioVideoModel }) {
  const input = useRef<HTMLInputElement>(null);
  const referencePolicy = getVideoReferencePolicy(model);
  return <div className="inline-flex shrink-0 items-center rounded-lg bg-card-muted ring-1 ring-inset ring-border/50">
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" className="h-8 rounded-lg px-3 text-sm" aria-label="App screen" />}>
        <Smartphone className="size-3.5" aria-hidden="true" />App screen
        {attachment.asset ? <Check className="size-3 text-primary" aria-label="App screen attached" /> : <Plus className="size-3" aria-hidden="true" />}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
        <PopoverTitle>App screen</PopoverTitle>
        <p className="text-sm leading-5 text-muted">Attach an app screenshot or a reference screen recording. This is separate from an optional demo after the video.</p>
        {attachment.asset ? <><AppScreenMedia asset={attachment.asset} /><p className="break-all text-sm text-muted">{attachment.asset.name}</p></> : null}
        <input ref={input} type="file" accept="image/*,video/*" hidden aria-label="Upload app screen" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void attachment.choose(file, { maxDuration: referencePolicy.maxVideoDuration, maxBytes: file.type.startsWith("video/") ? referencePolicy.maxVideoBytes : referencePolicy.maxImageBytes });
          event.target.value = "";
        }} />
        <Button type="button" variant="outline" className="rounded-lg text-sm" disabled={attachment.loading} onClick={() => input.current?.click()}>
          <Plus className="size-3.5" aria-hidden="true" />{attachment.loading ? "Reading file…" : attachment.asset ? "Replace app screen" : "Attach app screen"}
        </Button>
        <p className="text-sm leading-5 text-muted">Screenshots up to 20 MB. Files upload when you Generate.</p>
        <p className="text-xs leading-5 text-muted">Screen recordings: WAN 3.0 up to 15 seconds and 32 MB · Seedance 2.5 up to 30 seconds and 250 MB. Choose one reference video here or in Choose video.</p>
        {attachment.error ? <p role="alert" className="text-sm text-destructive">{attachment.error}</p> : null}
      </PopoverContent>
    </Popover>
    {attachment.asset ? <RemoveMediaButton label="app screen" onClick={attachment.remove} /> : null}
  </div>;
}

function AppScreenMedia({ asset }: { asset: LocalAppScreen }) {
  const current = useRef<HTMLVideoElement | null>(null);
  const playerRef = useCallback((player: HTMLVideoElement | null) => {
    if (current.current && current.current !== player) {
      current.current.pause();
      current.current.removeAttribute("src");
      current.current.load();
    }
    current.current = player;
    if (player && player.getAttribute("src") !== asset.url) player.setAttribute("src", asset.url);
  }, [asset.url]);
  return asset.kind === "image"
    ? <Image key={asset.url} src={asset.url} alt="Attached app screen" width={300} height={300} unoptimized className="mx-auto h-auto max-h-56 w-auto max-w-full rounded-lg object-contain" />
    : <video key={asset.url} ref={playerRef} src={asset.url} controls playsInline preload="metadata" aria-label="App screen recording preview" className="mx-auto h-auto max-h-56 w-auto max-w-full rounded-lg object-contain" />;
}
