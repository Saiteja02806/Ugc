"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useAuth } from "@/contexts/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-background px-5 text-foreground sm:px-8">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-foreground text-white shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <span>UGC Studio</span>
        </Link>

        <Link
          href="/"
          className="text-sm font-bold text-muted transition hover:text-foreground"
        >
          Back to home
        </Link>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center pb-12">
        <div className="w-full max-w-md rounded-[2rem] bg-white/85 p-8 shadow-[0_24px_80px_rgb(15_23_42_/_0.08)] ring-1 ring-black/5 backdrop-blur">
          <div className="mb-8 text-center">
            <p className="mb-3 text-sm font-bold text-primary">
              Welcome to UGC Studio
            </p>
            <h1 className="text-3xl font-bold tracking-normal text-foreground">
              Sign in to create AI UGC ads
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Use Google to access your workspace, saved brand context, and
              generated videos.
            </p>
          </div>

          <GoogleSignInButton />

          <p className="mt-6 text-center text-xs leading-5 text-[#98a2b3]">
            By continuing, you agree to use UGC Studio for your own SaaS
            creative workflow.
          </p>
        </div>
      </section>
    </main>
  );
}
