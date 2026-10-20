import { Check, CircleAlert, Loader2 } from "lucide-react";
import { getCarouselEditRenderStatus } from "@/lib/trending/carousel-edit-render-status";
import type { TrendingCreativeEditRecord } from "@/lib/trending/creative-edit-contract";
import { cn } from "@/lib/utils";

export function CarouselEditRenderStatus({ edit, active }: {
  edit: Pick<TrendingCreativeEditRecord, "renderState" | "renderError" | "refreshError"> | null;
  active: boolean;
}) {
  const status = getCarouselEditRenderStatus(edit);
  if (!status) return null;
  return <>
    <div
      data-carousel-edit-state={edit?.renderState}
      data-trending-edited-badge={status.tone === "ready" ? "" : undefined}
      role={active ? "status" : undefined}
      aria-live={active ? "polite" : "off"}
      aria-atomic="true"
      className={cn("pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border bg-card/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        status.tone === "ready" ? "border-emerald-500/35 text-emerald-500" :
        status.tone === "pending" ? "border-amber-500/35 text-amber-500" : "border-red-500/35 text-red-500")}
    >
      {status.tone === "ready" ? <Check className="size-2.5 stroke-[3]" aria-hidden="true" /> :
        status.tone === "pending" ? <Loader2 className="size-2.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> :
        <CircleAlert className="size-2.5" aria-hidden="true" />}
      <span>{status.label}</span>
    </div>
    {status.message ? <div
      data-carousel-edit-error
      role={active ? "alert" : undefined}
      className={cn("pointer-events-none absolute inset-x-3 bottom-14 z-30 rounded-lg border bg-card/95 px-3 py-2 text-center text-xs leading-4 text-foreground",
        status.tone === "pending" ? "border-amber-500/30" : "border-red-500/30")}
    >{status.message}</div> : null}
  </>;
}
