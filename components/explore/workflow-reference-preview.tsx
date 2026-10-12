"use client";

import Image from "next/image";
import { AudioLines } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import styles from "@/components/explore/workflow-reference-preview.module.css";

/** A separate preview target keeps hovering from opening the image picker. */
export function WorkflowReferencePreview({ url, name, kind = "image", media }: { url: string; name: string; kind?: "image" | "video" | "voice"; media?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const content = kind === "image" ? <Image src={url} alt="" width={48} height={48} unoptimized className={styles.thumbnailImage} /> : media ?? <AudioLines aria-hidden="true" />;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger openOnHover delay={180} closeDelay={150}
      onFocus={() => setOpen(true)}
      onBlur={event => { if (!popup.current?.contains(event.relatedTarget)) setOpen(false); }}
      render={<Button type="button" variant="ghost" aria-label={`Preview ${kind} reference: ${name}`} className={styles.thumbnail} />}>
      <span className={styles.deck}>{content}</span>
    </PopoverTrigger>
    <PopoverContent ref={popup} initialFocus={false} side="right" align="start" sideOffset={8} className={styles.preview}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <PopoverTitle className="sr-only">{kind === "image" ? "Image reference" : kind === "video" ? "Video reference" : "Voice reference"}</PopoverTitle>
      {kind === "image" ? <Image src={url} alt={`Selected image reference: ${name}`} width={160} height={160} unoptimized className={styles.previewMedia} /> : <div className={styles.previewMedia} aria-label={`Selected ${kind} reference`} role="img">{content}</div>}
      {kind === "voice" ? <p className={styles.fileName}>{name}</p> : null}
    </PopoverContent>
  </Popover>;
}
