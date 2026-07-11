import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";

export default function AvatarEditorLoading() {
  return (
    <AppShell activeKey="avatars">
      <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto flex w-full max-w-[1560px] flex-1 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-white px-6 py-12 text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-card-muted">
              <Loader2
                className="size-5 animate-spin text-primary"
                aria-hidden="true"
              />
            </div>
            <p className="mt-4 text-base font-bold text-foreground">
              Loading avatar
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
