import type { AppSidebarActiveKey } from "@/components/layout/app-sidebar";

export type WorkspaceAccessRequirement =
  | "authentication"
  | "none"
  | "profile";

export type WorkspaceRouteConfig = {
  access: WorkspaceAccessRequirement;
  activeKey: AppSidebarActiveKey;
  defaultSidebarCollapsed: boolean;
  showProductUpdatesFooter: boolean;
};

type WorkspaceRouteDefinition = Omit<
  WorkspaceRouteConfig,
  "defaultSidebarCollapsed" | "showProductUpdatesFooter"
> & {
  prefix: string;
};

const workspaceRoutes: ReadonlyArray<WorkspaceRouteDefinition> = [
  { prefix: "/dashboard/billing", activeKey: "trending", access: "authentication" },
  { prefix: "/dashboard", activeKey: "trending", access: "profile" },
  { prefix: "/create-content", activeKey: "create-content", access: "profile" },
  { prefix: "/ai-studio", activeKey: "ai-studio", access: "profile" },
  { prefix: "/analytics", activeKey: "analytics", access: "profile" },
  { prefix: "/viral", activeKey: "explore", access: "profile" },
  { prefix: "/library", activeKey: "library", access: "profile" },
  { prefix: "/scheduling", activeKey: "scheduling", access: "profile" },
  { prefix: "/settings", activeKey: "settings", access: "profile" },
  { prefix: "/updates", activeKey: "updates", access: "profile" },
  { prefix: "/avatars", activeKey: "avatars", access: "none" },
];

export function getWorkspaceRouteConfig(
  pathname: string,
): WorkspaceRouteConfig | null {
  const route = workspaceRoutes.find(({ prefix }) =>
    matchesRoutePrefix(pathname, prefix),
  );

  if (!route) {
    return null;
  }

  return {
    access: route.access,
    activeKey: route.activeKey,
    defaultSidebarCollapsed: shouldDefaultSidebarToCollapsed(pathname),
    showProductUpdatesFooter: pathname !== "/dashboard",
  };
}

function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function shouldDefaultSidebarToCollapsed(pathname: string) {
  return (
    /^\/avatars\/media\/[^/]+\/edit$/.test(pathname) ||
    /^\/library\/demos\/[^/]+\/edit$/.test(pathname)
  );
}
