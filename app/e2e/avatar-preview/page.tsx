import { notFound } from "next/navigation";

import { listReadyAvatarAssets } from "@/lib/avatars/avatar-storage";

export const runtime = "nodejs";

export default async function AvatarPreviewE2EPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_EDIT_RENDER_E2E_AUTH !== "true"
  ) {
    notFound();
  }

  const avatars = await listReadyAvatarAssets();

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-primary">
            Local influencer preview
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">
            {avatars.length} influencer videos
          </h1>
          <p className="mt-2 text-sm font-medium text-muted">
            Dev-only unauthenticated preview for verifying uploaded influencer assets.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {avatars.map((avatar) => (
            <article
              key={avatar.id}
              className="rounded-3xl border border-border bg-card p-3 shadow-sm"
            >
              <div className="overflow-hidden rounded-2xl bg-[#102033]">
                <video
                  className="aspect-[9/16] w-full object-cover"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  src={avatar.source_video_url}
                />
              </div>
              <h2 className="mt-3 text-sm font-bold text-foreground">
                {avatar.name}
              </h2>
              <p className="mt-1 text-xs font-semibold text-muted">
                {avatar.ratio} · {avatar.duration_seconds ?? "unknown"}s
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
