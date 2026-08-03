import { ImageIcon, Video } from "lucide-react";

import { cn } from "@/lib/utils";

type PricingCreditSummaryProps = {
  amount: number;
  kind: "image" | "video";
};

export function PricingCreditSummary({
  amount,
  kind,
}: PricingCreditSummaryProps) {
  const isImage = kind === "image";
  const Icon = isImage ? ImageIcon : Video;

  return (
    <div className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-small",
          isImage
            ? "bg-brand-soft text-primary"
            : "bg-card-muted text-muted",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 text-sm font-semibold text-foreground-strong">
        {isImage ? "Image credits" : "Video credits"}
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums text-foreground-strong">
        {amount}
      </span>
    </div>
  );
}
