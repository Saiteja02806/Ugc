import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceContentLoading({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only" role="status">
        {label}
      </span>

      <div
        aria-hidden="true"
        className="mx-auto flex w-full max-w-[1360px] flex-col gap-7"
      >
        <header className="flex flex-col gap-3">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </header>

        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-[calc(var(--radius-card)-0.25rem)]" />
              <div className="mt-4 space-y-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
