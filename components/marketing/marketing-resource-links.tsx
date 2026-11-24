import Link from "next/link";

const links = [
  { href: "/mcp", label: "MCP server" },
  { href: "/hookvideos", label: "Hook videos" },
  { href: "/free-tools", label: "Free tools" },
  { href: "/tools/hook-generator", label: "Hook line generator" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
] as const;

export function MarketingResourceLinks() {
  return (
    <nav aria-label="More from Vidmake" className="border-t border-border px-4 py-8 sm:px-6 lg:px-8">
      <ul className="mx-auto flex max-w-[1100px] flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="inline-flex min-h-11 items-center underline decoration-border underline-offset-4 hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
