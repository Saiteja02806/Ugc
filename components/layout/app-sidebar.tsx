"use client";

import {
  LoaderCircle,
  LogOut,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  SidebarIcon,
  type SidebarIconName,
} from "@/components/icons/sidebar-icon";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export type AppSidebarActiveKey =
  | "trending"
  | "img-gen"
  | "video-gen"
  | "demos"
  | "avatars"
  | "edit"
  | "scheduling";

type SidebarItem = {
  href: string;
  icon: SidebarIconName;
  key: AppSidebarActiveKey;
  label: string;
};

const navigationItems: SidebarItem[] = [
  {
    key: "trending",
    label: "Trending",
    href: "/dashboard",
    icon: "trending",
  },
  {
    key: "img-gen",
    label: "Image Gen",
    href: "/image-gen",
    icon: "image-gen",
  },
  {
    key: "video-gen",
    label: "Video Gen",
    href: "/video-gen",
    icon: "video-gen",
  },
  {
    key: "demos",
    label: "Demos",
    href: "/demos",
    icon: "demos",
  },
  {
    key: "avatars",
    label: "Avatars",
    href: "/avatars",
    icon: "avatars",
  },
  {
    key: "edit",
    label: "Edit",
    href: "/edit",
    icon: "edit",
  },
  {
    key: "scheduling",
    label: "Scheduling",
    href: "/scheduling",
    icon: "scheduling",
  },
];

const SIDEBAR_STORAGE_KEY = "ugc-studio.sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "ugc-studio:sidebar-change";

