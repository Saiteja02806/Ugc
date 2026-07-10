"use client";

import {
  CalendarDays,
  Edit3,
  FileVideo,
  Home,
  ImageIcon,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlaySquare,
  Sparkles,
  UserRound,
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

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  icon: typeof Home;
  key: string;
  label: string;
};

type SidebarGroup = {
  items: SidebarItem[];
  label: string;
};

const navigationGroups: SidebarGroup[] = [
  {
    label: "Discover",
    items: [
      { key: "trending", label: "Trending", href: "/dashboard", icon: Home },
    ],
  },
  {
    label: "Create",
    items: [
      { key: "img-gen", label: "Image Gen", href: "/image-gen", icon: ImageIcon },
      { key: "video-gen", label: "Video Gen", href: "/video-gen", icon: PlaySquare },
    ],
  },
  {
    label: "Assets",
    items: [
      { key: "demos", label: "Demos", href: "/demos", icon: FileVideo },
      { key: "avatars", label: "Avatars", href: "/avatars", icon: UserRound },
      { key: "edit", label: "Edit", href: "/edit", icon: Edit3 },
    ],
  },
  {
    label: "Plan",
    items: [
      {
        key: "scheduling",
        label: "Scheduling",
        href: "/scheduling",
        icon: CalendarDays,
      },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "ugc-studio.sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "ugc-studio:sidebar-change";

export function AppSidebar({ activeKey = "trending" }: { activeKey?: string }) {
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
    getSidebarPreference,
    getServerSidebarPreference,
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
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur lg:hidden">
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
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border bg-white transition-[width] duration-200 motion-reduce:transition-none lg:flex",
          collapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed ? "justify-center px-3" : "justify-between px-4",
          )}
        >
          <Brand compact={collapsed} />
          {!collapsed ? (
            <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} />
          ) : null}
        </div>

        {collapsed ? (
          <div className="absolute -right-[21px] top-[74px] z-40">
            <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} floating />
          </div>
        ) : null}

        <NavigationGroups activeKey={activeKey} collapsed={collapsed} />

        <AccountSection
          collapsed={collapsed}
          displayName={displayName}
          email={user?.email ?? "Signed in with Google"}
          initials={initials}
          isSigningOut={isSigningOut}
          photoUrl={user?.photoURL ?? null}
          signOutError={signOutError}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      {isMobileNavigationOpen ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
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
            className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col border-r border-border bg-white shadow-2xl"
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

            <NavigationGroups
              activeKey={activeKey}
              onNavigate={() => setIsMobileNavigationOpen(false)}
            />

            <AccountSection
              displayName={displayName}
              email={user?.email ?? "Signed in with Google"}
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
  floating = false,
  onToggle,
}: {
  collapsed: boolean;
  floating?: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-controls="ugc-desktop-sidebar"
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        floating
          ? "size-10 rounded-full border border-border-strong bg-white shadow-sm"
          : "size-10 rounded-md",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function NavigationGroups({
  activeKey,
  collapsed = false,
  onNavigate,
}: {
  activeKey: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "min-h-0 flex-1 py-5",
        collapsed ? "px-2" : "px-3",
        onNavigate && "overflow-y-auto",
      )}
    >
      {navigationGroups.map((group, groupIndex) => (
        <div key={group.label} className={cn(groupIndex > 0 && "mt-5")}>
          {collapsed ? (
            groupIndex > 0 ? <div className="mx-2 mb-3 border-t border-border" /> : null
          ) : (
            <p className="mb-2 px-3 text-xs font-medium text-muted-subtle">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => (
              <SidebarLink
                key={item.key}
                active={item.key === activeKey}
                collapsed={collapsed}
                item={item}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
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
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active
          ? "bg-foreground-strong text-white"
          : "text-muted hover:bg-card-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn("size-[18px] shrink-0", active && "text-brand")}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {collapsed ? (
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-foreground-strong px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
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
    <div className={cn("mt-auto border-t border-border", collapsed ? "p-2" : "p-3")}>
      <div className={cn("group relative flex items-center", collapsed ? "flex-col gap-2" : "gap-3")}>
        <UserAvatar displayName={displayName} initials={initials} photoUrl={photoUrl} />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs font-normal text-muted-subtle">{email}</p>
          </div>
        ) : (
          <span
            role="tooltip"
            className="pointer-events-none invisible absolute left-full top-1 z-50 ml-3 whitespace-nowrap rounded-md bg-foreground-strong px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
          >
            {displayName}
          </span>
        )}
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSigningOut ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
        </button>
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

function getSidebarPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSidebarPreference() {
  return false;
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
