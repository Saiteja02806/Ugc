"use client";

import {
  LoaderCircle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
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
import { ProductLogoMark } from "@/components/brand/product-logo";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export type AppSidebarActiveKey =
  | "trending"
  | "img-gen"
  | "video-gen"
  | "library"
  | "connected-accounts"
  | "avatars"
  | "edit"
  | "analytics"
  | "scheduling";

type SidebarItem = {
  href: string;
  icon: SidebarIconName;
  key: AppSidebarActiveKey;
  label: string;
};

const primaryNavigationItems: SidebarItem[] = [
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
    key: "avatars",
    label: "Influencers",
    href: "/avatars",
    icon: "influencers",
  },
  {
    key: "edit",
    label: "Edit",
    href: "/edit",
    icon: "edit",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: "analytics",
  },
];

const libraryNavigationItems: SidebarItem[] = [
  {
    key: "connected-accounts",
    label: "Accounts",
    href: "/connected-accounts",
    icon: "avatars",
  },
  {
    key: "library",
    label: "Content",
    href: "/library?tab=posts",
    icon: "library",
  },
  {
    key: "scheduling",
    label: "Scheduled",
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
    user?.displayName || user?.email?.split("@")[0] || "UGC Pilot user";
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
      <header className="sticky top-0 z-[var(--z-sticky)] flex h-16 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setIsMobileNavigationOpen(true)}
          aria-controls={mobileNavigationId}
          aria-expanded={isMobileNavigationOpen}
          aria-label="Open navigation"
          title="Open navigation"
          className="inline-flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      <aside
        id="ugc-desktop-sidebar"
        className={cn(
          "sticky top-0 z-[var(--z-sidebar)] hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex",
          collapsed ? "w-[68px]" : "w-[224px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            collapsed ? "justify-center" : "justify-between gap-3 px-3.5",
          )}
        >
          {collapsed ? (
            <CollapsedBrandToggle onToggle={toggleSidebar} />
          ) : (
            <>
              <Brand />
              <SidebarCollapseToggle onToggle={toggleSidebar} />
            </>
          )}
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
        <div className="fixed inset-0 z-[var(--z-modal)] md:hidden">
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
            className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col border-r border-border bg-card shadow-floating"
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
                className="inline-flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-small bg-brand">
        <ProductLogoMark
          className="size-6"
          imageClassName="brightness-0 invert"
          sizes="24px"
        />
      </span>
      <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground-strong">
        UGCPilot
      </span>
    </Link>
  );
}

function CollapsedBrandToggle({
  onToggle,
}: {
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-controls="ugc-desktop-sidebar"
      aria-expanded={false}
      aria-label="Expand sidebar"
      title="Expand sidebar"
      className="group/logo-toggle inline-flex size-10 items-center justify-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      <span className="relative size-8 overflow-hidden rounded-small">
        <span className="absolute inset-0 flex items-center justify-center bg-brand opacity-100 transition-opacity duration-150 group-hover/logo-toggle:opacity-0 group-focus-visible/logo-toggle:opacity-0 motion-reduce:transition-none">
          <ProductLogoMark
            className="size-6"
            imageClassName="brightness-0 invert"
            sizes="24px"
          />
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-deep-contrast text-white opacity-0 transition-opacity duration-150 group-hover/logo-toggle:opacity-100 group-focus-visible/logo-toggle:opacity-100 motion-reduce:transition-none">
          <SidebarIcon name="expand" className="size-[18px]" />
        </span>
      </span>
    </button>
  );
}