export function AppSidebar({
  activeKey = "trending",
  defaultCollapsed = false,
}: {
  activeKey?: AppSidebarActiveKey;
  defaultCollapsed?: boolean;
}) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const mobileNavigationId = useId();
  const mobileNavigationRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    () => getSidebarPreference(defaultCollapsed),
    () => getServerSidebarPreference(defaultCollapsed),
  );
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "UGC Studio user";
  const initials = getInitials(displayName);

  useEffect(() => {
    if (!isMobileNavigationOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    mobileCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileNavigationOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = mobileNavigationRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isMobileNavigationOpen]);

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

  function toggleSidebar() {
    setSidebarPreference(!collapsed);
  }

  return (
    <>
      <header className="sticky top-0 z-[var(--z-sticky)] flex h-16 w-full items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setIsMobileNavigationOpen(true)}
          aria-controls={mobileNavigationId}
          aria-expanded={isMobileNavigationOpen}
          aria-label="Open navigation"
          title="Open navigation"
          className="inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      <aside
        id="ugc-desktop-sidebar"
        className={cn(
          "sticky top-0 z-[var(--z-sidebar)] hidden h-screen shrink-0 flex-col border-r border-border bg-white transition-[width] duration-200 motion-reduce:transition-none lg:flex",
          collapsed ? "w-[72px]" : "w-[232px]",
        )}
      >
        <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} />

        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed ? "justify-center px-3" : "px-4",
          )}
        >
          <Brand compact={collapsed} />
        </div>

        <SidebarNavigation activeKey={activeKey} collapsed={collapsed} />

        <AccountSection
          collapsed={collapsed}
          displayName={displayName}
          email={user?.email ?? "Signed in"}
          initials={initials}
          isSigningOut={isSigningOut}
          photoUrl={user?.photoURL ?? null}
          signOutError={signOutError}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      {isMobileNavigationOpen ? (
        <div className="fixed inset-0 z-[var(--z-modal)] lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={() => setIsMobileNavigationOpen(false)}
            className="absolute inset-0 cursor-default bg-black/35"
          />
          <aside
            ref={mobileNavigationRef}
            id={mobileNavigationId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${mobileNavigationId}-title`}
            className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col border-r border-border bg-white shadow-floating"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <div id={`${mobileNavigationId}-title`}>
                <Brand />
              </div>
              <button
                ref={mobileCloseButtonRef}
                type="button"
                onClick={() => setIsMobileNavigationOpen(false)}
                aria-label="Close navigation"
                title="Close navigation"
                className="inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <SidebarNavigation
              activeKey={activeKey}
              onNavigate={() => setIsMobileNavigationOpen(false)}
            />

            <AccountSection
              displayName={displayName}
              email={user?.email ?? "Signed in"}
              initials={initials}
              isSigningOut={isSigningOut}
              photoUrl={user?.photoURL ?? null}
              signOutError={signOutError}
              onSignOut={() => void handleSignOut()}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label={compact ? "UGC Studio home" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        compact && "justify-center",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-foreground-strong">
        <Sparkles className="size-[18px]" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="truncate text-base font-semibold text-foreground-strong">
          UGC Studio
        </span>
      ) : null}
    </Link>
  );
}

function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-controls="ugc-desktop-sidebar"
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className="absolute -right-3.5 top-[18px] z-20 inline-flex size-7 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#667085] shadow-[0_4px_12px_rgb(15_23_42_/_0.12)] transition hover:border-[#f15a24]/30 hover:bg-[#fff8f4] hover:text-[#f15a24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f15a24]/30 motion-reduce:transition-none"
    >
      <SidebarIcon
        name={collapsed ? "expand" : "collapse"}
        className="size-4"
      />
    </button>
  );
}

function SidebarNavigation({
  activeKey,
  collapsed = false,
  onNavigate,
}: {
  activeKey: AppSidebarActiveKey;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto py-4",
        collapsed ? "px-2" : "px-3",
      )}
    >
      <div className="space-y-1.5">
        {navigationItems.map((item) => (
          <SidebarLink
            key={item.key}
            active={item.key === activeKey}
            collapsed={collapsed}
            item={item}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

function SidebarLink({
  active,
  collapsed,
  item,
  onNavigate,
}: {
  active: boolean;
  collapsed: boolean;
  item: SidebarItem;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none",
        collapsed ? "justify-center px-0" : "gap-3 px-3.5",
        active
          ? "bg-[#fff0e7] text-[#c64518]"
          : "text-[#5f6672] hover:bg-[#f5f5f6] hover:text-[#17191c]",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute rounded-full bg-[#f15a24]",
            collapsed
              ? "left-0.5 top-1/2 h-5 w-[3px] -translate-y-1/2"
              : "bottom-2 left-0 top-2 w-[3px]",
          )}
        />
      ) : null}
      <SidebarIcon
        name={item.icon}
        className={cn(
          "size-5",
          active
            ? "text-[#f15a24]"
            : "text-[#667085] group-hover:text-[#17191c]",
        )}
      />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {collapsed ? (
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute left-full z-[var(--z-tooltip)] ml-3 whitespace-nowrap rounded-lg bg-[#17191c] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

function AccountSection({
  collapsed = false,
  displayName,
  email,
  initials,
  isSigningOut,
  onSignOut,
  photoUrl,
  signOutError,
}: {
  collapsed?: boolean;
  displayName: string;
  email: string;
  initials: string;
  isSigningOut: boolean;
  onSignOut: () => void;
  photoUrl: string | null;
  signOutError: string | null;
}) {
  return (
    <div
      className={cn(
        "mt-auto border-t border-[#eceff3]",
        collapsed ? "p-2.5" : "p-3",
      )}
    >
      <div
        className={cn(
          "flex items-center",
          collapsed ? "flex-col gap-2.5" : "gap-3",
        )}
      >
        <div className="group/avatar relative shrink-0">
          <UserAvatar
            displayName={displayName}
            initials={initials}
            photoUrl={photoUrl}
          />
          {collapsed ? (
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute left-full top-1/2 z-[var(--z-tooltip)] ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#17191c] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/avatar:visible group-hover/avatar:opacity-100 group-focus-within/avatar:visible group-focus-within/avatar:opacity-100 motion-reduce:transition-none"
            >
              {displayName}
            </span>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#17191c]">
              {displayName}
            </p>
            <p className="truncate text-xs font-medium text-[#667085]">
              {email}
            </p>
          </div>
        ) : null}
        <div className="group/signout relative shrink-0">
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#fff3ee] hover:text-[#b91c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
              collapsed ? "size-9" : "size-10",
            )}
          >
            {isSigningOut ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
          </button>
          {collapsed ? (
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute left-full top-1/2 z-[var(--z-tooltip)] ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#17191c] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/signout:visible group-hover/signout:opacity-100 group-focus-within/signout:visible group-focus-within/signout:opacity-100 motion-reduce:transition-none"
            >
              Sign out
            </span>
          ) : null}
        </div>
      </div>
      {signOutError && !collapsed ? (
        <p role="alert" className="mt-2 text-xs font-medium text-error">
          {signOutError}
        </p>
      ) : null}
    </div>
  );
}

function UserAvatar({
  displayName,
  initials,
  photoUrl,
}: {
  displayName: string;
  initials: string;
  photoUrl: string | null;
}) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground-strong text-xs font-semibold text-white">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={`${displayName} profile photo`}
          width={36}
          height={36}
          className="size-9 object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

function getSidebarPreference(defaultCollapsed = false) {
  try {
    const storedPreference = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);

    if (storedPreference === null) {
      return defaultCollapsed;
    }

    return storedPreference === "true";
  } catch {
    return defaultCollapsed;
  }
}

function getServerSidebarPreference(defaultCollapsed = false) {
  return defaultCollapsed;
}

function setSidebarPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    return;
  }

  window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
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
