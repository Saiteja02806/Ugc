"use client";

import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Edit3,
  FileVideo,
  Home,
  ImageIcon,
  LoaderCircle,
  LogOut,
  PlaySquare,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  icon: typeof Home;
  key: string;
  label: string;
};

const primaryItems: SidebarItem[] = [
  { key: "trending", label: "Trending", href: "/dashboard", icon: Home },
  { key: "img-gen", label: "Image Gen", href: "/image-gen", icon: ImageIcon },
  { key: "video-gen", label: "Video Gen", href: "/video-gen", icon: PlaySquare },
  { key: "edit", label: "Edit", href: "/edit", icon: Edit3 },
  { key: "demos", label: "Demos", href: "/demos", icon: FileVideo },
  { key: "avatars", label: "Avatars", href: "/avatars", icon: UserRound },
  { key: "analytics", label: "Analytics", href: "/dashboard", icon: BarChart3 },
  {
    key: "scheduling",
    label: "Scheduling",
    href: "/scheduling",
    icon: CalendarDays,
  },
];

const secondaryItems: SidebarItem[] = [
  { key: "billing", label: "Billing", href: "/dashboard", icon: CreditCard },
  { key: "settings", label: "Settings", href: "/dashboard", icon: Settings },
];

export function AppSidebar({ activeKey = "trending" }: { activeKey?: string }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "UGC Studio user";
  const initials = getInitials(displayName);

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <aside className="flex w-full flex-col border-r border-border bg-[#fbf8f4] px-4 py-4 text-foreground sm:px-5 lg:min-h-screen lg:w-[260px] lg:shrink-0 lg:px-5 lg:py-6">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-foreground text-white shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <span className="text-xl font-bold tracking-normal text-foreground">
          UGC Studio
        </span>
      </Link>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-10 lg:grid lg:overflow-visible lg:pb-0">
        {primaryItems.map((item) => (
          <SidebarLink key={item.key} item={item} active={item.key === activeKey} />
        ))}
      </nav>

      <nav className="mt-7 hidden gap-2 border-t border-border pt-6 lg:grid">
        {secondaryItems.map((item) => (
          <SidebarLink key={item.key} item={item} active={false} />
        ))}
      </nav>

      <div className="mt-4 border-t border-border pt-4 lg:mt-auto lg:border-0 lg:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-sm font-bold text-white">
            {user?.photoURL ? (
              <Image
                src={user.photoURL}
                alt={`${displayName} profile photo`}
                width={40}
                height={40}
                className="size-10 object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
            <p className="truncate text-xs font-semibold text-muted">
              {user?.email || "Signed in with Google"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-white hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {signOutError ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-error">
            {signOutError}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function SidebarLink({ item, active }: { item: SidebarItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition lg:h-12 lg:gap-3 lg:px-4",
        active
          ? "bg-card-muted text-primary"
          : "text-[#334b68] hover:bg-white hover:text-foreground",
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-full bg-primary lg:block" />
      ) : null}
      <Icon className={cn("size-4", active ? "text-primary" : "text-[#173454]")} />
      <span>{item.label}</span>
    </Link>
  );
}
