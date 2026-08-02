"use client";

import { useEffect } from "react";
import Link from "next/link";

import "./globals.css";

const globalErrorThemeScript = `(() => {
  try {
    const savedTheme = window.localStorage.getItem("ugc-pilot-theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();`;

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong | UGC Pilot</title>
        <script
          id="ugc-pilot-global-error-theme"
          dangerouslySetInnerHTML={{ __html: globalErrorThemeScript }}
        />
      </head>
      <body className="instagram-theme flex min-h-dvh items-center justify-center bg-background px-5 py-12 font-sans text-foreground">
        <main className="w-full max-w-lg rounded-[var(--radius-modal)] border border-border bg-card p-7 text-center shadow-floating sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-error">
            UGC Pilot needs a refresh
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
            The application could not load.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted sm:text-base">
            Nothing was published. Retry the application, or return home and
            start again.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-control border border-border-strong bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              Back to home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
