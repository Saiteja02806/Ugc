"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useCallback, useRef, type ReactNode } from "react";

import { useLocalWorkflowMedia, type LocalMediaKind, type LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import studio from "@/components/explore/workflow-studio.module.css";
import { cn } from "@/lib/utils";

export type WorkflowAttachment = ReturnType<typeof useLocalWorkflowMedia>;

export function WorkflowFilePicker({ attachment, kind, label, icon, buttonLabel, className }: {
  attachment: WorkflowAttachment;
  kind: LocalMediaKind;
  label: string;
  icon?: ReactNode;
  buttonLabel?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <input ref={input} type="file" accept={`${kind}/*`} aria-label={label} hidden onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) void attachment.choose(file);
      event.target.value = "";
    }} />
    <Button type="button" variant="outline" aria-label={label} className={cn("rounded-full text-xs", className)} disabled={attachment.loading} onClick={() => input.current?.click()}>
      {icon}{attachment.loading ? "Reading file…" : buttonLabel ?? label}
    </Button>
  </>;
}

export function RemoveMediaButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Remove ${label}`} onClick={onClick}>
    <X className="size-3.5" aria-hidden="true" />
  </Button>;
}

/** Detach the player during the commit, before the owner's blob URL is released. */
export function WorkflowMediaPlayer({ asset, kind, label, className }: {
  asset: LocalWorkflowMedia;
  kind: "video" | "audio";
  label: string;
  className?: string;
}) {
  const current = useRef<HTMLMediaElement | null>(null);
  const playerRef = useCallback((player: HTMLMediaElement | null) => {
    if (current.current && current.current !== player) {
      current.current.pause();
      current.current.removeAttribute("src");
      current.current.load();
    }
    current.current = player;
    // Development Strict Mode replays refs on the same DOM node. Restore the
    // source after that detach, as well as when a closed panel mounts again.
    if (player && player.getAttribute("src") !== asset.url) player.setAttribute("src", asset.url);
  }, [asset.url]);

  return kind === "video"
    ? <video key={asset.url} ref={playerRef} src={asset.url} aria-label={label} controls playsInline preload="metadata" className={cn("aspect-video w-full rounded-2xl bg-black object-contain", className)} />
    : <audio key={asset.url} ref={playerRef} src={asset.url} aria-label={label} controls preload="metadata" className="h-9 w-full min-w-0" />;
}

export function ReferenceChip({ attachment, kind, label, icon }: {
  attachment: WorkflowAttachment;
  kind: LocalMediaKind;
  label: string;
  icon: ReactNode;
}) {
  const asset = attachment.asset;
  if (!asset) return null;
  return <div className="inline-flex max-w-52 shrink-0 items-center rounded-full bg-card-muted ring-1 ring-inset ring-border/60">
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" className="h-8 min-w-0 gap-1.5 rounded-full px-2.5 text-xs" aria-label={`Inspect ${label.toLowerCase()}`} title={asset.name} />}>
        {icon}<span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className={cn(studio.floating, "w-[min(20rem,calc(100vw-2rem))] rounded-[24px] border-border/60 p-4")}>
        <PopoverTitle>{label}</PopoverTitle>
        {kind === "image"
          ? <Image src={asset.url} alt="Selected creator" width={240} height={240} unoptimized className="max-h-56 w-full rounded-xl object-contain" />
          : <WorkflowMediaPlayer asset={asset} kind={kind} label={`${label} preview`} />}
        <p className="break-all text-xs text-muted">{asset.name}</p>
        <WorkflowFilePicker attachment={attachment} kind={kind} label={`Replace ${label.toLowerCase()}`} />
      </PopoverContent>
    </Popover>
    <RemoveMediaButton label={label.toLowerCase()} onClick={attachment.remove} />
  </div>;
}

export function formatMediaSeconds(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 10) / 10}s`;
}