function SidebarCollapseToggle({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-controls="ugc-desktop-sidebar"
      aria-expanded
      aria-label="Collapse sidebar"
      title="Collapse sidebar"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-small border border-transparent text-muted-subtle transition-[background-color,color,border-color] duration-[160ms] hover:border-border hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <SidebarIcon name="collapse" className="size-[18px]" />
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
        "min-h-0 flex-1 py-3.5",
        collapsed ? "px-[14px]" : "px-3",
        collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden",
      )}
    >
      <div className="flex flex-col gap-1">
        {primaryNavigationItems.map((item) => (
          <SidebarLink
            key={item.key}
            active={item.key === activeKey}
            collapsed={collapsed}
            item={item}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className={cn(collapsed ? "mt-3.5" : "mt-5")}>
        {collapsed ? (
          <div className="mx-1 mb-3 border-t border-border" aria-hidden="true" />
        ) : (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-subtle">
            Publishing
          </p>
        )}
        <div className="flex flex-col gap-1">
          {libraryNavigationItems.map((item) => (
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
  if (collapsed) {
    return (
      <CollapsedMagneticNavItem
        active={active}
        item={item}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 motion-reduce:transition-none",
        active
          ? "bg-selected text-primary"
          : "text-muted hover:bg-card-muted hover:text-foreground-strong",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-brand"
        />
      ) : null}
      <SidebarIcon
        name={item.icon}
        className={cn(
          "size-[19px] transition-colors",
          active ? "text-brand" : "text-muted-subtle group-hover:text-foreground-strong",
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function CollapsedMagneticNavItem({
  active,
  item,
  onNavigate,
}: {
  active: boolean;
  item: SidebarItem;
  onNavigate?: () => void;
}) {
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  function resetSurface() {
    if (surfaceRef.current) {
      surfaceRef.current.style.transform = "translate3d(0, 0, 0) scale(1)";
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (
      event.pointerType !== "mouse" ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;
    const translateX = Math.max(-4, Math.min(4, relativeX * 8));
    const translateY = Math.max(-3, Math.min(3, relativeY * 6));

    if (surfaceRef.current) {
      surfaceRef.current.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(1.05)`;
    }
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      onBlur={resetSurface}
      onPointerCancel={resetSurface}
      onPointerLeave={resetSurface}
      onPointerMove={handlePointerMove}
      aria-current={active ? "page" : undefined}
      aria-describedby={tooltipId}
      aria-label={item.label}
      className="group/rail-item relative flex size-10 items-center justify-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute -left-[14px] top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand"
        />
      ) : null}
      <span
        ref={surfaceRef}
        className={cn(
          "flex size-10 items-center justify-center rounded-control transition-[transform,background-color,color,box-shadow] duration-[160ms] ease-out will-change-transform motion-reduce:transform-none motion-reduce:transition-none",
          active
            ? "bg-selected text-brand"
            : "text-muted-subtle group-hover/rail-item:bg-deep-contrast group-hover/rail-item:text-white group-hover/rail-item:shadow-[0_8px_20px_rgb(23_52_84_/_0.24)] group-focus-visible/rail-item:bg-deep-contrast group-focus-visible/rail-item:text-white group-focus-visible/rail-item:shadow-[0_8px_20px_rgb(23_52_84_/_0.24)]",
        )}
      >
        <SidebarIcon name={item.icon} className="size-5" />
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute left-full top-1/2 z-[var(--z-tooltip)] ml-3 -translate-y-1/2 whitespace-nowrap rounded-small bg-deep-contrast px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-floating transition-opacity duration-150 delay-0 group-hover/rail-item:visible group-hover/rail-item:opacity-100 group-hover/rail-item:delay-[160ms] group-focus-visible/rail-item:visible group-focus-visible/rail-item:opacity-100 motion-reduce:transition-none"
      >
        {item.label}
      </span>
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
        "mt-auto border-t border-border",
        collapsed ? "p-2" : "p-3",
      )}
    >
      <div
        className={cn(
          "flex items-center",
          collapsed ? "flex-col gap-2" : "gap-3",
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
              className="pointer-events-none invisible absolute left-full top-1/2 z-[var(--z-tooltip)] ml-3 -translate-y-1/2 whitespace-nowrap rounded-small bg-deep-contrast px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-floating transition-opacity duration-150 group-hover/avatar:visible group-hover/avatar:opacity-100 group-focus-within/avatar:visible group-focus-within/avatar:opacity-100 motion-reduce:transition-none"
            >
              {displayName}
            </span>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground-strong">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-subtle">
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
              "inline-flex shrink-0 items-center justify-center rounded-control text-muted-subtle transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
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
              className="pointer-events-none invisible absolute left-full top-1/2 z-[var(--z-tooltip)] ml-3 -translate-y-1/2 whitespace-nowrap rounded-small bg-deep-contrast px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-floating transition-opacity duration-150 group-hover/signout:visible group-hover/signout:opacity-100 group-focus-within/signout:visible group-focus-within/signout:opacity-100 motion-reduce:transition-none"
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
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-deep-contrast text-xs font-semibold text-white">
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
