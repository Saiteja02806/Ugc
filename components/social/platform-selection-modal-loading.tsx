import { BlocksSpinner } from "@/components/ui/blocks-spinner";

export function PlatformSelectionModalLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      aria-live="polite"
      role="status"
    >
      <div className="flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground shadow-card">
        <BlocksSpinner className="size-5 text-foreground" />
        Opening scheduling…
      </div>
    </div>
  );
}
