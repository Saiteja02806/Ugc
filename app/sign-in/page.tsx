"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { ProductLogoMark } from "@/components/brand/product-logo";
import { useAuth } from "@/contexts/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.emailVerified ? "/dashboard" : "/verify-email");
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-background px-5 text-foreground sm:px-8">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <ProductLogoMark className="h-8 w-12" sizes="52px" />
          <span>UGC Pilot</span>
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
              Welcome to UGC Pilot
            </p>
            <h1 className="text-3xl font-bold tracking-normal text-foreground">
              Sign in to create social videos
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Use Google or email to access your workspace, saved brand
              context, and generated videos.
            </p>
          </div>

          <GoogleSignInButton />
          <EmailAuthForm />

          <p className="mt-6 text-center text-xs leading-5 text-[#98a2b3]">
            By continuing, you agree to the{" "}
            <Link className="font-bold text-primary" href="/terms">
              Terms
            </Link>{" "}
            and{" "}
            <Link className="font-bold text-primary" href="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
