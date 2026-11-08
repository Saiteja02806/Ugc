"use client";

/* eslint-disable @next/next/no-img-element -- The public thumbnail helper handles optimisation; signed/private URLs must bypass /_next/image. */
import { AudioLines, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { imagePickerThumbnailUrl } from "@/lib/media/image-picker";
import styles from "@/components/explore/workflow-reference-preview.module.css";

/** A separate preview target keeps hovering from opening the image picker. */
export function WorkflowReferencePreview({ url, name, kind = "image", media, onRemove, disabled = false }: { url: string; name: string; kind?: "image" | "video" | "voice"; media?: ReactNode; onRemove?: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const thumbnail = imagePickerThumbnailUrl(url);
  const content = kind === "image" ? <img src={thumbnail} alt="" width={48} height={48} className={styles.thumbnailImage} /> : media ?? <AudioLines aria-hidden="true" />;
  return <div className={styles.selectedMedia}><Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger openOnHover delay={180} closeDelay={150}
      onFocus={() => setOpen(true)}
      onBlur={event => { if (!popup.current?.contains(event.relatedTarget)) setOpen(false); }}
      render={<Button type="button" variant="ghost" aria-label={`Preview ${kind} reference: ${name}`} className={styles.thumbnail} />}>
      <span className={styles.deck}>{content}</span>
    </PopoverTrigger>
    <PopoverContent ref={popup} initialFocus={false} side="right" align="start" sideOffset={8} className={styles.preview}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <PopoverTitle className="sr-only">{kind === "image" ? "Image reference" : kind === "video" ? "Video reference" : "Voice reference"}</PopoverTitle>
      {kind === "image" ? <img src={thumbnail} alt={`Selected image reference: ${name}`} width={160} height={160} className={styles.previewMedia} /> : <div className={styles.previewMedia} aria-label={`Selected ${kind} reference`} role="img">{content}</div>}
      {kind === "voice" ? <p className={styles.fileName}>{name}</p> : null}
    </PopoverContent>
  </Popover>
    {onRemove ? <Button type="button" variant="ghost" aria-label={`Remove ${kind} reference: ${name}`} title={`Remove ${kind} reference`} disabled={disabled} className={styles.remove}
      onClick={() => { if (disabled) return; setOpen(false); onRemove(); }}><X aria-hidden="true" /></Button> : null}
  </div>;
}
