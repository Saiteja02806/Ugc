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

export type AppScreenAttachment = ReturnType<typeof useLocalAppScreen>;

export function PhoneWorkflowComposer(props: WorkflowCreationFormProps & { appScreenControl?: ReactNode }) {
  return <WorkflowCreationForm kind="phone" {...props} />;
}

export function AppScreenPicker({ attachment }: { attachment: AppScreenAttachment }) {
  const input = useRef<HTMLInputElement>(null);
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
          if (file) void attachment.choose(file);
          event.target.value = "";
        }} />
        <Button type="button" variant="outline" className="rounded-lg text-sm" disabled={attachment.loading} onClick={() => input.current?.click()}>
          <Plus className="size-3.5" aria-hidden="true" />{attachment.loading ? "Reading file…" : attachment.asset ? "Replace app screen" : "Attach app screen"}
        </Button>
        <p className="text-sm leading-5 text-muted">Screenshots up to 20 MB · recordings up to 30 seconds and 250 MB. Files upload only when you Generate in the connected workflow.</p>
        <p className="text-xs leading-5 text-muted">Screen recordings require Seedance 2.5 through OpenRouter. Choose one reference video here or in Choose video, not both.</p>
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
