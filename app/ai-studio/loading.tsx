import { Skeleton } from "@/components/ui/skeleton";

export default function AIStudioLoading() {
  return (
    <section
      className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-hidden bg-background px-3 text-foreground sm:px-5 md:h-dvh lg:px-7"
      aria-label="Loading AI Studio"
      role="status"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[1560px] flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 py-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-80 max-w-[70vw]" />
          </div>
          <Skeleton className="h-10 w-44 rounded-xl" />
        </header>

        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-4 overflow-hidden px-1 pb-8 pt-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
